import test from 'node:test';
import assert from 'node:assert/strict';
import { diffCompetitorSnapshots } from '../src/services/competitor.js';

test('first competitor snapshot establishes a baseline without alerting', () =>
  assert.deepEqual(
    diffCompetitorSnapshots(null, { pricing: '$10', hiring: 'none', summary: 'x' }),
    { significant: false, changes: [], baseline: true },
  ));
test('pricing and hiring changes are material while summary noise is not', () => {
  const diff = diffCompetitorSnapshots(
    { pricing: '$10', hiring: 'none', summary: 'old' },
    { pricing: '$20', hiring: '3 engineers', summary: 'new' },
  );
  assert.equal(diff.significant, true);
  assert.equal(diff.changes.length, 3);
});
