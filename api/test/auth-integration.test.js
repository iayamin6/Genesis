import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import supertest from 'supertest';
process.env.NO_LISTEN = 'true';
process.env.VERCEL = '1';
const { app, io } = await import('../src/index.js');
const { User, Workspace } = await import('../src/models.js');
const enabled = !!process.env.TEST_MONGO_URI;
before(async () => {
  if (!enabled) return;
  if (!new URL(process.env.TEST_MONGO_URI).pathname.startsWith('/genesis_test_'))
    throw Error('Use an isolated genesis_test_ database');
  await mongoose.connect(process.env.TEST_MONGO_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});
after(async () => {
  if (enabled) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  io.close();
});
test(
  'public session flow persists accounts and isolates workspaces',
  { skip: !enabled },
  async () => {
    const alice = supertest.agent(app),
      bob = supertest.agent(app);
    const input = { name: 'Alice', email: 'alice@example.test', password: 'a-test-password-only' };
    const registered = await alice.post('/api/auth/register').send(input).expect(201);
    assert(!registered.body.token);
    assert.match(registered.headers['set-cookie'][0], /HttpOnly/);
    const stored = await User.findOne({ email: input.email }).select('+passwordHash');
    assert(stored);
    assert.notEqual(stored.passwordHash, input.password);
    assert(!(await alice.get('/api/auth/me').expect(200)).body.user.passwordHash);
    const workspace = (
      await alice.post('/api/workspaces').send({ name: 'Private company' }).expect(201)
    ).body;
    await alice.post('/api/auth/logout').expect(200);
    await alice.get('/api/auth/me').expect(401);
    const later = supertest.agent(app);
    await later
      .post('/api/auth/login')
      .send({ ...input, email: input.email.toUpperCase(), password: 'wrong-password' })
      .expect(401);
    await later
      .post('/api/auth/login')
      .send({ ...input, email: input.email.toUpperCase() })
      .expect(200);
    assert.equal((await later.get('/api/workspaces').expect(200)).body[0]._id, workspace._id);
    await later.post('/api/auth/register').send(input).expect(409);
    await bob
      .post('/api/auth/register')
      .send({ ...input, email: 'bob@example.test' })
      .expect(201);
    await bob.get('/api/workspaces/' + workspace._id).expect(404);
    await later
      .post('/api/workspaces')
      .set('Origin', 'https://untrusted.example')
      .send({ name: 'blocked' })
      .expect(403);
    await later
      .post('/api/runs/workspaces/' + workspace._id + '/idea-analysis')
      .send({ idea: 'Scheduling software for independent bicycle repair shops' })
      .expect(503);
    assert.equal(await Workspace.countDocuments(), 1);
  },
);
