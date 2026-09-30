const DAY = 86400000;
const day = value => Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
export function analyzeTeams(snapshot, previous = null, evaluatedAt = snapshot.observedAt) {
  const today = day(evaluatedAt);
  const teams = snapshot.teams.map(team => {
    const members = snapshot.employees.filter(e => e.teamId === team.id);
    const activeProjects = snapshot.projects.filter(p => p.teamId === team.id && p.completion < 100);
    const capacityHours = members.reduce((n, e) => n + e.capacityHours, 0);
    const allocatedHours = members.reduce((n, e) => n + e.allocatedHours, 0);
    const priorMembers = previous?.employees.filter(e => e.teamId === team.id) || [];
    const freshCapacity = (snapshot.domainsObservedAt?.capacity || snapshot.observedAt) !== (previous?.domainsObservedAt?.capacity || previous?.observedAt);
    const sameMembership = freshCapacity && !!previous && members.length > 0 && priorMembers.length === members.length && members.every(e => priorMembers.some(p => p.id === e.id));
    const priorAllocation = priorMembers.reduce((n, e) => n + e.allocatedHours, 0);
    const employees = members.map(e => {
      const owned = activeProjects.filter(p => p.ownerIds.includes(e.id));
      return { ...e, excessHours: Math.max(0, e.allocatedHours - e.capacityHours), availableHours: Math.max(0, e.capacityHours - e.allocatedHours), ownedProjectIds: owned.map(p => p.id), soleOwnerProjectIds: owned.filter(p => p.ownerIds.length === 1).map(p => p.id), ownershipSharePct: activeProjects.length ? Math.round(owned.length / activeProjects.length * 100) : 0 };
    });
    const flags = [];
    if (!members.length) flags.push({ kind: 'missing_capacity', title: 'No employee capacity is recorded for this team.' });
    employees.filter(e => e.excessHours > 0).forEach(e => flags.push({ kind: 'employee_overload', employeeId: e.id, title: `${e.name} has ${e.excessHours} hours above planned capacity.` }));
    employees.filter(e => e.ownedProjectIds.length >= 2 && e.ownershipSharePct >= 50).forEach(e => flags.push({ kind: 'ownership_concentration', employeeId: e.id, title: `${e.name} owns or co-owns ${e.ownedProjectIds.length} of ${activeProjects.length} active projects.` }));
    const projects = activeProjects.map(p => {
      const daysUntilDue = Math.round((day(p.dueDate) - today) / DAY);
      const features = snapshot.features.filter(f => f.projectId === p.id);
      const featureIds = new Set(features.map(f => f.id));
      const customers = snapshot.customers.filter(c => c.featureIds.some(id => featureIds.has(id)));
      const projectFlags = [];
      if (daysUntilDue < 0) projectFlags.push({ kind: 'overdue', title: `${p.name} is ${-daysUntilDue} days overdue.` });
      else if (daysUntilDue <= 14 && p.completion < 75) projectFlags.push({ kind: 'deadline_pressure', title: `${p.name} is due in ${daysUntilDue} days at ${p.completion}% complete.` });
      if (!p.ownerIds.length) projectFlags.push({ kind: 'unowned_project', title: `${p.name} has no recorded owner.` });
      if (p.ownerIds.length === 1) projectFlags.push({ kind: 'sole_owner', title: `${p.name} has one recorded owner; review backup coverage.` });
      flags.push(...projectFlags.map(f => ({ ...f, projectId: p.id })));
      return { ...p, daysUntilDue, features: features.map(f => ({ id: f.id, name: f.name })), customers, arrMinor: customers.reduce((n, c) => n + c.arrMinor, 0), flags: projectFlags };
    });
    const customerIds = new Set(projects.flatMap(p => p.customers.map(c => c.id)));
    const customers = snapshot.customers.filter(c => customerIds.has(c.id));
    const excessHours = employees.reduce((n, e) => n + e.excessHours, 0);
    const availableHours = employees.reduce((n, e) => n + e.availableHours, 0);
    const recommendations = [];
    if (excessHours && availableHours) recommendations.push('Review whether available capacity can help overloaded colleagues. Match skills and commitments before reallocating work.');
    else if (excessHours) recommendations.push('Review scope and priorities before adding commitments; recorded demand exceeds some employees’ capacity.');
    if (flags.some(f => f.kind === 'ownership_concentration' || f.kind === 'sole_owner')) recommendations.push('Document handoffs and identify backup owners for critical work.');
    if (flags.some(f => f.kind === 'overdue' || f.kind === 'deadline_pressure')) recommendations.push('Review approaching or missed deadlines with project owners and contact affected customers.');
    if (flags.some(f => f.kind === 'unowned_project')) recommendations.push('Assign accountable owners to unowned projects.');
    if (!members.length) recommendations.push('Add team members and planned weekly capacity before interpreting workload.');
    return { id: team.id, name: team.name, capacityHours, allocatedHours, excessHours, availableHours, netOverloadHours: Math.max(0, allocatedHours - capacityHours), utilizationPct: capacityHours > 0 ? Math.round(allocatedHours / capacityHours * 100) : null, workloadChangePct: sameMembership && priorAllocation > 0 ? Math.round((allocatedHours / priorAllocation - 1) * 100) : null, baselineReason: !previous ? 'No earlier observation' : !freshCapacity ? 'No new capacity measurement' : !sameMembership ? 'Team membership changed or is missing' : priorAllocation <= 0 ? 'Earlier allocation is zero' : null, employees, projects, customers, arrMinor: customers.reduce((n, c) => n + c.arrMinor, 0), flags, recommendations };
  });
  return { evaluatedAt, observedAt: snapshot.observedAt, previousObservedAt: previous?.observedAt || null, currency: snapshot.currency, teams, rules: { deadlineDays: 14, completionThreshold: 75, ownershipSharePct: 50, minimumOwnedProjects: 2 }, limitations: ['Workload uses planned weekly hours, not surveillance or performance scores.', 'Available hours do not imply interchangeable skills or immediate availability.', 'Ownership counts reflect recorded assignments, not measured effort or proven dependency risk.', 'Customer ARR is deduplicated within each team and excludes explicit requests without dependencies. Team totals can overlap and must not be summed as company exposure.'] };
}
