import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyCompany,
  editRecord,
  normalizeRecord,
  referencesTo,
  changesBetween,
  observationFor,
} from '../src/lib/company-data.js';
test('customer editing preserves stable identity and exact two-decimal ARR', () => {
  const input = {
    id: 'c',
    name: 'Acme',
    arrMinor: 1234567,
    featureIds: ['f'],
    openSupportIssues: 2,
  };
  const edited = editRecord('customers', input);
  assert.equal(edited.arr, '12345.67');
  const output = normalizeRecord('customers', { ...edited, name: ' Acme renamed ', arr: '10.29' });
  assert.equal(output.id, 'c');
  assert.equal(output.name, 'Acme renamed');
  assert.equal(output.arrMinor, 1029);
  assert.equal(output.renewalDate, undefined);
  assert.equal(input.name, 'Acme');
  assert.equal(input.arrMinor, 1234567);
});
test('blank numeric fields, fractional counts, excessive precision and invalid dates are rejected', () => {
  const row = { ...editRecord('customers'), name: 'Acme', arr: '10.00', openSupportIssues: '0' };
  for (const patch of [
    { arr: '' },
    { arr: '1.111' },
    { arr: '-10' },
    { openSupportIssues: '1.5' },
    { renewalDate: '2026-02-30' },
  ])
    assert.throws(() => normalizeRecord('customers', { ...row, ...patch }));
  assert.equal(normalizeRecord('customers', { ...row, arr: '0' }).arrMinor, 0);
});
test('reference checks cover ownership, team membership and both kinds of customer relationships', () => {
  const company = emptyCompany();
  company.employees.push({ id: 'e', name: 'Alex', teamId: 't' });
  company.projects.push({ id: 'p', name: 'Project', teamId: 't', ownerIds: ['e'] });
  company.customers.push({ id: 'c', name: 'Acme', featureIds: ['f'], requestedFeatureIds: ['f'] });
  assert.equal(referencesTo(company, 'teams', 't').length, 2);
  assert.equal(referencesTo(company, 'employees', 'e').length, 1);
  assert.equal(referencesTo(company, 'features', 'f').length, 2);
  assert.equal(referencesTo(company, 'features', 'unreferenced').length, 0);
});
test('review differentiates additions, edits, removals and leaves baseline unchanged', () => {
  const before = emptyCompany();
  before.teams = [
    { id: 'a', name: 'Original' },
    { id: 'b', name: 'Removed' },
  ];
  const after = structuredClone(before);
  after.teams = [
    { id: 'a', name: 'Renamed' },
    { id: 'c', name: 'Added' },
  ];
  assert.deepEqual(
    changesBetween(before, after).map((x) => x.change),
    ['Updated: name', 'Added', 'Removed from new observation'],
  );
  assert.equal(before.teams[0].name, 'Original');
});
test('saving creates a fresh dated observation, preserves entity IDs and sample provenance', () => {
  const company = emptyCompany();
  company.source = { kind: 'sample', name: 'Sample' };
  company.teams = [{ id: 'stable', name: 'Team' }];
  const observation = observationFor(company, new Date('2026-09-08T00:00:00Z'));
  assert.equal(observation.observedAt, '2026-09-08T00:00:00.000Z');
  assert.equal(observation.source.kind, 'sample');
  assert.equal(observation.teams[0].id, 'stable');
  assert.notEqual(observation.importKey, observationFor(company).importKey);
  assert.equal(company.importKey, undefined);
});
