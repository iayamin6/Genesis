import { Workspace } from '../models.js';
import { MarketObservation } from './market.js';
import { RULE_VERSION } from './customers.js';
import crypto from 'node:crypto';
import { CompanyEvaluation } from './models.js';
import { snapshotSchema } from './contract.js';
import { analyzeCompany } from './engine.js';
async function customerBaseline(workspaceId, snapshot) {
  const stamp = snapshot.domainsObservedAt?.customers || snapshot.observedAt;
  return CompanyEvaluation.findOne({ workspaceId, $or: [{ 'snapshot.domainsObservedAt.customers': { $lt: stamp } }, { 'snapshot.domainsObservedAt.customers': { $exists: false }, observedAt: { $lt: new Date(stamp) } }] }).sort({ observedAt: -1, evaluatedAt: -1 });
}
export const latestEvaluation = workspaceId => CompanyEvaluation.findOne({ workspaceId }).sort({ observedAt: -1, evaluatedAt: -1 });
const conflict = message => Object.assign(new Error(message), { status: 409 });
async function writeSnapshot(workspaceId, input, now, expectedImportKey) {
  const snapshot = snapshotSchema.parse(input);
  if (Date.parse(snapshot.observedAt) > now.getTime()) throw Object.assign(new Error('Observation cannot be in the future'), { status: 400 });
  const key = `import:${snapshot.importKey}`;
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const existing = await CompanyEvaluation.findOne({ workspaceId, key });
  if (existing) { if (existing.payloadHash !== payloadHash) throw conflict('Import key already belongs to different data'); return existing; }
  const previous = await latestEvaluation(workspaceId);
  if (expectedImportKey !== undefined && (previous?.snapshot.importKey || '') !== expectedImportKey) throw conflict('Company observation changed. Reload before saving these edits.');
  if (previous && Date.parse(snapshot.observedAt) <= previous.observedAt.getTime()) throw conflict('Import a newer observation with a new import key');
  const market = await MarketObservation.find({ workspaceId }).sort({ observedAt: -1 }).limit(100);
  const customersBefore = await customerBaseline(workspaceId, snapshot);
  const analysis = analyzeCompany(snapshot, previous?.snapshot, now.toISOString(), market, customersBefore?.snapshot || null);
  try { return await CompanyEvaluation.create({ workspaceId, key, payloadHash, snapshot, analysis, observedAt: snapshot.observedAt, evaluatedAt: now }); }
  catch (error) { if (error.code !== 11000) throw error; const winner = await CompanyEvaluation.findOne({ workspaceId, key }); if (winner.payloadHash !== payloadHash) throw conflict('Import key already belongs to different data'); return winner; }
}
export async function reevaluateWorkspace(workspaceId, now = new Date(), force = false) {
  const latest = await latestEvaluation(workspaceId);
  if (!latest) return null;
  const previous = await CompanyEvaluation.findOne({ workspaceId, observedAt: { $lt: latest.observedAt } }).sort({ observedAt: -1, evaluatedAt: -1 });
  const key = `tick:${RULE_VERSION}:${latest.snapshot.importKey}:${now.toISOString().slice(0, 10)}${force ? ':' + crypto.randomUUID() : ''}`;
  const market = await MarketObservation.find({ workspaceId }).sort({ observedAt: -1 }).limit(100);
  const customersBefore = await customerBaseline(workspaceId, latest.snapshot);
  return CompanyEvaluation.findOneAndUpdate({ workspaceId, key }, { $setOnInsert: { snapshot: latest.snapshot, analysis: analyzeCompany(latest.snapshot, previous?.snapshot, now.toISOString(), market, customersBefore?.snapshot || null), observedAt: latest.observedAt, evaluatedAt: now } }, { upsert: true, new: true });
}

export async function importSnapshot(workspaceId, input, now = new Date(), expectedImportKey) {
  const owner = crypto.randomUUID();
  const workspace = await Workspace.findOneAndUpdate({ _id: workspaceId, $or: [{ 'companyWriteLease.expiresAt': { $lt: new Date() } }, { 'companyWriteLease.expiresAt': { $exists: false } }] }, { $set: { companyWriteLease: { owner, expiresAt: new Date(Date.now() + 60000) } } }, { new: true });
  if (!workspace) throw conflict('Company data is being updated. Retry shortly.');
  try { return await writeSnapshot(workspaceId, input, now, expectedImportKey); }
  finally { await Workspace.updateOne({ _id: workspaceId, 'companyWriteLease.owner': owner }, { $unset: { companyWriteLease: 1 } }); }
}
