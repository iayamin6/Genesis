import { historicalForecast } from '../intelligence/forecast.js';
import { registerExtendedRoutes } from './extended.js';
import { allSignals } from '../intelligence/customers.js';
import { Router } from 'express';
import mongoose from 'mongoose';
import { scenarioInput, simulateScenario } from '../intelligence/scenarios.js';
import { Workspace, FinancialSnapshot } from '../models.js';
import { requireAuth, workspaceRole } from '../auth.js';
import { decisionInput, reviewInput } from '../intelligence/decisions.js';
import { CompanyAction, CompanyDecision, CompanyScenario } from '../intelligence/models.js';
import { importSnapshot, latestEvaluation, reevaluateWorkspace } from '../intelligence/service.js';
import { actionSchema, actionUpdateSchema } from '../intelligence/contract.js';
import { measureOutcome } from '../intelligence/engine.js';
export const intelligenceRouter = Router();
intelligenceRouter.use(requireAuth);
intelligenceRouter.use('/workspaces/:workspaceId/intelligence', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.workspaceId)) return res.status(404).json({ error: 'Workspace not found' });
    const workspace = await Workspace.findById(req.params.workspaceId);
    const role = workspace && workspaceRole(workspace, req.user._id);
    if (!role) return res.status(404).json({ error: 'Workspace not found' });
    if (req.method !== 'GET' && role === 'viewer') return res.status(403).json({ error: 'Viewer access is read-only' });
    req.companyRole = role; req.companyId = workspace._id; next();
  } catch (error) { next(error); }
});
const root = '/workspaces/:workspaceId/intelligence';
intelligenceRouter.get(root, async (req, res, next) => { try {
  const latest = await latestEvaluation(req.companyId);
  const actions = await CompanyAction.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }).limit(100);
  const decisions = await CompanyDecision.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }).limit(100);
  const financial = await FinancialSnapshot.findOne({ workspaceId: req.companyId }).sort({ recordedAt: -1 });
  const scenarios = await CompanyScenario.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }).limit(20);
  const history = await FinancialSnapshot.find({ workspaceId: req.companyId }).sort({ recordedAt: -1 }).limit(120);
  res.json({ latest, decisions, financial, forecast: historicalForecast(history), scenarios, actions: actions.map(a => ({ ...a.toObject(), outcome: latest ? measureOutcome(a, latest) : null })) });
} catch (e) { next(e); } });
intelligenceRouter.post(`${root}/import`, async (req, res, next) => { try { res.status(201).json(await importSnapshot(req.companyId, req.body, new Date(), req.get('X-Base-Import-Key'))); } catch (e) { next(e); } });
intelligenceRouter.post(`${root}/evaluate`, async (req, res, next) => { try { res.json(await reevaluateWorkspace(req.companyId)); } catch (e) { next(e); } });
intelligenceRouter.post(`${root}/actions`, async (req, res, next) => { try {
  const input = actionSchema.parse(req.body);
  const latest = await latestEvaluation(req.companyId);
  const risk = latest && allSignals(latest.analysis).find(r => r.key === input.riskKey);
  const owner = latest?.snapshot.employees.find(e => e.id === input.ownerId);
  if (!risk || !owner) return res.status(400).json({ error: 'Select a current signal and an employee in this company' });
  const action = await CompanyAction.create({ ...input, workspaceId: req.companyId, ownerName: owner.name, baseline: risk.evidence, baselineObservedAt: latest.snapshot.observedAt, customerIds: risk.customers.map(c => c.id), createdBy: req.user._id });
  res.status(201).json(action);
} catch (e) { next(e); } });
intelligenceRouter.patch(`${root}/actions/:actionId`, async (req, res, next) => { try {
  const { status } = actionUpdateSchema.parse(req.body);
  if (!mongoose.isValidObjectId(req.params.actionId)) return res.status(404).json({ error: 'Action not found' });
  const action = await CompanyAction.findOneAndUpdate({ _id: req.params.actionId, workspaceId: req.companyId }, { $set: { status, completedAt: status === 'completed' ? new Date() : null } }, { new: true });
  if (!action) return res.status(404).json({ error: 'Action not found' });
  res.json(action);
} catch (e) { next(e); } });

