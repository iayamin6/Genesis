// Transparent linear extrapolation, deliberately gated on comparable history.
export function historicalForecast(records) {
  if (!records.length || !records[0].currency) return { available: false, reason: 'Save financial observations with a currency first.' };
  const currency = records[0].currency;
  const byDay = new Map();
  for (const r of records) if (r.currency === currency && !byDay.has(new Date(r.recordedAt).toISOString().slice(0, 10))) byDay.set(new Date(r.recordedAt).toISOString().slice(0, 10), r);
  const samples = [...byDay.values()].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  if (samples.length < 3 || new Date(samples.at(-1).recordedAt) - new Date(samples[0].recordedAt) < 60 * 86400000) return { available: false, reason: 'At least three dated observations in one currency spanning 60 days are needed. Same-day updates do not count as historical coverage.' };
  const latest = samples.at(-1), dates = samples.map(s => (new Date(s.recordedAt) - new Date(samples[0].recordedAt)) / (30 * 86400000));
  const meanX = dates.reduce((a, b) => a + b, 0) / dates.length;
  const slope = key => { const meanY = samples.reduce((n, s) => n + s[key], 0) / samples.length; const denominator = dates.reduce((n, x) => n + (x - meanX) ** 2, 0); return samples.reduce((n, s, i) => n + (dates[i] - meanX) * (s[key] - meanY), 0) / denominator; };
  const revenueSlope = slope('monthlyRevenue'), expenseSlope = slope('monthlyExpenses');
  let cash = latest.cash;
  const timeline = Array.from({ length: 6 }, (_, i) => { const month = i + 1; const revenue = Math.max(0, latest.monthlyRevenue + revenueSlope * month), expenses = Math.max(0, latest.monthlyExpenses + expenseSlope * month); cash += revenue - expenses; return { month, monthlyRevenue: Math.round(revenue * 100) / 100, monthlyExpenses: Math.round(expenses * 100) / 100, cash: Math.round(cash * 100) / 100 }; });
  return { available: true, currency, sampleCount: samples.length, firstObservedAt: samples[0].recordedAt, lastObservedAt: latest.recordedAt, timeline, method: 'Least-squares monthly slopes of recorded revenue and expenses, anchored to the latest values; negative revenue/expenses are floored at zero.', limitations: 'Historical trend extrapolation is not a validated forecast or confidence interval. No seasonality, hiring effects, financing, or customer-level events are included.' };
}
