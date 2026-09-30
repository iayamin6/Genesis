import { Connection } from '../integrations/models.js';
import { syncConnection } from '../integrations/github.js';
import { CompanyEvaluation } from '../intelligence/models.js';
import { reevaluateWorkspace } from '../intelligence/service.js';
import { agentQueue } from './queue.js';
import { Workspace, AgentRun } from '../models.js';

// One repeatable dispatcher keeps schedule configuration in code and makes all generated jobs explicit/idempotent.
export async function configureScheduler() {
  await agentQueue.add({ type: 'company-dispatch' }, { jobId: 'company-dispatch', repeat: { cron: '*/15 * * * *' }, removeOnComplete: true });
  await agentQueue.add({ type: 'daily-dispatch' }, { jobId: 'daily-dispatch', repeat: { cron: '0 7 * * *' }, removeOnComplete: true });
}
export async function dispatchDaily() {
  const day = new Date().toISOString().slice(0, 10);
  for await (const workspace of Workspace.find({ 'competitors.0': { $exists: true } }).cursor()) {
    const key = `competitor-digest:${workspace.id}:${day}`;
    let run = await AgentRun.findOne({ idempotencyKey: key });
    if (!run) { run = await AgentRun.create({ workspaceId: workspace._id, kind: 'competitor_digest', trigger: 'scheduled', idempotencyKey: key }); await agentQueue.add({ runId: run.id }, { jobId: run.id, attempts: 3 }); }
  }
}

export async function dispatchCompany() {
  const connection = await Connection.findOne({ provider: 'github', enabled: true, $or: [{ lastSyncedAt: { $lt: new Date(Date.now() - 90 * 60000) } }, { lastSyncedAt: null }] }).sort({ updatedAt: 1 });
  if (connection) { try { await syncConnection(connection.id); } catch { /* The connection stores its sanitized failure; continue company analysis. */ } }
  for (const workspaceId of await CompanyEvaluation.distinct('workspaceId')) await reevaluateWorkspace(workspaceId);
}
