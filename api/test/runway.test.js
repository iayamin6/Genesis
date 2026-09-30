import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRunway, detectBurnAnomaly } from '../src/services/runway.js';

test('runway is cash divided by net burn', () =>
  assert.deepEqual(
    calculateRunway({ cash: 120000, monthlyRevenue: 20000, monthlyExpenses: 40000 }),
    { netBurn: 20000, runwayMonths: 6, status: 'burning_cash' },
  ));
test('positive cash flow is not represented as a finite runway', () =>
  assert.equal(
    calculateRunway({ cash: 1000, monthlyRevenue: 1000, monthlyExpenses: 1000 }).runwayMonths,
    null,
  ));
test('burn anomaly compares latest snapshot to prior baseline', () =>
  assert.equal(
    detectBurnAnomaly([
      { monthlyRevenue: 0, monthlyExpenses: 150 },
      { monthlyRevenue: 0, monthlyExpenses: 100 },
      { monthlyRevenue: 0, monthlyExpenses: 100 },
    ]).anomalous,
    true,
  ));