intelligenceRouter.post(`${root}/decisions`, async (req, res, next) => { try {
  const input = decisionInput.parse(req.body);
  const prior = await CompanyDecision.findOne({ workspaceId: req.companyId, requestId: input.requestId });
  if (prior) return res.json(prior);
  const latest = await latestEvaluation(req.companyId);
  const owner = input.ownerId === 'self' ? { id: `user:${req.user.id}`, name: req.user.name } : latest?.snapshot.employees.find(e => e.id === input.ownerId);
  if (!owner) return res.status(400).json({ error: 'Select yourself or an employee in this company' });
  const signal = input.signalKey ? latest && allSignals(latest.analysis).find(s => s.key === input.signalKey) : null;
  if (input.signalKey && !signal) return res.status(400).json({ error: 'The linked signal is no longer available. Refresh and choose a current signal.' });
  const ids = [...new Set(input.actionIds)];
  if (await CompanyAction.countDocuments({ _id: { $in: ids }, workspaceId: req.companyId }) !== ids.length) return res.status(400).json({ error: 'Linked actions must belong to this company' });
  const decision = await CompanyDecision.findOneAndUpdate({ workspaceId: req.companyId, requestId: input.requestId }, { $setOnInsert: { ...input, initialReviewDate: input.reviewDate, ownerId: owner.id, ownerName: owner.name, actionIds: ids, signalTitle: signal?.title, baselineSource: latest?.snapshot.source, baseline: signal?.evidence, baselineObservedAt: latest?.observedAt, createdBy: req.user._id, createdByName: req.user.name } }, { upsert: true, new: true });
  res.status(201).json(decision);
} catch (e) { next(e); } });
intelligenceRouter.post(`${root}/decisions/:decisionId/reviews`, async (req, res, next) => { try {
  const input = reviewInput.parse(req.body);
  if (!mongoose.isValidObjectId(req.params.decisionId)) return res.status(404).json({ error: 'Decision not found' });
  if (input.nextReviewDate && input.nextReviewDate <= new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'Choose a future follow-up review date' });
  const decision = await CompanyDecision.findOne({ _id: req.params.decisionId, workspaceId: req.companyId });
  if (!decision) return res.status(404).json({ error: 'Decision not found' });
  if (decision.reviews.some(r => r.requestId === input.requestId)) return res.json(decision);
  const latest = await latestEvaluation(req.companyId);
  const signal = latest && allSignals(latest.analysis).find(s => s.key === decision.signalKey);
  const review = { ...input, source: latest?.snapshot.source, reviewedBy: req.user._id, reviewerName: req.user.name, reviewedAt: new Date(), observedAt: latest?.observedAt, evidence: signal?.evidence || null };
  const updated = await CompanyDecision.findOneAndUpdate({ _id: decision._id, workspaceId: req.companyId, 'reviews.49': { $exists: false }, 'reviews.requestId': { $ne: input.requestId } }, { $push: { reviews: review }, $set: { status: input.nextReviewDate ? 'open' : 'reviewed', ...(input.nextReviewDate ? { reviewDate: input.nextReviewDate } : {}) } }, { new: true });
  if (!updated) { const replay = await CompanyDecision.findOne({ _id: decision._id, workspaceId: req.companyId, 'reviews.requestId': input.requestId }); if (replay) return res.json(replay); return res.status(409).json({ error: 'This decision has reached its 50-review limit.' }); }
  res.status(201).json(updated);
} catch (e) { next(e); } });

intelligenceRouter.post(`${root}/scenarios`, async (req, res, next) => { try {
  const input = scenarioInput.parse(req.body);
  const finance = await FinancialSnapshot.findOne({ workspaceId: req.companyId }).sort({ recordedAt: -1 });
  const latest = await latestEvaluation(req.companyId);
  const result = simulateScenario(finance, latest?.snapshot, input);
  const scenario = await CompanyScenario.create({ workspaceId: req.companyId, name: input.name, assumptions: input, result, createdBy: req.user._id });
  res.status(201).json(scenario);
} catch (e) { next(e); } });

registerExtendedRoutes(intelligenceRouter, root);
