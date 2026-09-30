// Run against an isolated test API/database; never deletes user workspaces.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Workspace } from '../src/models.js';
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3002';
const uid = crypto.randomUUID();
async function call(path, method = 'GET', body, token, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
const register = (name) =>
  call(
    '/api/auth/register',
    'POST',
    { name, email: `${name}-${uid}@example.test`, password: crypto.randomUUID() },
    null,
    201,
  );
const founder = await register('founder'),
  outsider = await register('outsider'),
  viewer = await register('viewer');
const workspace = await call(
  '/api/workspaces',
  'POST',
  { name: `Integration ${uid}` },
  founder.token,
  201,
);
await mongoose.connect(
  process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/genesis-integration',
);
await Workspace.updateOne(
  { _id: workspace._id },
  { $push: { members: { userId: viewer.user.id, role: 'viewer' } } },
);
const root = `/api/workspaces/${workspace._id}/intelligence`;
const date = new Date(Date.now() - 86400000).toISOString();
const snapshot = {
  importKey: 'first',
  observedAt: date,
  source: { kind: 'sample', name: 'Integration synthetic fixture' },
  currency: 'USD',
  teams: [{ id: 'eng', name: 'Engineering' }],
  employees: [{ id: 'alex', name: 'Alex', teamId: 'eng', capacityHours: 40, allocatedHours: 54 }],
  projects: [
    {
      id: 'alpha',
      name: 'Alpha',
      teamId: 'eng',
      ownerIds: ['alex'],
      dueDate: '2020-01-01',
      completion: 60,
    },
  ],
  products: [{ id: 'p', name: 'Platform' }],
  features: [{ id: 'f', name: 'Sync', projectId: 'alpha', productId: 'p' }],
  customers: [
    { id: 'c', name: 'Acme', featureIds: ['f'], arrMinor: 8300000, openSupportIssues: 7 },
  ],
};
await call(root, 'GET', null, null, 401);
await call(root, 'GET', null, outsider.token, 404);
await call(`${root}/import`, 'POST', snapshot, viewer.token, 403);
await call(`${root}/import`, 'POST', { ...snapshot, currency: 'invalid' }, founder.token, 400);
const imported = await call(`${root}/import`, 'POST', snapshot, founder.token, 201);
const replay = await call(`${root}/import`, 'POST', snapshot, founder.token, 201);
assert.equal(imported._id, replay._id);
assert.equal(imported.analysis.summary.exposedArrMinor, 8300000);
await call(`${root}/import`, 'POST', { ...snapshot, currency: 'EUR' }, founder.token, 409);
await call(`${root}/import`, 'POST', { ...snapshot, importKey: 'stale' }, founder.token, 409);
const input = {
  riskKey: imported.analysis.risks[0].key,
  title: 'Reallocate capacity',
  ownerId: 'alex',
  dueDate: '2026-10-01',
  reason: 'Delivery is constrained',
  expectedResult: 'Restore delivery',
};
await call(`${root}/actions`, 'POST', { ...input, ownerId: 'missing' }, founder.token, 400);
const action = await call(`${root}/actions`, 'POST', input, founder.token, 201);
const customerAction = await call(
  `${root}/actions`,
  'POST',
  { ...input, riskKey: 'customer_concentration', title: 'Review account concentration' },
  founder.token,
  201,
);
assert.equal(customerAction.baseline.concentrationPct, 100);
await call(`${root}/actions/${action._id}`, 'PATCH', { status: 'completed' }, viewer.token, 403);
await call(`${root}/actions/${action._id}`, 'PATCH', { status: 'completed' }, founder.token);
const secondWorkspace = await call(
  '/api/workspaces',
  'POST',
  { name: `Other ${uid}` },
  outsider.token,
  201,
);
await call(
  `/api/workspaces/${secondWorkspace._id}/intelligence/actions/${action._id}`,
  'PATCH',
  { status: 'completed' },
  outsider.token,
  404,
);
await call(`${root}/evaluate`, 'POST', {}, founder.token);
const evaluation1 = await call(`${root}/evaluate`, 'POST', {}, founder.token);
const evaluation2 = await call(`${root}/evaluate`, 'POST', {}, founder.token);
assert.equal(evaluation1._id, evaluation2._id);
snapshot.importKey = 'recovered';
snapshot.observedAt = new Date().toISOString();
snapshot.projects[0].completion = 100;
snapshot.employees[0].allocatedHours = 35;
await call(`${root}/import`, 'POST', snapshot, founder.token, 201);
const state = await call(root, 'GET', null, viewer.token);
assert.equal(state.latest.analysis.risks.length, 0);
assert.equal(state.actions.find((a) => a._id === action._id).status, 'completed');
assert.equal(state.actions.find((a) => a._id === action._id).outcome.status, 'rule_cleared');
assert.equal(
  state.actions.find((a) => a._id === customerAction._id).outcome.status,
  'risk_persists',
);
await call('/internal/agent-events', 'POST', { runId: 'fake', event: {} }, null, 401);
await mongoose.disconnect();
console.log(
  'PASS: authentication, tenant isolation, viewer permissions, import validation/replay/conflict, persisted exposure, action lifecycle, scheduler deduplication, later recovery, callback authentication.',
);
