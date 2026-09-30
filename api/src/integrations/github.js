import crypto from 'node:crypto';
import { Connection, ExternalWork, TaskDispatch } from './models.js';
import { CompanyAction } from '../intelligence/models.js';
import { latestEvaluation, importSnapshot } from '../intelligence/service.js';
import { unseal } from './secrets.js';
export async function githubRequest(connection, suffix, options = {}) {
  const token = unseal(connection.encryptedToken);
  const response = await fetch(`https://api.github.com/repos/${connection.repository}${suffix}`, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'Genesis-company-intelligence',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!response.ok)
    throw Object.assign(
      new Error(
        `GitHub returned ${response.status}. Check repository access, token permissions, and rate limits.`,
      ),
      { status: 502 },
    );
  const body = await response.text();
  if (body.length > 8000000) throw new Error('GitHub response exceeded the import limit');
  return { data: JSON.parse(body), hasNext: /rel="next"/.test(response.headers.get('link') || '') };
}
export async function listIssues(connection) {
  const issues = [];
  let page = 1;
  while (page <= 10) {
    const { data, hasNext } = await githubRequest(
      connection,
      `/issues?state=all&per_page=100&page=${page}&sort=created&direction=asc`,
    );
    if (!Array.isArray(data)) throw new Error('Unexpected GitHub response');
    issues.push(...data.filter((i) => !i.pull_request));
    if (!hasNext) return issues;
    page++;
  }
  throw new Error(
    'Repository exceeds the 1,000-item sync limit. No partial project progress was applied.',
  );
}
export async function syncConnection(id) {
  const now = new Date();
  const connection = await Connection.findOneAndUpdate(
    {
      _id: id,
      provider: 'github',
      enabled: true,
      $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: null }],
    },
    { $set: { leaseUntil: new Date(Date.now() + 360000), status: 'syncing', lastError: null } },
    { new: true },
  ).select('+encryptedToken');
  if (!connection)
    throw Object.assign(new Error('Connection is paused or already syncing'), { status: 409 });
  try {
    const issues = await listIssues(connection),
      syncedAt = new Date();
    if (issues.length)
      await ExternalWork.bulkWrite(
        issues.map((i) => ({
          updateOne: {
            filter: { connectionId: connection._id, number: i.number },
            update: {
              $set: {
                workspaceId: connection.workspaceId,
                title: i.title.slice(0, 500),
                state: i.state,
                url: `https://github.com/${connection.repository}/issues/${i.number}`,
                projectId: connection.projectId,
                assignees: (i.assignees || []).map((a) => a.login),
                updatedAtSource: i.updated_at,
                syncedAt,
              },
            },
            upsert: true,
          },
        })),
      );
    // Only a complete repository listing can remove old cached issues.
    await ExternalWork.deleteMany({ connectionId: connection._id, syncedAt: { $ne: syncedAt } });
    if (connection.syncProjectProgress && issues.length) {
      const latest = await latestEvaluation(connection.workspaceId);
      if (!latest?.snapshot.projects.some((p) => p.id === connection.projectId))
        throw new Error(
          'Mapped project is missing. Update the connection before syncing progress.',
        );
      const snapshot = structuredClone(latest.snapshot);
      const completion = Math.round(
        (issues.filter((i) => i.state === 'closed').length / issues.length) * 100,
      );
      if (snapshot.projects.find((p) => p.id === connection.projectId).completion !== completion) {
        snapshot.projects.find((p) => p.id === connection.projectId).completion = completion;
        const priorStamp = snapshot.observedAt;
        snapshot.importKey = `github-${crypto.randomUUID()}`;
        snapshot.observedAt = new Date().toISOString();
        snapshot.domainsObservedAt = {
          customers: snapshot.domainsObservedAt?.customers || priorStamp,
          capacity: snapshot.domainsObservedAt?.capacity || priorStamp,
          delivery: snapshot.observedAt,
        };
        snapshot.source =
          snapshot.source.kind === 'sample'
            ? snapshot.source
            : {
                kind: 'connector',
                name: `GitHub ${connection.repository}: issue-count progress; other fields retained`,
              };
        // Concurrent manual changes must not be silently replaced by a sync.
        if ((await latestEvaluation(connection.workspaceId)).id !== latest.id)
          throw new Error(
            'Company observation changed during sync. Retry to merge with current data.',
          );
        await importSnapshot(
          connection.workspaceId,
          snapshot,
          new Date(),
          latest.snapshot.importKey,
        );
      }
    }
    for (const dispatch of await TaskDispatch.find({
      connectionId: connection._id,
      status: 'published',
    })) {
      const issue = issues.find((i) => i.number === dispatch.issueNumber);
      if (!issue) continue;
      await CompanyAction.updateOne(
        {
          _id: dispatch.actionId,
          workspaceId: connection.workspaceId,
          status: issue.state === 'closed' ? { $ne: 'cancelled' } : 'completed',
        },
        {
          $set: {
            status: issue.state === 'closed' ? 'completed' : 'open',
            completedAt: issue.state === 'closed' ? new Date(issue.closed_at || syncedAt) : null,
          },
        },
      );
      await TaskDispatch.updateOne({ _id: dispatch._id }, { $set: { lastSyncedAt: syncedAt } });
    }
    await Connection.updateOne(
      { _id: id },
      {
        $set: {
          status: 'ready',
          lastSyncedAt: syncedAt,
          issueCount: issues.length,
          closedIssueCount: issues.filter((i) => i.state === 'closed').length,
          leaseUntil: null,
        },
      },
    );
    return { issueCount: issues.length };
  } catch (e) {
    await Connection.updateOne(
      { _id: id },
      { $set: { status: 'error', lastError: e.message.slice(0, 500), leaseUntil: null } },
    );
    throw e;
  }
}
export function taskPreview(action, connection) {
  return {
    title: action.title,
    repository: connection.repository,
    body: `Genesis action\n\nOwner: ${action.ownerName}\nDue: ${action.dueDate}\n\nReason\n${action.reason}\n\nExpected outcome\n${action.expectedResult}\n\n<!-- genesis-action:${action.id} -->`,
  };
}
