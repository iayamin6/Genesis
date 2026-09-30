import { z } from 'zod';
import { calculateRunway } from '../services/runway.js';
export const scenarioInput = z.object({
  name: z.string().trim().min(1).max(160),
  hires: z.number().int().min(0).max(1000),
  monthlyCostPerHire: z.number().finite().min(0).max(10000000),
  revenueChangePct: z.number().finite().min(-100).max(500),
  monthlyExpenseDelta: z.number().finite().min(-1e12).max(1e12),
  oneTimeCost: z.number().finite().min(0).max(1e12),
  lostCustomerIds: z.array(z.string().min(1).max(80)).max(1000),
  months: z.number().int().min(3).max(36).default(12),
  hiringStartMonth: z.number().int().min(0).max(24).default(0),
  rampMonths: z.number().int().min(1).max(12).default(3),
  weeklyHoursPerHire: z.number().min(0).max(80).default(40),
  teamId: z.string().max(80).optional(),
  delayedProjectId: z.string().max(80).optional(),
  projectDelayDays: z.number().int().min(0).max(365).default(0),
  delayedRevenuePct: z.number().min(0).max(100).default(0),
}).strict();
const round = v => Math.round(v * 100) / 100;
const invalid = message => Object.assign(new Error(message), { status: 400 });
export function simulateScenario(finance, company, input) {
  if (!finance?.currency) throw invalid('Save a financial baseline with an explicit currency before planning scenarios.');
  if (input.hires > 0 && input.monthlyCostPerHire <= 0) throw invalid('Enter a positive monthly cost per hire.');
  const ids = [...new Set(input.lostCustomerIds)];
  if (ids.length && (!company || company.currency !== finance.currency)) throw invalid('Customer and financial currencies must match. No automatic currency conversion is applied.');
  const customers = (company?.customers || []).filter(c => ids.includes(c.id));
  if (customers.length !== ids.length) throw invalid('A selected customer is no longer in the latest company observation.');
  const lostMonthlyRevenue = round(customers.reduce((n, c) => n + c.arrMinor, 0) / 1200);
  if (lostMonthlyRevenue > finance.monthlyRevenue) throw invalid('Selected customer ARR exceeds the monthly revenue baseline. Reconcile the two datasets before modeling this loss.');
  const hiringCost = round(input.hires * input.monthlyCostPerHire);
  const monthlyRevenue = round((finance.monthlyRevenue - lostMonthlyRevenue) * (1 + input.revenueChangePct / 100));
  const monthlyExpenses = round(finance.monthlyExpenses + hiringCost + input.monthlyExpenseDelta);
  if (monthlyExpenses < 0) throw invalid('Expense reductions cannot exceed total monthly expenses including new hires.');
  const cash = round(finance.cash - input.oneTimeCost);
  const runway = cash < 0 ? { netBurn: monthlyExpenses - monthlyRevenue, runwayMonths: 0, status: 'funding_gap' } : calculateRunway({ cash, monthlyRevenue, monthlyExpenses });
  const baseline = { cash: finance.cash, monthlyRevenue: finance.monthlyRevenue, monthlyExpenses: finance.monthlyExpenses, ...calculateRunway(finance) };
  const projected = { cash, monthlyRevenue, monthlyExpenses, ...runway, immediateFundingGap: Math.max(0, -cash) };
  const team = input.teamId ? company?.teams.find(t => t.id === input.teamId) : null;
  const project = input.delayedProjectId ? company?.projects.find(p => p.id === input.delayedProjectId) : null;
  if (input.teamId && !team) throw invalid('Selected team is no longer available');
  if (input.delayedProjectId && (!project || project.completion === 100)) throw invalid('Select an unfinished project for delay assumptions');
  if (input.delayedRevenuePct > 0 && (!project || input.projectDelayDays === 0)) throw invalid('A revenue delay needs a selected project and positive delay days');
  if (input.delayedRevenuePct > 0 && company.currency !== finance.currency) throw invalid('Project/customer and financial currencies must match');
  const featureIds = new Set((company?.features || []).filter(f => f.projectId === project?.id).map(f => f.id));
  const delayedCustomers = (company?.customers || []).filter(c => !ids.includes(c.id) && c.featureIds.some(id => featureIds.has(id)));
  const delayedMonthlyRevenue = round(delayedCustomers.reduce((n, c) => n + c.arrMinor, 0) / 1200 * input.delayedRevenuePct / 100);
  if (delayedMonthlyRevenue > monthlyRevenue) throw invalid('Assumed delayed revenue exceeds remaining monthly revenue');
  const teamMembers = (company?.employees || []).filter(e => e.teamId === team?.id);
  const baseCapacity = teamMembers.reduce((n, e) => n + e.capacityHours, 0), allocated = teamMembers.reduce((n, e) => n + e.allocatedHours, 0);
  let balance = cash, depletion = cash < 0 ? 0 : null;
  const timeline = [{ month: 0, baselineCash: finance.cash, scenarioCash: cash, effectiveWeeklyCapacity: team ? baseCapacity : null }];
  for (let month = 1; month <= input.months; month++) {
    const before = balance;
    const hireExpense = month > input.hiringStartMonth ? hiringCost : 0;
    const revenueDeferral = project && month <= Math.ceil(input.projectDelayDays / 30) ? delayedMonthlyRevenue : 0;
    const expenses = finance.monthlyExpenses + input.monthlyExpenseDelta + hireExpense;
    if (expenses < 0) throw invalid('Expense reductions exceed expenses before hiring begins');
    balance = round(balance + monthlyRevenue - revenueDeferral - expenses);
    if (depletion === null && balance <= 0 && before > balance) depletion = round(month - 1 + Math.max(0, before) / (before - balance));
    const ramp = Math.min(1, Math.max(0, (month - input.hiringStartMonth) / input.rampMonths));
    timeline.push({ month, baselineCash: round(finance.cash + month * (finance.monthlyRevenue - finance.monthlyExpenses)), scenarioCash: balance, monthlyRevenue: round(monthlyRevenue - revenueDeferral), monthlyExpenses: round(expenses), effectiveWeeklyCapacity: team ? round(baseCapacity + input.hires * input.weeklyHoursPerHire * ramp) : null });
  }
  projected.runwayMonths = depletion;
  projected.horizonNotDepleted = depletion === null;
  projected.netBurn = round(timeline.at(-1).monthlyExpenses - timeline.at(-1).monthlyRevenue);
  projected.monthlyExpenses = timeline.at(-1).monthlyExpenses;
  projected.monthlyRevenue = timeline.at(-1).monthlyRevenue;
  const operational = { teamName: team?.name, allocatedHours: team ? allocated : null, baselineCapacity: team ? baseCapacity : null, finalCapacity: team ? timeline.at(-1).effectiveWeeklyCapacity : null, projectName: project?.name, originalDueDate: project?.dueDate, assumedDueDate: project ? new Date(Date.parse(project.dueDate) + input.projectDelayDays * 86400000).toISOString().slice(0, 10) : null, delayedMonthlyRevenue, delayedCustomers: delayedCustomers.map(c => ({ id: c.id, name: c.name })) };
  return { currency: finance.currency, baseline, projected, timeline, operational, lostMonthlyRevenue, hiringCost, customers: customers.map(c => ({ id: c.id, name: c.name, arrMinor: c.arrMinor })), financialObservedAt: finance.recordedAt, companyObservedAt: company?.observedAt, companySource: company?.source, assumptions: [
    'Revenue and other expense adjustments start immediately. Hire costs begin after the specified hiring start month; team capacity ramps linearly.',
    'Lost customer revenue equals recorded ARR divided by 12; collections timing is not modeled.',
    'Revenue change is a one-time percentage adjustment to the remaining monthly revenue, not compounded monthly growth.',
    'Weekly capacity per hire and ramp duration are user assumptions, not measured productivity. Existing workload is held constant. No project completion is predicted.',
    'One-time costs reduce starting cash immediately. Negative chart balances show a funding shortfall, not available spending money.',
    'Project-delay revenue effects use an explicit fraction of linked customer ARR/12 for each started 30-day delay period; lost customers are excluded. No later catch-up collections are assumed.',
    'Scenario runway is the first interpolated cash depletion within the chosen horizon. If absent, the result means only no depletion within that horizon.',
    'This is a deterministic what-if calculation, not a probability-weighted forecast. Taxes, financing, seasonality and other working-capital timing are not modeled.',
  ] };
}
