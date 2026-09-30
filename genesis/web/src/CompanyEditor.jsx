import Paged from './Paged.jsx';
import React, { useEffect, useState } from 'react';
import CsvImport from './CsvImport.jsx';
import { sections, fields, emptyCompany, editRecord, normalizeRecord, referencesTo, changesBetween, observationFor } from './company-data.js';
const singular = { teams: 'team', employees: 'employee', projects: 'project', products: 'product', features: 'feature', customers: 'customer' };
export default function CompanyEditor({ snapshot, busy, readOnly, onSave }) {
  const [baseline, setBaseline] = useState(() => structuredClone(snapshot || emptyCompany()));
  const [company, setCompanyState] = useState(() => structuredClone(snapshot || emptyCompany()));
  const [undoHistory, setUndoHistory] = useState([]);
  const setCompany = next => { setUndoHistory(old => [...old, company]); setCompanyState(next); };
  const [importing, setImporting] = useState(false);
  const [section, setSection] = useState('teams'), [editing, setEditing] = useState(null), [error, setError] = useState(''), [review, setReview] = useState(false), [search, setSearch] = useState(''), [removing, setRemoving] = useState(null);
  const changes = changesBetween(baseline, company);
  const dirty = changes.length > 0 || editing !== null || importing;
  useEffect(() => { if (!dirty) return; const warn = e => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const update = (key, value) => setEditing(old => ({ ...old, [key]: value, ...(section === 'projects' && key === 'teamId' ? { ownerIds: [] } : {}) }));
  function commitRecord(e) {
    e.preventDefault(); setError('');
    try {
      const row = normalizeRecord(section, editing);
      // Moving an employee cannot leave their existing project ownership inconsistent.
      if (section === 'employees' && company.projects.some(p => p.ownerIds.includes(row.id) && p.teamId !== row.teamId)) throw new Error('Remove this employee from their project owners before changing their team.');
      const exists = company[section].some(r => r.id === row.id);
      setCompany({ ...company, [section]: exists ? company[section].map(r => r.id === row.id ? row : r) : [...company[section], row] });
      setEditing(null);
    } catch (e) { setError(e.message); }
  }
  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(observationFor(company), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'genesis-company-draft.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const labelFor = (kind, id) => company[kind].find(r => r.id === id)?.name || 'Unassigned';
  const describe = row => section === 'employees' ? `${labelFor('teams', row.teamId)} · ${row.allocatedHours} / ${row.capacityHours}h allocated` : section === 'projects' ? `${labelFor('teams', row.teamId)} · ${row.completion}% complete · Due ${row.dueDate}` : section === 'features' ? `${labelFor('products', row.productId)} → ${labelFor('projects', row.projectId)}` : section === 'customers' ? `${company.currency} ${(row.arrMinor / 100).toLocaleString()} ARR · ${row.featureIds.length} feature dependencies` : `${referencesTo(company, section, row.id).length} connections`;
  const limits = { teams: 100, employees: 500, projects: 300, products: 100, features: 500, customers: 1000 };
  return <section className="guided-editor"><div className="section-heading"><div><h3>Build your company’s connections</h3><p className="muted">Add your people and work, then connect them to customers. Changes stay in this draft until you save an observation. Save before switching workspaces.</p></div><span className="signal-badge">{readOnly ? 'Read only' : changes.length ? `${changes.length} draft changes` : 'Up to date'}</span></div>
    {company.source.kind === 'sample' && <p className="sample-notice">This is synthetic sample data. Edited observations keep their sample label.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="editor-layout"><nav className="entity-nav" aria-label="Company records">{sections.map((s, i) => <button key={s} disabled={!!editing || importing || busy} className={section === s ? 'active' : ''} aria-current={section === s ? 'page' : undefined} onClick={() => { setSection(s); setSearch(''); setReview(false); setError(''); setRemoving(null); }}><span>{i + 1}. {s[0].toUpperCase() + s.slice(1)}</span><span>{company[s].length}</span></button>)}</nav>
    <div className="entity-content">
    {importing ? <CsvImport company={company} section={section} onCancel={() => setImporting(false)} onApply={next => { setCompany(next); setImporting(false); setError(''); setSearch(''); }}/> : review ? <section><h4>Review your observation</h4><p>These changes will update your company signals. Earlier observations and action baselines are retained.</p><ul className="review-changes">{changes.map((c, i) => <li key={i}><strong>{c.name}</strong><span>{c.section} · {c.change}</span></li>)}</ul><div className="card-controls"><button disabled={busy} className="quiet-button" onClick={() => setReview(false)}>Back to editing</button><button disabled={busy || !changes.length} onClick={async () => { if (await onSave(observationFor(company))) { setBaseline(structuredClone(company)); setReview(false); } }}>{busy ? 'Saving…' : 'Save observation & update signals'}</button></div></section> : editing ? <form onSubmit={commitRecord} className="record-form"><h4>{company[section].some(r => r.id === editing.id) ? 'Edit' : 'Add'} {singular[section]}</h4><label>Name<input autoFocus value={editing.name} onChange={e => update('name', e.target.value)} maxLength={160} required /></label>
    {fields[section].map(field => {
      const options = field.relation ? company[field.relation].filter(row => field.key !== 'ownerIds' || row.teamId === editing.teamId) : [];
      if (field.multiple) return <fieldset key={field.key}><legend>{field.label}</legend>{!options.length && <p className="muted">{field.key === 'ownerIds' ? 'Add employees to the selected team first.' : 'Add features first to connect this customer.'}</p>}<div className="relationship-options">{options.map(row => <label key={row.id}><input type="checkbox" checked={editing[field.key]?.includes(row.id) || false} onChange={e => update(field.key, e.target.checked ? [...(editing[field.key] || []), row.id] : editing[field.key].filter(id => id !== row.id))}/>{row.name}</label>)}</div></fieldset>;
      if (field.relation) return <label key={field.key}>{field.label}<select required={!field.optional} value={editing[field.key]} onChange={e => update(field.key, e.target.value)}><option value="">Select {singular[field.relation]}</option>{options.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{!options.length && <span className="muted">Add a {singular[field.relation]} first.</span>}</label>;
      return <label key={field.key}>{field.label}{field.key === 'arr' ? ` (${company.currency})` : ''}{field.optional ? ' · optional' : ''}<input type={field.type} min={field.type === 'number' ? 0 : undefined} max={field.max} step={field.step || (field.key === 'arr' ? '0.01' : 'any')} required={!field.optional} value={editing[field.key]} onChange={e => update(field.key, e.target.value)}/></label>;
    })}<div className="card-controls"><button type="button" className="quiet-button" onClick={() => { setEditing(null); setError(''); }}>Cancel record edits</button><button>Add to draft</button></div></form> : <>
      <div className="section-heading"><h4>{section[0].toUpperCase() + section.slice(1)}</h4>{!readOnly && <div className="card-controls"><button className="quiet-button" disabled={busy} onClick={() => { setImporting(true); setRemoving(null); setError(''); }}>Import CSV</button><button disabled={busy || company[section].length >= limits[section]} onClick={() => { setEditing(editRecord(section)); setRemoving(null); setError(''); }}>+ Add {singular[section]}</button></div>}</div>
      {section === 'customers' && <label className="currency-field">Company currency<select disabled={readOnly || busy || company.customers.length > 0} value={company.currency} onChange={e => setCompany({ ...company, currency: e.target.value })}>{['USD', 'EUR', 'GBP', 'BDT', 'CAD', 'AUD', 'INR'].map(c => <option key={c}>{c}</option>)}</select><span className="muted">Set before adding customers. Existing ARR is never automatically converted.</span></label>}
      {!!company[section].length && <label>Find a {singular[section]}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…"/></label>}
      {!company[section].length && <div className="empty-state"><h4>No {section} yet</h4><p>{section === 'teams' ? 'Start with a team, such as Engineering or Customer Success.' : `Add ${section} to connect your company data.`}</p></div>}
      <Paged as="ul" className="entity-list" size={4} resetKey={`${section}:${search}`} items={company[section].filter(row => row.name.toLowerCase().includes(search.toLowerCase()))}>{row => <li key={row.id}><div><strong>{row.name}</strong><p className="muted">{describe(row)}</p><details className="csv-record-id"><summary>CSV update identifier</summary><code>{row.id}</code></details></div>{!readOnly && <div className="card-controls"><button className="quiet-button" disabled={busy} aria-label={`Edit ${row.name}`} onClick={() => { setEditing(editRecord(section, row)); setRemoving(null); setError(''); }}>Edit</button><button className="quiet-button" disabled={busy} aria-label={`Remove ${row.name}`} onClick={() => { const refs = referencesTo(company, section, row.id); if (refs.length) setError(`Update these connections before removing ${row.name}: ${refs.join(', ')}`); else { setRemoving(row); setError(''); } }}>Remove</button></div>}</li>}</Paged>
      {removing && <div className="remove-confirm" role="group" aria-label="Confirm draft removal"><p>Remove <strong>{removing.name}</strong> from this draft? Past observations are retained.</p><button className="quiet-button" onClick={() => setRemoving(null)}>Keep record</button> <button onClick={() => { setCompany({ ...company, [section]: company[section].filter(r => r.id !== removing.id) }); setRemoving(null); }}>Remove from draft</button></div>}
    </>}
    </div></div>
    {!readOnly && !review && !importing && <div className="editor-footer"><button className="quiet-button" disabled={busy || !!editing} onClick={downloadDraft}>Download draft</button><button className="quiet-button" disabled={busy || !!editing || !undoHistory.length} onClick={() => { setCompanyState(undoHistory.at(-1)); setUndoHistory(old => old.slice(0, -1)); setRemoving(null); setError(''); }}>Undo last change</button><p className="muted">{editing ? 'Finish or cancel this record before reviewing.' : 'Review changes before updating your company’s signals.'}</p><button disabled={busy || !changes.length || !!editing} onClick={() => { setReview(true); setRemoving(null); setError(''); }}>Review {changes.length || ''} changes →</button></div>}
  </section>;
}
