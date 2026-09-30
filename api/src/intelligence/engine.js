import { marketSignals } from './market.js';
import { analyzeCustomerHealth } from './customer-health.js';
import { analyzeTeams } from './teams.js';
import { customerSignals, customerOutcome, RULE_VERSION } from './customers.js';
const DAY = 86400000;
const day = (v) => Date.parse(`${v.slice(0, 10)}T00:00:00Z`);
export function analyzeCompany(
  snapshot,
  previous = null,
  evaluatedAt = snapshot.observedAt,
  marketObservations = [],
  customerPrevious = previous,
) {
  const events = [],
    risks = [];
  const today = day(evaluatedAt);
  for (const team of snapshot.teams) {
    const employees = snapshot.employees.filter((e) => e.teamId === team.id);
    const capacity = employees.reduce((s, e) => s + e.capacityHours, 0);
    const allocated = employees.reduce((s, e) => s + e.allocatedHours, 0);
    const oldEmployees = previous?.employees.filter((e) => e.teamId === team.id);
    const oldAllocation = oldEmployees?.reduce((s, e) => s + e.allocatedHours, 0);
    const workloadChangePct =
      oldAllocation > 0 &&
      (snapshot.domainsObservedAt?.capacity || snapshot.observedAt) !==
        (previous?.domainsObservedAt?.capacity || previous?.observedAt)
        ? Math.round((allocated / oldAllocation - 1) * 100)
        : null;
    if (allocated <= capacity) continue;
    events.push({
      key: `team_overloaded:${team.id}`,
      type: 'team_overloaded',
      entityId: team.id,
      evidence: { capacityHours: capacity, allocatedHours: allocated, workloadChangePct },
    });
    for (const project of snapshot.projects.filter(
      (p) => p.teamId === team.id && p.completion < 100 && day(p.dueDate) < today,
    )) {
      const delayDays = Math.floor((today - day(project.dueDate)) / DAY);
      events.push({
        key: `project_delayed:${project.id}`,
        type: 'project_delayed',
        entityId: project.id,
        evidence: { dueDate: project.dueDate, completion: project.completion, delayDays },
      });
      const features = snapshot.features.filter((f) => f.projectId === project.id);
      const featureIds = new Set(features.map((f) => f.id));
      const customers = snapshot.customers.filter((c) =>
        c.featureIds.some((id) => featureIds.has(id)),
      );
      if (!customers.length) continue;
      const arrMinor = customers.reduce((s, c) => s + c.arrMinor, 0);
      const renewing = customers.filter(
        (c) =>
          c.renewalDate && day(c.renewalDate) >= today && day(c.renewalDate) <= today + 45 * DAY,
      );
      const supportIssues = customers.reduce((s, c) => s + c.openSupportIssues, 0);
      const priorCustomers =
        previous?.currency === snapshot.currency
          ? previous.customers.filter((c) => customers.some((current) => current.id === c.id))
          : [];
      const priorSupport = priorCustomers?.reduce((s, c) => s + c.openSupportIssues, 0);
      const supportChangePct =
        priorCustomers?.length === customers.length && priorSupport > 0
          ? Math.round((supportIssues / priorSupport - 1) * 100)
          : null;
      const evidence = {
        capacityHours: capacity,
        allocatedHours: allocated,
        workloadChangePct,
        delayDays,
        completion: project.completion,
        customerCount: customers.length,
        arrMinor,
        currency: snapshot.currency,
        supportIssues,
        supportChangePct,
        renewalsWithin45Days: renewing.length,
      };
      risks.push({
        key: `capacity_delivery:${team.id}:${project.id}`,
        category: 'capacity_delivery',
        severity: renewing.length && arrMinor > 0 ? 'critical' : 'warning',
        title: `${team.name} capacity pressure affects ${project.name}`,
        evidence,
        confidence: 'rule-based; depends on imported data accuracy',
        paths: customers.flatMap((c) =>
          features
            .filter((f) => c.featureIds.includes(f.id))
            .map((f) => ({
              employeeIds: project.ownerIds,
              teamId: team.id,
              projectId: project.id,
              featureId: f.id,
              productId: f.productId,
              customerId: c.id,
              arrMinor: c.arrMinor,
            })),
        ),
        customers: customers.map((c) => ({
          id: c.id,
          name: c.name,
          arrMinor: c.arrMinor,
          renewalDate: c.renewalDate,
          openSupportIssues: c.openSupportIssues,
        })),
        explanation: `${team.name} has ${allocated} allocated hours against ${capacity} hours of weekly capacity. ${project.name} is ${delayDays} days overdue and incomplete. ${customers.length} customer accounts depend on its features.`,
        consequence:
          'Continued delivery delays may increase renewal risk for affected customers. Exposure is connected ARR, not a forecast of lost revenue. These observations do not establish that workload caused the delay.',
        recommendations: [
          'Review and reallocate team capacity',
          `Review scope and prioritize delivery of ${project.name}`,
          'Contact affected customers and review upcoming renewals',
        ],
      });
    }
  }
  const customerInsights = customerSignals(snapshot, evaluatedAt, customerPrevious);
  const marketInsights = marketSignals(snapshot, marketObservations, evaluatedAt);
  const attention = [
    ...marketInsights,
    ...risks,
    ...customerInsights.filter((s) => s.severity !== 'opportunity'),
  ];
  const exposedIds = new Set(attention.flatMap((r) => r.customers.map((c) => c.id)));
  return {
    customerHealth: analyzeCustomerHealth(snapshot, customerPrevious),
    teamHealth: analyzeTeams(snapshot, previous, evaluatedAt),
    ruleVersion: RULE_VERSION,
    evaluatedAt,
    observedAt: snapshot.observedAt,
    events,
    risks,
    customerSignals: customerInsights,
    marketSignals: marketInsights,
    summary: {
      riskCount: risks.length,
      attentionCount: attention.length,
      opportunityCount: customerInsights.filter((s) => s.severity === 'opportunity').length,
      exposedCustomers: exposedIds.size,
      exposedArrMinor: snapshot.customers
        .filter((c) => exposedIds.has(c.id))
        .reduce((s, c) => s + c.arrMinor, 0),
      currency: snapshot.currency,
    },
    limitations: [
      'Imported workload represents planned capacity, not employee surveillance.',
      'No statistical probability of churn or causality is estimated.',
      'No baseline means percentage change is unknown.',
    ],
  };
}

