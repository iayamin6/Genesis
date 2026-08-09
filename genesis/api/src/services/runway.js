export function calculateRunway({ cash, monthlyRevenue = 0, monthlyExpenses }) {
  const netBurn = monthlyExpenses - monthlyRevenue;
  if (netBurn <= 0) return { netBurn, runwayMonths: null, status: 'cash_flow_positive' };
  return { netBurn, runwayMonths: Math.floor((cash / netBurn) * 10) / 10, status: 'burning_cash' };
}

export function detectBurnAnomaly(snapshots, threshold = 0.25) {
  if (snapshots.length < 3) return { anomalous: false, reason: 'Insufficient history' };
  const burns = snapshots.map((x) => x.monthlyExpenses - x.monthlyRevenue);
  const current = burns[0]; const baseline = burns.slice(1).reduce((a, b) => a + b, 0) / (burns.length - 1);
  const change = baseline === 0 ? 0 : (current - baseline) / Math.abs(baseline);
  return { anomalous: change >= threshold, change, currentBurn: current, baselineBurn: baseline };
}

export function forecastScenarios(snapshot, changes = []) {
  return changes.map(({ name, cashDelta = 0, revenueDelta = 0, expenseDelta = 0 }) => ({ name, ...calculateRunway({ cash: snapshot.cash + cashDelta, monthlyRevenue: snapshot.monthlyRevenue + revenueDelta, monthlyExpenses: snapshot.monthlyExpenses + expenseDelta }) }));
}
