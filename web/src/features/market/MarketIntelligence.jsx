import Paged from '../../components/Paged.jsx';
import React, { useEffect, useState } from 'react';
export default function MarketIntelligence({
  root,
  workspaceId,
  request,
  token,
  snapshot,
  signals,
  readOnly,
  onChanged,
  onPriority,
}) {
  const [observations, setObservations] = useState([]),
    [competitors, setCompetitors] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const [o, c] = await Promise.all([
      request(`${root}/market`, {}, token),
      request(`/api/workspaces/${workspaceId}/competitors`, {}, token),
    ]);
    setObservations(o);
    setCompetitors(c);
  };
  useEffect(() => {
    let alive = true;
    Promise.all([
      request(`${root}/market`, {}, token),
      request(`/api/workspaces/${workspaceId}/competitors`, {}, token),
    ])
      .then(([o, c]) => {
        if (alive) {
          setObservations(o);
          setCompetitors(c);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [root, workspaceId, token]);
  const save = async (path, body) => {
    setBusy(true);
    setError('');
    try {
      await request(path, { method: 'POST', body: JSON.stringify(body) }, token);
      await load();
      await onChanged();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="data-panel">
      <p className="eyebrow">MARKET IMPACT</p>
      <h3>Connect competitor changes to your customers.</h3>
      <p className="muted">
        Record a sourced observation and identify overlapping segments or accounts. Genesis computes
        connected ARR; it does not assume customers will switch.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!readOnly && (
        <>
          <details>
            <summary>Add competitor</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                if (
                  await save(`/api/workspaces/${workspaceId}/competitors`, {
                    name: new FormData(form).get('name'),
                  })
                )
                  form.reset();
              }}
            >
              <label>
                Name
                <input name="name" required maxLength={120} />
              </label>
              <button disabled={busy}>Add competitor</button>
            </form>
          </details>
          <details>
            <summary>Record market observation</summary>
            <form
              className="decision-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                const input = {
                  competitorId: f.get('competitorId'),
                  changeType: f.get('changeType'),
                  description: f.get('description'),
                  sourceUrl: f.get('sourceUrl'),
                  observedAt: `${f.get('observedAt')}T00:00:00.000Z`,
                  segments: f
                    .get('segments')
                    .split('|')
                    .map((s) => s.trim())
                    .filter(Boolean),
                  customerIds: f.getAll('customerIds'),
                };
                if (await save(`${root}/market`, input)) form.reset();
              }}
            >
              <label>
                Competitor
                <select name="competitorId" required>
                  <option value="">Select competitor</option>
                  {competitors.map((c) => (
                    <option value={c._id} key={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Change type
                <select name="changeType">
                  <option value="pricing">Pricing</option>
                  <option value="feature">Feature</option>
                  <option value="positioning">Positioning</option>
                </select>
              </label>
              <label>
                What changed?
                <textarea name="description" minLength={10} maxLength={3000} required />
              </label>
              <label>
                Source URL
                <input name="sourceUrl" type="url" required placeholder="https://…" />
              </label>
              <label>
                Observed date
                <input
                  name="observedAt"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label>
                Affected segments · optional
                <input name="segments" placeholder="Enterprise | Mid-market" />
              </label>
              <fieldset>
                <legend>Or select overlapping accounts</legend>
                <div className="relationship-options">
                  {snapshot?.customers.map((c) => (
                    <label key={c.id}>
                      <input name="customerIds" type="checkbox" value={c.id} />
                      {c.name} · {c.segment || 'No segment'}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="muted">
                This is a user-recorded observation. Keep a source that supports the claim; Genesis
                does not independently verify the page.
              </p>
              <button disabled={busy || !competitors.length}>
                Save observation & assess overlap
              </button>
            </form>
          </details>
        </>
      )}
      <h4>Current overlap signals</h4>
      {signals
        .filter((s) => s.category === 'market_change')
        .map((s) => (
          <button className="graph-signal" key={s.key} onClick={() => onPriority(s.key)}>
            {s.title}
            <span>
              {s.evidence.currency} {(s.evidence.arrMinor / 100).toLocaleString()} connected ARR ·{' '}
              {s.evidence.pricingConcerns} pricing concerns →
            </span>
          </button>
        ))}
      <h4>Observation history</h4>
      <Paged items={observations} size={2}>
        {(o) => (
          <article className="priority-card" key={o._id}>
            <h4>
              {o.competitorName} · {o.changeType}
            </h4>
            <p>{o.description}</p>
            <a href={o.sourceUrl} rel="noreferrer" target="_blank">
              Open recorded source
            </a>
            <p className="muted">
              Observed {new Date(o.observedAt).toLocaleDateString()} · Segments:{' '}
              {o.segments.join(', ') || 'None'} · {o.customerIds.length} explicitly selected
              accounts
            </p>
          </article>
        )}
      </Paged>
      {!observations.length && <p>No market observations recorded yet.</p>}
      <p className="muted">
        Overlap rules consider the latest 100 recorded observations from the past 90 days. Evidence
        links are retained; automated competitor research remains separate.
      </p>
    </section>
  );
}
