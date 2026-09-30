export const graphKinds = ['teams', 'employees', 'projects', 'products', 'features', 'customers'];
export const nodeKey = (kind, id) => `${kind}:${id}`;
export function buildCompanyGraph(snapshot) {
  const nodes = new Map(), incoming = new Map(), outgoing = new Map();
  for (const kind of graphKinds) for (const record of snapshot[kind]) {
    const key = nodeKey(kind, record.id);
    nodes.set(key, { key, kind, record }); incoming.set(key, []); outgoing.set(key, []);
  }
  const connect = (fromKind, fromId, toKind, toId, label, request = false) => {
    const from = nodeKey(fromKind, fromId), to = nodeKey(toKind, toId);
    if (!nodes.has(from) || !nodes.has(to)) return;
    const edge = { from, to, label, request, key: `${from}/${label}/${to}` };
    outgoing.get(from).push(edge); incoming.get(to).push(edge);
  };
  snapshot.employees.forEach(e => connect('teams', e.teamId, 'employees', e.id, 'Team member'));
  snapshot.projects.forEach(p => { connect('teams', p.teamId, 'projects', p.id, 'Responsible team'); p.ownerIds.forEach(id => connect('employees', id, 'projects', p.id, 'Project owner')); });
  snapshot.features.forEach(f => { connect('projects', f.projectId, 'features', f.id, 'Delivers feature'); connect('products', f.productId, 'features', f.id, 'Part of product'); });
  snapshot.customers.forEach(c => { if (c.accountManagerId) connect('employees', c.accountManagerId, 'customers', c.id, 'Account manager'); c.featureIds.forEach(id => connect('features', id, 'customers', c.id, 'Customer depends on feature')); (c.requestedFeatureIds || []).forEach(id => connect('features', id, 'customers', c.id, 'Customer requested feature', true)); });
  return { nodes, incoming, outgoing };
}
export function downstreamCustomers(graph, key, includeRequests = false) {
  const visited = new Set(), customers = new Map(), pending = [key];
  while (pending.length) {
    const next = pending.pop(); if (visited.has(next)) continue; visited.add(next);
    const node = graph.nodes.get(next); if (!node) continue;
    if (node.kind === 'customers') customers.set(node.record.id, node.record);
    for (const edge of graph.outgoing.get(next)) if (!edge.request || includeRequests) pending.push(edge.to);
  }
  return [...customers.values()].sort((a, b) => b.arrMinor - a.arrMinor || a.name.localeCompare(b.name));
}
export function signalsForNode(signals, node) {
  const fields = { teams: 'teamId', projects: 'projectId', products: 'productId', features: 'featureId', customers: 'customerId' };
  return signals.filter(signal => node.kind === 'employees' && signal.customers.some(c => c.accountManagerId === node.record.id) || node.kind === 'customers' && signal.customers.some(c => c.id === node.record.id) || signal.paths.some(path => node.kind === 'employees' ? path.employeeIds.includes(node.record.id) : path[fields[node.kind]] === node.record.id));
}
