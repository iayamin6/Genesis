export const sections = ['teams', 'employees', 'projects', 'products', 'features', 'customers'];
export const fields = {
  teams: [], products: [],
  employees: [{ key: 'teamId', label: 'Team', relation: 'teams' }, { key: 'capacityHours', label: 'Weekly capacity (hours)', type: 'number', max: 10000 }, { key: 'allocatedHours', label: 'Weekly allocated work (hours)', type: 'number', max: 10000 }],
  projects: [{ key: 'teamId', label: 'Team', relation: 'teams' }, { key: 'ownerIds', label: 'Project owners', relation: 'employees', multiple: true }, { key: 'dueDate', label: 'Due date', type: 'date' }, { key: 'completion', label: 'Completion (%)', type: 'number', max: 100 }],
  features: [{ key: 'productId', label: 'Product', relation: 'products' }, { key: 'projectId', label: 'Delivery project', relation: 'projects' }],
  customers: [{ key: 'accountManagerId', label: 'Account owner', relation: 'employees', optional: true }, { key: 'segment', label: 'Market segment', type: 'text', optional: true }, { key: 'activeUsers', label: 'Active users in measurement window', type: 'number', max: 1000000, step: 1, optional: true }, { key: 'usageWindowDays', label: 'Usage measurement window (days)', type: 'number', max: 365, step: 1, optional: true }, { key: 'paymentOverdueDays', label: 'Payment overdue (days)', type: 'number', max: 1000000, step: 1, optional: true }, { key: 'outstandingAmount', label: 'Outstanding payment amount', type: 'number', max: 1e10, optional: true }, { key: 'oldestSupportIssueDays', label: 'Oldest open issue (days)', type: 'number', max: 1000000, step: 1, optional: true }, { key: 'pricingConcern', label: 'Pricing concern notes', type: 'text', optional: true }, { key: 'arr', label: 'Annual recurring revenue', type: 'number', max: 10000000000 }, { key: 'renewalDate', label: 'Renewal date', type: 'date', optional: true }, { key: 'openSupportIssues', label: 'Open support issues', type: 'number', max: 1000000, step: 1 }, { key: 'featureIds', label: 'Depends on these features', relation: 'features', multiple: true }, { key: 'requestedFeatureIds', label: 'Explicitly requested these features', relation: 'features', multiple: true }],
};
export function emptyCompany() { return { currency: 'USD', source: { kind: 'manual', name: 'Company data editor' }, ...Object.fromEntries(sections.map(s => [s, []])) }; }
export function editRecord(section, record) {
  const value = record ? structuredClone(record) : { id: crypto.randomUUID(), name: '' };
  for (const field of fields[section]) if (value[field.key] === undefined) value[field.key] = field.multiple ? [] : '';
  if (section === 'customers') { value.arr = record ? String(record.arrMinor / 100) : ''; value.outstandingAmount = record?.outstandingAmountMinor === undefined ? '' : String(record.outstandingAmountMinor / 100); }
  return value;
}
export function normalizeRecord(section, input) {
  const record = { id: input.id, name: input.name.trim() };
  if (!record.name) throw new Error('Enter a name.');
  for (const field of fields[section]) {
    const value = input[field.key];
    if (field.optional && (value === '' || value === undefined || value === null)) continue;
    if (field.multiple) { record[field.key] = [...new Set(value || [])]; continue; }
    if (value === '' || value === undefined) throw new Error(`Enter ${field.label.toLowerCase()}.`);
    if (field.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > field.max || (field.step === 1 && !Number.isInteger(number))) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
      if (field.key === 'arr' || field.key === 'outstandingAmount') {
        if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('Enter ARR with no more than two decimal places.');
        record[field.key === 'arr' ? 'arrMinor' : 'outstandingAmountMinor'] = Math.round(number * 100);
      } else record[field.key] = number;
    } else {
      if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`Enter a valid ${field.label.toLowerCase()}.`);
      record[field.key] = value;
    }
  }
  return record;
}
export function referencesTo(company, section, id) {
  return sections.flatMap(s => company[s].flatMap(row => fields[s].filter(f => f.relation === section && (f.multiple ? row[f.key]?.includes(id) : row[f.key] === id)).map(f => `${row.name} (${s}: ${f.label})`)));
}
export function changesBetween(before, after) {
  const changes = [];
  if (before.currency !== after.currency) changes.push({ section: 'company', name: 'Currency', change: `${before.currency} → ${after.currency}` });
  for (const section of sections) {
    const old = new Map(before[section].map(r => [r.id, r]));
    for (const row of after[section]) {
      const previous = old.get(row.id);
      if (!previous) changes.push({ section, name: row.name, change: 'Added' });
      else {
        const changed = [...new Set([...Object.keys(previous), ...Object.keys(row)])].filter(k => JSON.stringify(previous[k]) !== JSON.stringify(row[k]));
        if (changed.length) changes.push({ section, name: row.name, change: `Updated: ${changed.map(k => k === 'name' ? 'name' : k === 'arrMinor' ? 'ARR' : fields[section].find(f => f.key === k)?.label || k).join(', ')}` });
      }
      old.delete(row.id);
    }
    for (const row of old.values()) changes.push({ section, name: row.name, change: 'Removed from new observation' });
  }
  return changes;
}
export function observationFor(company, now = new Date()) {
  const copy = structuredClone(company); delete copy.domainsObservedAt;
  return { ...copy, importKey: `editor-${crypto.randomUUID()}`, observedAt: now.toISOString(), source: company.source.kind === 'sample' ? company.source : { kind: 'manual', name: 'Company data editor' } };
}
