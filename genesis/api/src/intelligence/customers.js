import { customerHealthSignals } from './customer-health.js';
const DAY = 86400000;
const day = v => Date.parse(`${v.slice(0, 10)}T00:00:00Z`);
export const RULE_VERSION = 'company-signals-v4';
export const allSignals = analysis => [...analysis.risks, ...(analysis.customerSignals || []), ...(analysis.marketSignals || [])];
export function customerSignals(snapshot, evaluatedAt, previous = null) {
  const signals = [], today = day(evaluatedAt);
  const pathsFor = (customer, features) => features.map(f => {
    const p = snapshot.projects.find(p => p.id === f.projectId);
    return { employeeIds: p.ownerIds, teamId: p.teamId, projectId: p.id, featureId: f.id, productId: f.productId, customerId: customer.id, arrMinor: customer.arrMinor };
  });
  const base = customers => ({ customers, paths: [], confidence: 'rule-based; depends on imported data accuracy', evidence: { customerCount: customers.length, arrMinor: customers.reduce((n, c) => n + c.arrMinor, 0), currency: snapshot.currency, supportIssues: customers.reduce((n, c) => n + c.openSupportIssues, 0) } });
  for (const customer of snapshot.customers) {
    const daysToRenewal = customer.renewalDate ? Math.round((day(customer.renewalDate) - today) / DAY) : null;
    const delayedFeatures = snapshot.features.filter(f => customer.featureIds.includes(f.id) && snapshot.projects.some(p => p.id === f.projectId && p.completion < 100 && day(p.dueDate) < today));
    if (daysToRenewal === null || daysToRenewal < 0 || daysToRenewal > 45 || (!customer.openSupportIssues && !delayedFeatures.length)) continue;
    const signal = base([customer]);
    signals.push({ ...signal, key: `renewal_attention:${customer.id}`, category: 'renewal_attention', severity: daysToRenewal <= 14 && customer.openSupportIssues > 0 && delayedFeatures.length ? 'critical' : 'warning', title: `${customer.name} renews in ${daysToRenewal} days`, paths: pathsFor(customer, delayedFeatures), evidence: { ...signal.evidence, daysToRenewal, delayedFeatureCount: delayedFeatures.length, renewalDate: customer.renewalDate }, explanation: `${customer.openSupportIssues} open support issues and ${delayedFeatures.length} overdue feature dependencies coincide with an upcoming renewal.`, consequence: 'Review the account before renewal. Open issues and delays are review signals, not a prediction that this customer will churn.', recommendations: ['Contact the customer to confirm renewal expectations', 'Assign owners to unresolved support and delivery issues'] });
  }
  const paying = snapshot.customers.filter(c => c.arrMinor > 0).sort((a, b) => b.arrMinor - a.arrMinor || a.id.localeCompare(b.id));
  const total = paying.reduce((n, c) => n + c.arrMinor, 0);
  const top = paying.slice(0, 3), topArr = top.reduce((n, c) => n + c.arrMinor, 0);
  if (total > 0 && topArr / total >= 0.5) {
    const signal = base(top);
    signals.push({ ...signal, key: 'customer_concentration', category: 'customer_concentration', severity: 'warning', title: `${top.length} accounts represent ${Math.round(topArr / total * 100)}% of imported ARR`, evidence: { ...signal.evidence, concentrationPct: Math.round(topArr / total * 100), totalArrMinor: total, payingCustomerCount: paying.length }, explanation: 'Revenue is concentrated in the largest imported customer accounts.', consequence: 'Losing a large account could materially affect recurring revenue. This ratio covers the imported accounts only; an incomplete import can overstate concentration.', recommendations: ['Review retention plans for the largest accounts', 'Evaluate ways to diversify the customer base'] });
  }
  for (const feature of snapshot.features) {
    const project = snapshot.projects.find(p => p.id === feature.projectId);
    const customers = snapshot.customers.filter(c => c.requestedFeatureIds?.includes(feature.id));
    if (customers.length < 3 || project.completion === 100) continue;
    const signal = base(customers);
    signals.push({ ...signal, key: `feature_demand:${feature.id}`, category: 'feature_demand', severity: 'opportunity', title: `${customers.length} customers requested ${feature.name}`, paths: customers.flatMap(c => pathsFor(c, [feature])), evidence: { ...signal.evidence, featureId: feature.id, projectId: project.id }, explanation: `Explicit requests converge on ${feature.name}, linked to ${project.name}.`, consequence: 'Compare demand with delivery effort before prioritizing. Connected ARR is existing customer revenue, not forecast expansion or guaranteed new revenue.', recommendations: [`Validate demand and scope for ${feature.name}`, `Review ${project.name} capacity before committing a delivery date`] });
  }
  return [...signals, ...customerHealthSignals(snapshot, previous)];
}

export function customerOutcome(action, latest) {
  const signal = allSignals(latest.analysis).find(s => s.key === action.riskKey);
  if (latest.snapshot.currency !== action.baseline.currency || action.customerIds.some(id => !latest.snapshot.customers.some(c => c.id === id))) return { status: 'unknown', message: 'Customer coverage or currency changed; comparison is unavailable.' };
  if (signal) return { status: signal.severity === 'opportunity' ? 'opportunity_persists' : 'risk_persists', baseline: action.baseline, current: signal.evidence, message: 'The signal remains in the later observation. Compare evidence; this does not establish the action’s effect.' };
  return { status: 'needs_review', message: 'This signal no longer triggers. Confirm the result: a passed renewal date, changed requests, or changed account mix does not prove success.' };
}
