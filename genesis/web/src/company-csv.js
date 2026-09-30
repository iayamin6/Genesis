import { fields, editRecord, normalizeRecord } from './company-data.js';
export const csvFields = section => [{ key: 'id', label: 'Record ID (optional)' }, { key: 'name', label: 'Name', required: true }, ...fields[section].map(f => ({ ...f, required: !f.optional && !f.multiple }))];
export function parseCsv(text, delimiter = ',') {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  const pushRow = () => { pushCell(); if (row.some(v => v !== '')) rows.push(row); row = []; if (rows.length > 1001) throw new Error('Use at most 1,000 data rows per file.'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; continue; }
    if (c === delimiter) pushCell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (c === '"') { if (cell || closed) throw new Error('Unexpected quote. Put quotes around the entire field.'); quoted = true; }
    else { if (closed && c.trim()) throw new Error('Unexpected text after a closing quote.'); if (!closed) cell += c; }
  }
  if (quoted) throw new Error('A quoted field is missing its closing quote.');
  if (cell || row.length || closed) pushRow();
  if (rows.length < 2) throw new Error('Include a header row and at least one data row.');
  const headers = rows.shift();
  if (headers.some(h => !h) || new Set(headers.map(h => h.toLowerCase())).size !== headers.length) throw new Error('Column headers must be nonempty and unique.');
  if (headers.length > 50) throw new Error('Use at most 50 columns.');
  rows.forEach((r, i) => { if (r.length !== headers.length) throw new Error(`Data row ${i + 1} has ${r.length} fields; the header has ${headers.length}. Check the separator and quoted fields.`); });
  return { headers, rows };
}
export function suggestMapping(section, headers) {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.fromEntries(csvFields(section).map(f => [f.key, headers.find(h => normalize(h) === normalize(f.key) || normalize(h) === normalize(f.label)) || '']));
}
function resolveReference(company, relation, value) {
  const direct = company[relation].find(r => r.id === value);
  if (direct) return direct.id;
  const matching = company[relation].filter(r => r.name.toLowerCase() === value.toLowerCase());
  if (matching.length !== 1) throw new Error(`${relation}: “${value}” ${matching.length ? 'matches more than one record; use its ID' : 'was not found; add it first'}.`);
  return matching[0].id;
}
export function prepareCsvImport(company, section, parsed, mapping) {
  const errors = [], changes = [], ids = new Set(), newNames = new Set();
  const selected = Object.values(mapping).filter(Boolean);
  if (new Set(selected).size !== selected.length) return { errors: [{ row: 'Mapping', message: 'Map each source column only once.' }], changes: [] };
  if (!mapping.name) return { errors: [{ row: 'Mapping', message: 'Map the name column.' }], changes: [] };
  parsed.rows.forEach((cells, index) => {
    try {
      const values = Object.fromEntries(Object.entries(mapping).filter(([, h]) => h).map(([key, header]) => [key, cells[parsed.headers.indexOf(header)]]));
      if (Object.values(values).some(v => v === undefined)) throw new Error('A mapped column is no longer available.');
      const providedId = values.id;
      if (providedId && !/^[a-zA-Z0-9_-]{1,80}$/.test(providedId)) throw new Error('Record IDs must use 1–80 letters, digits, underscores or hyphens.');
      const existing = providedId ? company[section].find(r => r.id === providedId) : null;
      if (!providedId && company[section].some(r => r.name.toLowerCase() === values.name.toLowerCase())) throw new Error('This name already exists. Map its record ID to update it instead of creating a duplicate.');
      if (!existing && newNames.has(values.name.toLowerCase())) throw new Error('A new record with this name is repeated in the file.');
      const input = { ...editRecord(section, existing), ...values };
      if (!providedId) input.id = crypto.randomUUID();
      if (ids.has(input.id)) throw new Error('Record ID is repeated in this file.');
      for (const field of fields[section]) {
        if (!mapping[field.key] || !field.relation) continue;
        const value = values[field.key];
        if (field.optional && !value) { input[field.key] = ''; continue; }
        input[field.key] = field.multiple ? value.split('|').map(v => v.trim()).filter(Boolean).map(v => resolveReference(company, field.relation, v)) : resolveReference(company, field.relation, value);
        if (field.multiple && input[field.key].length > 100) throw new Error(`Use at most 100 ${field.label.toLowerCase()}.`);
      }
      const record = normalizeRecord(section, input);
      if (record.name.length > 160) throw new Error('Names must be at most 160 characters.');
      if (section === 'employees' && company.projects.some(p => p.ownerIds.includes(record.id) && p.teamId !== record.teamId)) throw new Error('Changing this employee’s team conflicts with existing project ownership. Update project owners first.');
      if (section === 'projects' && record.ownerIds.some(id => company.employees.find(e => e.id === id)?.teamId !== record.teamId)) throw new Error('Every project owner must belong to the selected team.');
      ids.add(record.id); if (!existing) newNames.add(record.name.toLowerCase());
      changes.push({ record, operation: existing ? 'Update' : 'Add', row: index + 1 });
    } catch (e) { errors.push({ row: index + 1, message: e.message }); }
  });
  const limit = { teams: 100, employees: 500, projects: 300, products: 100, features: 500, customers: 1000 }[section];
  if (company[section].length + changes.filter(c => c.operation === 'Add').length > limit) errors.push({ row: 'File', message: `This import exceeds the ${limit} ${section} limit.` });
  return { errors, changes };
}
export function applyCsvImport(company, section, preview) {
  if (preview.errors.length) throw new Error('Resolve import issues first.');
  const records = new Map(company[section].map(r => [r.id, r]));
  preview.changes.forEach(c => records.set(c.record.id, c.record));
  return { ...company, [section]: [...records.values()] };
}
export function downloadCsvTemplate(section) {
  const csv = csvFields(section).map(f => f.key).join(',') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `genesis-${section}-template.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