export function measureOutcome(action, latest) {
  if (new Date(latest.snapshot.observedAt) <= new Date(action.baselineObservedAt))
    return {
      status: 'awaiting_observation',
      message: 'Import a later observation to measure change.',
    };
  if (!action.riskKey.startsWith('capacity_delivery:')) return customerOutcome(action, latest);
  const risk = latest.analysis.risks.find((r) => r.key === action.riskKey);
  const baseline = action.baseline;
  const [, teamId, projectId] = action.riskKey.split(':');
  if (
    !latest.snapshot.teams.some((t) => t.id === teamId) ||
    !latest.snapshot.projects.some((p) => p.id === projectId)
  )
    return { status: 'unknown', message: 'The team or project is absent from the latest data.' };
  const project = latest.snapshot.projects.find((p) => p.id === projectId);
  const currentFeatures = latest.snapshot.features
    .filter((f) => f.projectId === projectId)
    .map((f) => f.id);
  if (
    project.teamId !== teamId ||
    action.customerIds.some(
      (id) =>
        !latest.snapshot.customers
          .find((c) => c.id === id)
          ?.featureIds.some((f) => currentFeatures.includes(f)),
    )
  )
    return {
      status: 'unknown',
      message: 'Dependency coverage changed; risk disappearance cannot be treated as recovery.',
    };
  const linkedCustomers = latest.snapshot.customers.filter((c) =>
    action.customerIds.includes(c.id),
  );
  if (
    linkedCustomers.length !== action.customerIds.length ||
    latest.snapshot.currency !== baseline.currency
  )
    return {
      status: 'unknown',
      message: 'Customer coverage or currency changed; baseline comparison is unavailable.',
    };
  const employees = latest.snapshot.employees.filter((e) => e.teamId === teamId);
  if (!employees.length)
    return {
      status: 'unknown',
      message: 'Team capacity coverage is missing from the latest data.',
    };
  const current = risk?.evidence || {
    capacityHours: employees.reduce((s, e) => s + e.capacityHours, 0),
    allocatedHours: employees.reduce((s, e) => s + e.allocatedHours, 0),
    delayDays:
      project.completion === 100
        ? 0
        : Math.max(0, Math.floor((day(latest.analysis.evaluatedAt) - day(project.dueDate)) / DAY)),
    completion: project.completion,
    customerCount: linkedCustomers.length,
    arrMinor: linkedCustomers.reduce((s, c) => s + c.arrMinor, 0),
    currency: latest.snapshot.currency,
    supportIssues: linkedCustomers.reduce((s, c) => s + c.openSupportIssues, 0),
  };
  return {
    status: risk ? 'risk_persists' : 'rule_cleared',
    baseline,
    current,
    message: risk
      ? 'The risk rule still triggers. Compare evidence; changes cannot be attributed to this action alone.'
      : 'The risk rule no longer triggers in the later observation. This does not prove the action caused recovery.',
  };
}
