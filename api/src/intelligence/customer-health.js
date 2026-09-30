export function analyzeCustomerHealth(snapshot, previous) {
  return snapshot.customers.map((c) => {
    const before = previous?.customers.find((p) => p.id === c.id);
    const comparable =
      c.activeUsers !== undefined &&
      before?.activeUsers > 0 &&
      c.usageWindowDays !== undefined &&
      c.usageWindowDays === before.usageWindowDays;
    const usageChangePct = comparable
      ? Math.round((c.activeUsers / before.activeUsers - 1) * 100)
      : null;
    const flags = [];
    if (usageChangePct !== null && usageChangePct <= -20)
      flags.push('Usage decreased at least 20% across comparable observation windows');
    if ((c.paymentOverdueDays || 0) > 0)
      flags.push(`Payment is ${c.paymentOverdueDays} days overdue`);
    if ((c.oldestSupportIssueDays || 0) >= 7 && c.openSupportIssues > 0)
      flags.push('An open support issue is at least seven days old');
    if (c.pricingConcern) flags.push('A pricing concern has been recorded');
    return {
      ...c,
      usageChangePct,
      flags,
      previousObservedAt: comparable
        ? previous.domainsObservedAt?.customers || previous.observedAt
        : null,
      coverage: {
        usage: c.activeUsers !== undefined && c.usageWindowDays !== undefined,
        payments: c.paymentOverdueDays !== undefined,
        supportAge: c.oldestSupportIssueDays !== undefined,
      },
      accountManagerName: snapshot.employees.find((e) => e.id === c.accountManagerId)?.name || null,
    };
  });
}
export function customerHealthSignals(snapshot, previous) {
  return analyzeCustomerHealth(snapshot, previous).flatMap((c) => {
    const opportunity =
      !c.flags.length &&
      c.usageChangePct >= 30 &&
      (previous?.customers.find((p) => p.id === c.id)?.activeUsers || 0) >= 10;
    if (!c.flags.length && !opportunity) return [];
    const features = snapshot.features.filter((f) => c.featureIds.includes(f.id));
    return [
      {
        key: `${opportunity ? 'customer_expansion' : 'customer_health'}:${c.id}`,
        category: opportunity ? 'customer_expansion' : 'customer_health',
        severity: opportunity ? 'opportunity' : c.flags.length >= 2 ? 'critical' : 'warning',
        title: opportunity
          ? `${c.name} shows growing product engagement`
          : `${c.name} needs an account health review`,
        customers: [c],
        paths: features.map((f) => {
          const p = snapshot.projects.find((p) => p.id === f.projectId);
          return {
            employeeIds: p.ownerIds,
            teamId: p.teamId,
            projectId: p.id,
            productId: f.productId,
            featureId: f.id,
            customerId: c.id,
          };
        }),
        evidence: {
          currency: snapshot.currency,
          arrMinor: c.arrMinor,
          customerCount: 1,
          supportIssues: c.openSupportIssues,
          usageChangePct: c.usageChangePct,
          activeUsers: c.activeUsers,
          paymentOverdueDays: c.paymentOverdueDays,
          outstandingAmountMinor: c.outstandingAmountMinor,
          healthFlags: c.flags.length,
        },
        confidence: 'rule-based; missing metrics remain unknown',
        explanation: opportunity
          ? `Active users increased ${c.usageChangePct}% over comparable ${c.usageWindowDays}-day measurement windows.`
          : c.flags.join('. ') + '.',
        consequence: opportunity
          ? 'Confirm whether engagement reflects an expansion need. This is not forecast revenue.'
          : 'Combined observations warrant account review; they are not a predicted churn probability.',
        recommendations: opportunity
          ? ['Ask the account owner to validate expansion needs']
          : [
              'Contact the account owner and confirm customer context',
              'Resolve overdue payments and support issues where applicable',
            ],
      },
    ];
  });
}
