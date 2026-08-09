function normalize(value = '') { return value.toLowerCase().replace(/\s+/g, ' ').trim(); }
export function diffCompetitorSnapshots(previous, current) {
  if (!previous) return { significant: false, changes: [], baseline: true };
  const fields = ['pricing', 'hiring', 'summary']; const changes = fields.flatMap((field) => normalize(previous[field]) !== normalize(current[field]) ? [{ field, before: previous[field] || '', after: current[field] || '' }] : []);
  return { significant: changes.some((x) => x.field === 'pricing' || x.field === 'hiring'), changes, baseline: false };
}
