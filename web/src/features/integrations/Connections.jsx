import React, { useEffect, useState } from 'react';
export default function Connections({
  root,
  request,
  token,
  snapshot,
  actions,
  readOnly,
  onChanged,
}) {
  const [data, setData] = useState({ connections: [], work: [], dispatches: [] }),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [provider, setProvider] = useState('github'),
    [credential, setCredential] = useState(null),
    [rotate, setRotate] = useState(null),
    [preview, setPreview] = useState(null);
  const load = async () => setData(await request(`${root}/connections`, {}, token));
  useEffect(() => {
    let alive = true;
    request(`${root}/connections`, {}, token)
      .then((v) => {
        if (alive) setData(v);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [root, token]);
  const send = (path, body, method = 'POST') =>
    request(`${root}${path}`, { method, body: JSON.stringify(body) }, token);
  const act = async (fn) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await fn();
      await load();
      await onChanged();
      setNotice(result?.message || 'Saved.');
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const github = data.connections.filter((c) => c.provider === 'github' && c.enabled);
  return (
    <section className="data-panel">
      <p className="eyebrow">CONNECTIONS & EXTERNAL WORK</p>
      <h3>Keep company context moving.</h3>
      <p className="muted">
        GitHub imports repository issues. Other systems can send validated company observations to a
        scoped ingestion endpoint. No paid API is required by Genesis; provider limits still apply.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success-notice">
          {notice}
        </p>
      )}
      {credential && (
        <div className="credential-notice">
          <h4>Save this ingestion credential (rotation invalidates the previous secret)</h4>
          <p>
            Endpoint: <code>{credential.endpoint}</code>
          </p>
          <p>
            Authorization header: <code>Bearer {credential.secret}</code>
          </p>
          <p>
            This workspace-scoped secret is shown only in this response. Send full snapshot JSON
            over HTTPS in a deployed environment.
          </p>
          <button className="quiet-button" onClick={() => setCredential(null)}>
            Hide credential
          </button>
        </div>
      )}
      {!readOnly && (
        <details>
          <summary>Add a connection</summary>
          <form
            className="decision-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              const input = { name: f.get('name'), provider };
              if (provider === 'github') {
                input.repository = f.get('repository').trim();
                if (f.get('token')) input.token = f.get('token');
                if (f.get('projectId')) input.projectId = f.get('projectId');
                input.syncProjectProgress = f.get('syncProjectProgress') === 'on';
              }
              const result = await act(() => send('/connections', input));
              if (result) {
                if (result.secret) setCredential(result);
                form.reset();
              }
            }}
          >
            <label>
              Name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="github">GitHub issues</option>
                <option value="ingestion">Generic company ingestion</option>
              </select>
            </label>
            {provider === 'github' && (
              <>
                <label>
                  Repository
                  <input
                    name="repository"
                    placeholder="owner/repository"
                    required
                    pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+"
                  />
                </label>
                <label>
                  Fine-grained token · optional for public read access
                  <input name="token" type="password" autoComplete="off" maxLength={1000} />
                </label>
                <label>
                  Mapped company project
                  <select name="projectId">
                    <option value="">No project mapping</option>
                    {snapshot?.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="graph-toggle">
                  <input name="syncProjectProgress" type="checkbox" />
                  Update mapped project completion from closed issue count / total issue count
                </label>
                <p className="muted">
                  This is a count-based progress proxy, not effort-weighted delivery. It replaces
                  the mapped project’s completion only. Public reads can work without a token;
                  private reads and issue publication require repository permissions.
                </p>
              </>
            )}
            <button disabled={busy}>Create connection</button>
          </form>
        </details>
      )}
      {data.connections.map((c) => (
        <article className="priority-card" key={c._id}>
          <div className="section-heading">
            <h4>{c.name}</h4>
            <span className="signal-badge">{c.enabled ? c.status : 'Paused'}</span>
          </div>
          <p>
            {c.provider} {c.repository || ''} · Last sync{' '}
            {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : 'Never'}
          </p>
          {c.lastError && <p className="error">{c.lastError}</p>}
          {c.provider === 'github' && (
            <p>
              {c.closedIssueCount ?? '—'} closed / {c.issueCount ?? '—'} imported issues
            </p>
          )}
          {!readOnly && (
            <div className="card-controls">
              {c.provider === 'github' && (
                <button
                  disabled={busy || !c.enabled}
                  onClick={() => act(() => send(`/connections/${c._id}/sync`, {}))}
                >
                  Sync now
                </button>
              )}
              <button
                className="quiet-button"
                disabled={busy}
                onClick={() =>
                  act(() => send(`/connections/${c._id}`, { enabled: !c.enabled }, 'PATCH'))
                }
              >
                {c.enabled ? 'Pause' : 'Enable'}
              </button>
              <button
                className="quiet-button"
                disabled={busy}
                onClick={() =>
                  c.provider === 'ingestion'
                    ? act(async () => {
                        const value = await send(`/connections/${c._id}/credentials`, {});
                        setCredential(value);
                        return value;
                      })
                    : setRotate(c._id)
                }
              >
                {c.provider === 'ingestion' ? 'Rotate ingestion secret' : 'Replace token'}
              </button>
            </div>
          )}
          {rotate === c._id && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get('token');
                if (await act(() => send(`/connections/${c._id}/credentials`, { token: value })))
                  setRotate(null);
              }}
            >
              <label>
                New repository token
                <input type="password" name="token" autoComplete="off" required />
              </label>
              <button disabled={busy}>Save encrypted token</button>
            </form>
          )}
        </article>
      ))}
      {!readOnly && !!github.length && !!actions.length && (
        <details>
          <summary>Publish a Genesis action as a GitHub issue</summary>
          <form
            className="decision-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const actionId = f.get('actionId'),
                connectionId = f.get('connectionId');
              await act(async () => {
                const p = await request(
                  `${root}/actions/${actionId}/publish-preview?connectionId=${encodeURIComponent(connectionId)}`,
                  {},
                  token,
                );
                setPreview({ ...p, actionId, connectionId });
              });
            }}
          >
            <label>
              Action
              <select name="actionId">
                {actions.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Destination repository
              <select name="connectionId">
                {github.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.repository}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Preview exact publication</button>
          </form>
          {preview && (
            <div className="publish-preview">
              <h4>Publish to {preview.repository}</h4>
              <strong>{preview.title}</strong>
              <pre>{preview.body}</pre>
              <p>
                This sends the shown action, owner name, deadline, reason, and expected result to
                GitHub. Repository viewers will be able to read it.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const result = await send(`/actions/${preview.actionId}/publish`, {
                      connectionId: preview.connectionId,
                      title: preview.title,
                      body: preview.body,
                      confirm: true,
                    });
                    setPreview(null);
                    return result;
                  })
                }
              >
                Publish this issue to GitHub
              </button>
              <button className="quiet-button" onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          )}
        </details>
      )}
      {!!data.dispatches.length && (
        <details>
          <summary>Published action links and recovery</summary>
          {data.dispatches.map((d) => (
            <p key={d._id}>
              {d.status} ·{' '}
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer">
                  Open GitHub issue
                </a>
              ) : (
                'No confirmed issue URL'
              )}{' '}
              {!readOnly && ['uncertain', 'publishing'].includes(d.status) && (
                <button
                  className="quiet-button"
                  disabled={busy}
                  onClick={() => act(() => send(`/dispatches/${d._id}/reconcile`, {}))}
                >
                  Reconcile publication
                </button>
              )}
            </p>
          ))}
        </details>
      )}
      {!!data.work.length && (
        <details>
          <summary>Recently synced issues</summary>
          <ul>
            {data.work.map((w) => (
              <li key={w._id}>
                <a href={w.url} target="_blank" rel="noreferrer">
                  {w.title}
                </a>{' '}
                · {w.state}
              </li>
            ))}
          </ul>
          <p className="muted">Showing up to 100 recent cached issues.</p>
        </details>
      )}
      <p className="muted">
        Background processing checks one due GitHub connection every 15 minutes; successful
        connections become eligible again after 90 minutes. Complete syncs are limited to 1,000
        repository issue/PR listing entries. Larger repositories fail without applying partial
        progress.
      </p>
    </section>
  );
}
