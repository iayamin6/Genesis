import test from 'node:test';
import assert from 'node:assert/strict';
import { customerSignals, customerOutcome } from '../src/intelligence/customers.js';
import { snapshotSchema } from '../src/intelligence/contract.js';
import { analyzeCompany } from '../src/intelligence/engine.js';
function fixture() {
  return {
    importKey: 'customers',
    observedAt: '2026-09-08T00:00:00.000Z',
    source: { kind: 'sample', name: 'Test' },
    currency: 'USD',
    teams: [{ id: 't', name: 'Team' }],
    employees: [{ id: 'e', name: 'Employee', teamId: 't', capacityHours: 40, allocatedHours: 20 }],
    projects: [
      {
        id: 'p',
        name: 'Project',
        teamId: 't',
        ownerIds: ['e'],
        dueDate: '2026-09-01',
        completion: 50,
      },
    ],
    products: [{ id: 'product', name: 'Product' }],
    features: [{ id: 'f', name: 'Feature', projectId: 'p', productId: 'product' }],
    customers: Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`,
      name: `Customer ${i}`,
      arrMinor: 10000,
      featureIds: ['f'],
      openSupportIssues: 1,
      renewalDate: '2026-09-20',
    })),
  };
}
test('renewal attention works without team overload and honors inclusive date boundaries', () => {
  const s = fixture();
  for (const [date, expected] of [
    ['2026-09-07', 0],
    ['2026-09-08', 4],
    ['2026-10-23', 4],
    ['2026-10-24', 0],
  ]) {
    s.customers.forEach((c) => (c.renewalDate = date));
    assert.equal(
      customerSignals(s, s.observedAt).filter((x) => x.category === 'renewal_attention').length,
      expected,
    );
  }
});
test('renewal alone is not a risk; combined near-term issues and delay are critical', () => {
  const s = fixture();
  assert.equal(customerSignals(s, s.observedAt)[0].severity, 'critical');
  s.projects[0].completion = 100;
  s.customers.forEach((c) => (c.openSupportIssues = 0));
  assert.equal(
    customerSignals(s, s.observedAt).filter((x) => x.category === 'renewal_attention').length,
    0,
  );
});
test('concentration uses positive ARR and excludes a zero denominator', () => {
  const s = fixture();
  const signal = customerSignals(s, s.observedAt).find(
    (x) => x.category === 'customer_concentration',
  );
  assert.equal(signal.evidence.concentrationPct, 75);
  assert.equal(signal.evidence.arrMinor, 30000);
  s.customers.forEach((c) => (c.arrMinor = 0));
  assert.equal(
    customerSignals(s, s.observedAt).some((x) => x.category === 'customer_concentration'),
    false,
  );
});
test('opportunities require explicit requests, minimum three customers, and unfinished work', () => {
  const s = fixture(),
    opportunities = () =>
      customerSignals(s, s.observedAt).filter((x) => x.severity === 'opportunity');
  assert.equal(opportunities().length, 0);
  s.customers.slice(0, 2).forEach((c) => (c.requestedFeatureIds = ['f']));
  assert.equal(opportunities().length, 0);
  s.customers[2].requestedFeatureIds = ['f'];
  assert.equal(opportunities()[0].evidence.arrMinor, 30000);
  assert.equal(opportunities()[0].paths.length, 3);
  s.projects[0].completion = 100;
  assert.equal(opportunities().length, 0);
});
test('new optional request relationships validate without breaking old imports', () => {
  const s = fixture();
  assert.equal(snapshotSchema.safeParse(s).success, true);
  s.customers[0].requestedFeatureIds = ['missing'];
  assert.equal(snapshotSchema.safeParse(s).success, false);
  s.customers[0].requestedFeatureIds = ['f', 'f'];
  assert.equal(snapshotSchema.safeParse(s).success, false);
});
test('attention summary deduplicates customer exposure across overlapping customer signals', () => {
  const s = fixture();
  s.customers.forEach((c) => (c.requestedFeatureIds = ['f']));
  const analysis = analyzeCompany(s);
  assert.equal(analysis.summary.exposedArrMinor, 40000);
  assert.equal(analysis.summary.attentionCount, 5);
  assert.equal(analysis.summary.opportunityCount, 1);
});
test('passed renewal and missing customers cannot be claimed as action success', () => {
  const s = fixture();
  const action = {
    riskKey: 'renewal_attention:c0',
    customerIds: ['c0'],
    baseline: { currency: 'USD' },
  };
  let latest = { snapshot: s, analysis: analyzeCompany(s) };
  assert.equal(customerOutcome(action, latest).status, 'risk_persists');
  latest.analysis = analyzeCompany(s, null, '2026-10-01T00:00:00.000Z');
  assert.equal(customerOutcome(action, latest).status, 'needs_review');
  s.customers.shift();
  assert.equal(customerOutcome(action, latest).status, 'unknown');
});
