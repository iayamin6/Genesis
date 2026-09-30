/** Additive local demo. Usage: node scripts/seed-demo.mjs <existing-user-id> */
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { User, Workspace, FinancialSnapshot } from '../src/models.js';
import {
  CompanyEvaluation,
  CompanyAction,
  CompanyDecision,
  CompanyScenario,
} from '../src/intelligence/models.js';
import { importSnapshot } from '../src/intelligence/service.js';
import { allSignals } from '../src/intelligence/customers.js';
import { measureOutcome } from '../src/intelligence/engine.js';
import { scenarioInput, simulateScenario } from '../src/intelligence/scenarios.js';
import { MarketObservation } from '../src/intelligence/market.js';
import { CompanyQuestion, answerCompanyQuestion } from '../src/intelligence/company-questions.js';
import { Connection } from '../src/integrations/models.js';

const now = new Date(),
  day = (n) => new Date(now.getTime() + n * 86400000),
  date = (n) => day(n).toISOString().slice(0, 10);
await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/genesis');
try {
  const user = await User.findById(process.argv[2]);
  if (!user)
    throw new Error('Pass an existing local user ID; this script does not create accounts.');
  const workspace = await Workspace.create({
    name: 'Genesis Demo — Synthetic',
    industry: 'Synthetic B2B SaaS',
    idea: 'SYNTHETIC DEMO: a collaboration platform connecting customer support, delivery planning, and account reporting for small software companies. All customers, employees, competitors, observations, and financial figures in this workspace are fictional.',
    members: [{ userId: user._id, role: 'founder' }],
    competitors: [
      { name: 'OrbitDesk (fictional demo)', url: 'https://example.com/fictional-orbitdesk' },
      { name: 'TeamPilot (fictional demo)', url: 'https://example.com/fictional-teampilot' },
    ],
  });
  const workspaceId = workspace._id,
    createdBy = user._id;
  const base = {
    importKey: 'demo-baseline',
    observedAt: day(-30).toISOString(),
    source: { kind: 'sample', name: 'Synthetic walkthrough — fictional company and measurements' },
    currency: 'USD',
    teams: [
      { id: 'engineering', name: 'Engineering' },
      { id: 'platform', name: 'Platform' },
      { id: 'success', name: 'Customer Success' },
    ],
    employees: [
      {
        id: 'alex',
        name: 'Alex Chen (demo)',
        teamId: 'engineering',
        capacityHours: 40,
        allocatedHours: 38,
      },
      {
        id: 'maya',
        name: 'Maya Rahman (demo)',
        teamId: 'engineering',
        capacityHours: 40,
        allocatedHours: 36,
      },
      {
        id: 'leo',
        name: 'Leo Santos (demo)',
        teamId: 'platform',
        capacityHours: 40,
        allocatedHours: 38,
      },
      {
        id: 'nora',
        name: 'Nora Ali (demo)',
        teamId: 'platform',
        capacityHours: 40,
        allocatedHours: 36,
      },
      {
        id: 'sam',
        name: 'Sam Rivera (demo)',
        teamId: 'success',
        capacityHours: 40,
        allocatedHours: 30,
      },
      {
        id: 'riley',
        name: 'Riley Park (demo)',
        teamId: 'success',
        capacityHours: 40,
        allocatedHours: 25,
      },
    ],
    projects: [
      {
        id: 'sync',
        name: 'Account Sync',
        teamId: 'engineering',
        ownerIds: ['alex', 'maya'],
        dueDate: date(-20),
        completion: 25,
      },
      {
        id: 'analytics',
        name: 'Analytics Refresh',
        teamId: 'engineering',
        ownerIds: ['alex'],
        dueDate: date(7),
        completion: 20,
      },
      {
        id: 'billing',
        name: 'Billing Reliability',
        teamId: 'platform',
        ownerIds: ['leo', 'nora'],
        dueDate: date(-21),
        completion: 35,
      },
      {
        id: 'onboarding',
        name: 'Guided Onboarding',
        teamId: 'success',
        ownerIds: ['sam'],
        dueDate: date(12),
        completion: 30,
      },
    ],
    products: [
      { id: 'workspace', name: 'Workspace Cloud' },
      { id: 'operations', name: 'Operations Suite' },
    ],
    features: [
      { id: 'crm-sync', name: 'CRM Sync', projectId: 'sync', productId: 'workspace' },
      { id: 'reports', name: 'Account Reports', projectId: 'analytics', productId: 'workspace' },
      { id: 'invoices', name: 'Reliable Invoices', projectId: 'billing', productId: 'operations' },
      { id: 'setup', name: 'Guided Setup', projectId: 'onboarding', productId: 'workspace' },
    ],
    customers: [
      {
        id: 'acme',
        name: 'Acme Labs (demo)',
        arrMinor: 12000000,
        featureIds: ['crm-sync', 'reports'],
        requestedFeatureIds: ['reports'],
        renewalDate: date(21),
        accountManagerId: 'sam',
        segment: 'Enterprise',
        activeUsers: 120,
        usageWindowDays: 30,
        paymentOverdueDays: 0,
        outstandingAmountMinor: 0,
        oldestSupportIssueDays: 2,
        openSupportIssues: 2,
      },
      {
        id: 'northstar',
        name: 'Northstar Studio (demo)',
        arrMinor: 7200000,
        featureIds: ['crm-sync', 'invoices'],
        requestedFeatureIds: ['reports'],
        renewalDate: date(38),
        accountManagerId: 'sam',
        segment: 'Enterprise',
        activeUsers: 80,
        usageWindowDays: 30,
        paymentOverdueDays: 0,
        outstandingAmountMinor: 0,
        oldestSupportIssueDays: 1,
        openSupportIssues: 1,
      },
      {
        id: 'river',
        name: 'River Commerce (demo)',
        arrMinor: 4800000,
        featureIds: ['invoices'],
        requestedFeatureIds: ['reports'],
        renewalDate: date(95),
        accountManagerId: 'riley',
        segment: 'Growth',
        activeUsers: 50,
        usageWindowDays: 30,
        paymentOverdueDays: 0,
        oldestSupportIssueDays: 2,
        openSupportIssues: 2,
      },
      {
        id: 'bright',
        name: 'Bright Health (demo)',
        arrMinor: 3600000,
        featureIds: ['setup', 'reports'],
        requestedFeatureIds: ['reports'],
        renewalDate: date(120),
        accountManagerId: 'riley',
        segment: 'Growth',
        activeUsers: 20,
        usageWindowDays: 30,
        paymentOverdueDays: 0,
        oldestSupportIssueDays: 0,
        openSupportIssues: 0,
      },
      {
        id: 'cedar',
        name: 'Cedar Works (demo)',
        arrMinor: 2400000,
        featureIds: ['setup'],
        requestedFeatureIds: ['reports'],
        renewalDate: date(65),
        accountManagerId: 'riley',
        segment: 'SMB',
        openSupportIssues: 0,
      },
      {
        id: 'atlas',
        name: 'Atlas Services (demo)',
        arrMinor: 1800000,
        featureIds: ['invoices', 'setup'],
        requestedFeatureIds: [],
        renewalDate: date(150),
        accountManagerId: 'sam',
        segment: 'SMB',
        activeUsers: 15,
        usageWindowDays: 30,
        paymentOverdueDays: 0,
        oldestSupportIssueDays: 0,
        openSupportIssues: 0,
      },
    ],
  };
  await importSnapshot(workspaceId, base, day(-30));
  const pressure = structuredClone(base);
  pressure.importKey = 'demo-pressure';
  pressure.observedAt = day(-14).toISOString();
  pressure.employees.forEach((e) => {
    e.allocatedHours = { alex: 54, maya: 50, leo: 52, nora: 48, sam: 36, riley: 28 }[e.id];
  });
  pressure.projects.forEach((p) => {
    p.completion = { sync: 45, analytics: 35, billing: 60, onboarding: 50 }[p.id];
  });
  Object.assign(pressure.customers[0], {
    activeUsers: 100,
    openSupportIssues: 5,
    oldestSupportIssueDays: 8,
  });
  Object.assign(pressure.customers[1], {
    activeUsers: 75,
    openSupportIssues: 4,
    oldestSupportIssueDays: 9,
  });
  Object.assign(pressure.customers[2], { openSupportIssues: 6, oldestSupportIssueDays: 10 });
  const earlier = await importSnapshot(workspaceId, pressure, day(-14));
  const actions = [];
  async function actionFrom(evaluation, key, title, ownerId, status, due, reason, expectedResult) {
    const signal = allSignals(evaluation.analysis).find((s) => s.key === key);
    if (!signal) throw new Error(`Demo signal missing: ${key}`);
    const owner = evaluation.snapshot.employees.find((e) => e.id === ownerId);
    const action = await CompanyAction.create({
      workspaceId,
      riskKey: key,
      title,
      ownerId,
      ownerName: owner.name,
      status,
      dueDate: date(due),
      reason,
      expectedResult,
      baseline: signal.evidence,
      baselineObservedAt: evaluation.observedAt,
      customerIds: signal.customers.map((c) => c.id),
      createdBy,
      completedAt: status === 'completed' ? day(-2) : null,
    });
    actions.push(action);
    return action;
  }
  const recovery = await actionFrom(
    earlier,
    'capacity_delivery:platform:billing',
    'Demo: finish the billing recovery sprint',
    'leo',
    'completed',
    -2,
    'Synthetic baseline shows overdue billing delivery and excess planned workload.',
    'Complete billing and reduce customer support issues.',
  );
  await actionFrom(
    earlier,
    'capacity_delivery:engineering:sync',
    'Demo: reduce scope and unblock Account Sync',
    'alex',
    'in_progress',
    5,
    'Two renewing accounts depend on an overdue feature.',
    'Lower weekly allocation and finish the highest-impact sync tasks.',
  );
  const sourceUrl = 'https://example.com/fictional-demo-market-observation';
  await MarketObservation.create({
    workspaceId,
    competitorId: workspace.competitors[0].id,
    competitorName: workspace.competitors[0].name,
    changeType: 'pricing',
    description:
      'SYNTHETIC EXAMPLE, NOT A REAL MARKET CLAIM: fictional OrbitDesk introduces a lower-priced enterprise plan. Use this fixture to inspect account overlap and pricing concerns. The example.com URL is a placeholder, not evidence.',
    sourceUrl,
    observedAt: day(-3),
    segments: ['Enterprise'],
    customerIds: ['acme'],
    createdBy,
  });
  const current = structuredClone(pressure);
  current.importKey = 'demo-current';
  current.observedAt = day(-1).toISOString();
  current.employees.forEach((e) => {
    e.allocatedHours = { alex: 56, maya: 52, leo: 36, nora: 32, sam: 38, riley: 28 }[e.id];
  });
  current.projects.forEach((p) => {
    p.completion = { sync: 65, analytics: 45, billing: 100, onboarding: 70 }[p.id];
  });
  Object.assign(current.customers[0], {
    activeUsers: 65,
    paymentOverdueDays: 12,
    outstandingAmountMinor: 1000000,
    openSupportIssues: 7,
    oldestSupportIssueDays: 16,
    pricingConcern: 'Synthetic account note: evaluating a lower-priced alternative before renewal.',
  });
  Object.assign(current.customers[1], {
    activeUsers: 60,
    openSupportIssues: 3,
    oldestSupportIssueDays: 8,
  });
  Object.assign(current.customers[2], { openSupportIssues: 1, oldestSupportIssueDays: 1 });
  Object.assign(current.customers[3], { activeUsers: 35 });
  const latest = await importSnapshot(workspaceId, current, now);
  await actionFrom(
    latest,
    'customer_health:acme',
    'Demo: review Acme renewal and payment concerns',
    'sam',
    'open',
    -1,
    'Usage declined and an overdue invoice needs an account-owner conversation.',
    'Document renewal context and agree on support and payment follow-up.',
  );
  await actionFrom(
    latest,
    'customer_expansion:bright',
    'Demo: validate Bright Health expansion needs',
    'riley',
    'open',
    10,
    'Comparable synthetic usage windows increased from 20 to 35 active users.',
    'Confirm customer needs before treating engagement growth as revenue.',
  );
  const oldSignal = allSignals(earlier.analysis).find((s) => s.key === recovery.riskKey);
  const decisions = [
    await CompanyDecision.create({
      workspaceId,
      requestId: crypto.randomUUID(),
      title: 'Demo: prioritize billing reliability for one sprint',
      reason: 'Customer support pressure and overdue billing delivery warranted a focused sprint.',
      expectedResult: 'Billing ships and linked support backlog falls.',
      alternatives: 'Keep all projects at equal priority; hire immediately.',
      ownerId: 'leo',
      ownerName: 'Leo Santos (demo)',
      reviewDate: date(-2),
      initialReviewDate: date(-2),
      signalKey: recovery.riskKey,
      signalTitle: oldSignal.title,
      baselineSource: earlier.snapshot.source,
      baseline: oldSignal.evidence,
      baselineObservedAt: earlier.observedAt,
      actionIds: [recovery._id],
      status: 'reviewed',
      createdBy,
      createdByName: user.name,
      reviews: [
        {
          requestId: crypto.randomUUID(),
          source: current.source,
          result: 'achieved',
          actualResult:
            'Synthetic follow-up: billing reached 100%, Platform allocation fell from 100 to 68 hours, and linked support issues decreased.',
          lesson:
            'This fictional before/after example illustrates a cleared rule; it does not establish causality.',
          reviewedBy: createdBy,
          reviewerName: user.name,
          reviewedAt: now,
          observedAt: latest.observedAt,
          evidence: measureOutcome(recovery, latest),
        },
      ],
    }),
    await CompanyDecision.create({
      workspaceId,
      requestId: crypto.randomUUID(),
      title: 'Demo: compare one engineer hire with scope reduction',
      reason: 'Engineering is still overloaded while renewing accounts wait for Account Sync.',
      expectedResult: 'Choose an affordable capacity plan using saved scenarios.',
      alternatives: 'Hire one engineer; defer analytics; keep current staffing.',
      ownerId: 'alex',
      ownerName: 'Alex Chen (demo)',
      reviewDate: date(7),
      initialReviewDate: date(7),
      baselineSource: current.source,
      status: 'open',
      createdBy,
      createdByName: user.name,
    }),
  ];
  let financial;
  for (let i = 0; i < 6; i++)
    financial = await FinancialSnapshot.create({
      workspaceId,
      currency: 'USD',
      cash: 405000 - i * 27000,
      monthlyRevenue: 24000 + i * 1000,
      monthlyExpenses: 50000 + i * 1200,
      recordedAt: day(-151 + i * 30),
    });
  const scenarios = [];
  for (const fixture of [
    {
      name: 'Demo: hire one engineer, ramp over three months',
      hires: 1,
      monthlyCostPerHire: 7000,
      hiringStartMonth: 1,
      teamId: 'engineering',
    },
    { name: 'Demo: lose Acme at renewal', lostCustomerIds: ['acme'] },
    {
      name: 'Demo: Account Sync delayed by 60 days',
      delayedProjectId: 'sync',
      projectDelayDays: 60,
      delayedRevenuePct: 25,
    },
    { name: 'Demo: reduce costs by $5,000 per month', monthlyExpenseDelta: -5000 },
  ]) {
    const input = scenarioInput.parse({
      hires: 0,
      monthlyCostPerHire: 0,
      revenueChangePct: 0,
      monthlyExpenseDelta: 0,
      oneTimeCost: 0,
      lostCustomerIds: [],
      months: 12,
      ...fixture,
    });
    scenarios.push(
      await CompanyScenario.create({
        workspaceId,
        name: input.name,
        assumptions: input,
        result: simulateScenario(financial, current, input),
        createdBy,
      }),
    );
  }
  for (const question of [
    'What needs attention?',
    'What is our runway?',
    'Why is Engineering overloaded?',
    'Which decisions worked?',
  ]) {
    await CompanyQuestion.create({
      workspaceId,
      userId: createdBy,
      question,
      ...answerCompanyQuestion(question, { latest, financial, actions, decisions, scenarios }),
    });
  }
  await Connection.create({
    workspaceId,
    name: 'Demo ingestion — paused, rotate secret before use',
    provider: 'ingestion',
    enabled: false,
    status: 'idle',
    createdBy,
  });
  console.log(
    JSON.stringify({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      observations: await CompanyEvaluation.countDocuments({ workspaceId }),
      employees: current.employees.length,
      teams: current.teams.length,
      projects: current.projects.length,
      customers: current.customers.length,
      actions: actions.length,
      decisions: decisions.length,
      scenarios: scenarios.length,
      financialSnapshots: 6,
      questions: 4,
      recoveredActionOutcome: measureOutcome(recovery, latest).status,
      summary: latest.analysis.summary,
    }),
  );
} finally {
  await mongoose.disconnect();
}
