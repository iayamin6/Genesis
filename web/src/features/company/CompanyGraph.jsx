import React, { useMemo, useState } from 'react';
import {
  buildCompanyGraph,
  downstreamCustomers,
  graphKinds,
  signalsForNode,
} from '../../lib/company-graph.js';
const kindNames = {
  teams: 'Team',
  employees: 'Employee',
  projects: 'Project',
  products: 'Product',
  features: 'Feature',
  customers: 'Customer',
};
const money = (minor, currency) =>
  `${currency} ${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
export default function CompanyGraph({
  snapshot,
  signals,
  actions,
  onOpenSignal,
  onOpenActions,
  onOpenData,
}) {
  const graph = useMemo(() => (snapshot ? buildCompanyGraph(snapshot) : null), [snapshot]);
  const [selected, setSelected] = useState(null),
    [history, setHistory] = useState([]),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('all'),
    [requests, setRequests] = useState(false),
    [showCustomers, setShowCustomers] = useState(false),
    [limit, setLimit] = useState(40);
  if (!snapshot)
    return (
      <section className="empty-state">
        <h3>See how your company connects.</h3>
        <p>Add teams, projects, features, and customers to explore their relationships.</p>
        <button onClick={onOpenData}>Open company data →</button>
      </section>
    );
  const nodes = [...graph.nodes.values()];
  const node = graph.nodes.get(selected) || nodes.find((n) => n.kind === 'teams') || nodes[0];
  const filtered = nodes
    .filter(
      (n) =>
        (kind === 'all' || kind === n.kind) &&
        n.record.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.record.name.localeCompare(b.record.name));
  const select = (key) => {
    if (key === node?.key) return;
    setHistory((old) => [...old, node?.key].filter(Boolean).slice(-30));
    setSelected(key);
    setShowCustomers(false);
  };
  const incoming = node ? graph.incoming.get(node.key).filter((e) => !e.request || requests) : [];
  const outgoing = node ? graph.outgoing.get(node.key).filter((e) => !e.request || requests) : [];
  const customers = node ? downstreamCustomers(graph, node.key, requests) : [];
  const relevantSignals = node ? signalsForNode(signals, node) : [];
  const signalKeys = new Set(relevantSignals.map((s) => s.key));
  const linkedActions = actions.filter(
    (a) =>
      signalKeys.has(a.riskKey) || (node?.kind === 'employees' && a.ownerId === node.record.id),
  );
  const activeActions = linkedActions.filter((a) => !['completed', 'cancelled'].includes(a.status));
  const connectionList = (edges, direction) => (
    <div className="graph-connections">
      <h4>
        {direction === 'incoming' ? 'Connected from' : 'Connects to'} <span>{edges.length}</span>
      </h4>
      {!edges.length && (
        <p className="muted">
          No {direction === 'incoming' ? 'incoming' : 'outgoing'} relationships recorded
          {!requests ? ' in dependency view' : ''}.
        </p>
      )}
      <div className="graph-edge-list">
        {edges.map((edge) => {
          const other = graph.nodes.get(direction === 'incoming' ? edge.from : edge.to);
          return (
            <button
              className={`graph-edge ${edge.request ? 'request-edge' : ''}`}
              key={edge.key}
              onClick={() => select(other.key)}
            >
              <span className="eyebrow">{kindNames[other.kind]}</span>
              <strong>{other.record.name}</strong>
              <small>
                {edge.label} {direction === 'incoming' ? '→' : '↗'}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <section className="company-graph">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMPANY MAP</p>
          <h3>Follow the connections.</h3>
          <p className="muted">
            Explore your saved observation. Select a record to follow its work, customer
            dependencies, and recorded signals.
          </p>
        </div>
        <button className="quiet-button" onClick={onOpenData}>
          Edit company data
        </button>
      </div>
      <div className="graph-layout">
        <section className="graph-browser" aria-label="Find company records">
          <label>
            Search records
            <input
              type="search"
              value={query}
              placeholder="Team, project, customer…"
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(40);
              }}
            />
          </label>
          <label>
            Record type
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setLimit(40);
              }}
            >
              <option value="all">All records</option>
              {graphKinds.map((k) => (
                <option key={k} value={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <p className="muted" role="status">
            {filtered.length} matching records
          </p>
          <div className="graph-records">
            {filtered.slice(0, limit).map((n) => (
              <button
                key={n.key}
                aria-pressed={node?.key === n.key}
                className={node?.key === n.key ? 'selected-node' : ''}
                onClick={() => select(n.key)}
              >
                <small>{kindNames[n.kind]}</small>
                <span>{n.record.name}</span>
              </button>
            ))}
          </div>
          {filtered.length > limit && (
            <button className="quiet-button" onClick={() => setLimit(limit + 40)}>
              Show more records
            </button>
          )}
          {!filtered.length && <p className="muted">No records match this search.</p>}
        </section>
        <div className="graph-detail">
          {node ? (
            <>
              <div className="graph-toolbar">
                <button
                  className="quiet-button"
                  disabled={!history.length}
                  onClick={() => {
                    setSelected(history.at(-1));
                    setHistory((old) => old.slice(0, -1));
                    setShowCustomers(false);
                  }}
                >
                  ← Back
                </button>
                <label className="graph-toggle">
                  <input
                    type="checkbox"
                    checked={requests}
                    onChange={(e) => setRequests(e.target.checked)}
                  />
                  Include feature requests
                </label>
              </div>
              <div className="graph-focus" aria-live="polite">
                <p className="eyebrow">{kindNames[node.kind]}</p>
                <h3>{node.record.name}</h3>
                {node.kind === 'employees' && (
                  <p>
                    {node.record.allocatedHours}h allocated / {node.record.capacityHours}h weekly
                    capacity
                  </p>
                )}
                {node.kind === 'projects' && (
                  <p>
                    {node.record.completion}% complete · Due {node.record.dueDate}
                  </p>
                )}
                {node.kind === 'customers' && (
                  <p>
                    {money(node.record.arrMinor, snapshot.currency)} ARR · Renewal{' '}
                    {node.record.renewalDate || 'unknown'} · {node.record.openSupportIssues} open
                    support issues
                  </p>
                )}
              </div>
              <div className="graph-neighborhood">
                {connectionList(incoming, 'incoming')}
                <div className="graph-center-mark" aria-hidden="true">
                  →
                </div>
                {connectionList(outgoing, 'outgoing')}
              </div>
              <section className="graph-impact">
                <div className="section-heading">
                  <div>
                    <h4>
                      {node.kind === 'customers'
                        ? 'Customer revenue context'
                        : 'Connected customer relationships'}
                    </h4>
                    <p>
                      <strong>
                        {money(
                          customers.reduce((n, c) => n + c.arrMinor, 0),
                          snapshot.currency,
                        )}
                      </strong>{' '}
                      · {customers.length} unique customer{customers.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  {customers.length > 0 && (
                    <button
                      className="quiet-button"
                      aria-expanded={showCustomers}
                      onClick={() => setShowCustomers(!showCustomers)}
                    >
                      {showCustomers ? 'Hide customers' : 'View customers'}
                    </button>
                  )}
                </div>
                <p className="muted">
                  Each account is counted once along outgoing relationships
                  {requests ? ', including explicit requests' : ', excluding requests'}. This is
                  connected ARR, not estimated revenue loss.
                </p>
                {showCustomers && (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>ARR</th>
                          <th>Renewal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <button className="link" onClick={() => select(`customers:${c.id}`)}>
                                {c.name}
                              </button>
                            </td>
                            <td>{money(c.arrMinor, snapshot.currency)}</td>
                            <td>{c.renewalDate || 'Unknown'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <div className="graph-context">
                <section>
                  <h4>
                    Related signals <span className="muted">{relevantSignals.length}</span>
                  </h4>
                  {!relevantSignals.length && (
                    <p className="muted">
                      No current signal explicitly references this record. This does not establish
                      that it has no risk.
                    </p>
                  )}
                  {relevantSignals.map((s) => (
                    <button
                      key={s.key}
                      className="graph-signal"
                      onClick={() => onOpenSignal(s.key)}
                    >
                      <span className={`signal-badge ${s.severity}`}>
                        {s.severity === 'opportunity' ? 'Opportunity' : 'Review'}
                      </span>
                      <strong>{s.title}</strong>
                      <span>Open priority →</span>
                    </button>
                  ))}
                </section>
                <section>
                  <h4>
                    Related actions <span className="muted">{activeActions.length} active</span>
                  </h4>
                  {!linkedActions.length && (
                    <p className="muted">
                      No actions are linked through these signals or assigned to this employee.
                    </p>
                  )}
                  {linkedActions.slice(0, 5).map((a) => (
                    <div className="graph-action" key={a._id}>
                      <strong>{a.title}</strong>
                      <p>
                        {a.ownerName} · {a.status.replaceAll('_', ' ')} · Due {a.dueDate}
                      </p>
                    </div>
                  ))}
                  {linkedActions.length > 0 && (
                    <button className="quiet-button" onClick={onOpenActions}>
                      Open all actions →
                    </button>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>No records in this observation.</h3>
              <button onClick={onOpenData}>Add company records</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
