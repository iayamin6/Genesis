import crypto from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Workspace, FinancialSnapshot } from '../models.js';
import { CompanyAction, CompanyDecision, CompanyScenario } from '../intelligence/models.js';
import { latestEvaluation, importSnapshot, reevaluateWorkspace } from '../intelligence/service.js';
import { Connection, ExternalWork, TaskDispatch } from '../integrations/models.js';
import { seal, hashSecret } from '../integrations/secrets.js';
import { syncConnection, githubRequest, listIssues, taskPreview } from '../integrations/github.js';
import { safeEqual, rateLimit } from '../security.js';
import { MarketObservation, marketInput } from '../intelligence/market.js';
import { CompanyQuestion, answerCompanyQuestion } from '../intelligence/company-questions.js';
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw error('Record not found', 404);
  return id;
};
const connectInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    provider: z.enum(['github', 'ingestion']),
    repository: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
      .max(200)
      .optional(),
    projectId: z.string().max(80).optional(),
    syncProjectProgress: z.boolean().default(false),
    token: z.string().max(1000).optional(),
  })
  .strict();
export const ingestionRouter = Router();
ingestionRouter.post('/api/ingest/:connectionId', rateLimit(30), async (req, res, next) => {
  try {
    const c = await Connection.findOne({
      _id: oid(req.params.connectionId),
      provider: 'ingestion',
      enabled: true,
    }).select('+webhookHash');
    const secret = req.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    if (!c || !safeEqual(c.webhookHash, hashSecret(secret)))
      throw error('Invalid ingestion credentials', 401);
    if (!(await Workspace.exists({ _id: c.workspaceId }))) throw error('Workspace not found', 404);
    const result = await importSnapshot(c.workspaceId, req.body);
    await Connection.updateOne(
      { _id: c._id },
      { $set: { lastSyncedAt: new Date(), status: 'ready', lastError: null } },
    );
    res.status(201).json({ id: result.id, observedAt: result.observedAt });
  } catch (e) {
    next(e);
  }
});
export function registerExtendedRoutes(router, root) {
  router.get(`${root}/connections`, async (req, res) =>
    res.json({
      connections: await Connection.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }),
      work: await ExternalWork.find({ workspaceId: req.companyId })
        .sort({ updatedAtSource: -1 })
        .limit(100),
      dispatches: await TaskDispatch.find({ workspaceId: req.companyId })
        .sort({ createdAt: -1 })
        .limit(100),
    }),
  );
  router.post(`${root}/connections`, async (req, res) => {
    if (req.companyRole !== 'founder' && req.companyRole !== 'co_founder')
      throw error('Founder access required', 403);
    const input = connectInput.parse(req.body);
    if ((await Connection.countDocuments({ workspaceId: req.companyId })) >= 10)
      throw error('Maximum ten connections per workspace');
    if (input.provider === 'github' && !input.repository) throw error('Enter owner/repository');
    const latest = await latestEvaluation(req.companyId);
    if (
      input.syncProjectProgress &&
      !latest?.snapshot.projects.some((p) => p.id === input.projectId)
    )
      throw error('Select a company project before syncing project progress');
    const secret = input.provider === 'ingestion' ? crypto.randomBytes(32).toString('hex') : null;
    const { token, ...config } = input;
    const c = await Connection.create({
      ...config,
      workspaceId: req.companyId,
      enabled: true,
      encryptedToken: token ? seal(token) : undefined,
      webhookHash: secret ? hashSecret(secret) : undefined,
      createdBy: req.user._id,
    });
    res
      .status(201)
      .json({ id: c.id, name: c.name, secret, endpoint: secret ? `/api/ingest/${c.id}` : null });
  });
  router.patch(`${root}/connections/:id`, async (req, res) => {
    const input = z.object({ enabled: z.boolean() }).strict().parse(req.body);
    const c = await Connection.findOneAndUpdate(
      { _id: oid(req.params.id), workspaceId: req.companyId },
      { $set: input },
      { new: true },
    );
    if (!c) throw error('Connection not found', 404);
    res.json(c);
  });
  router.post(`${root}/connections/:id/credentials`, async (req, res) => {
    const c = await Connection.findOne({ _id: oid(req.params.id), workspaceId: req.companyId });
    if (!c) throw error('Connection not found', 404);
    if (c.provider === 'github') {
      const { token } = z
        .object({ token: z.string().min(1).max(1000) })
        .strict()
        .parse(req.body);
      await Connection.updateOne({ _id: c.id }, { $set: { encryptedToken: seal(token) } });
      return res.json({ updated: true });
    }
    const secret = crypto.randomBytes(32).toString('hex');
    await Connection.updateOne({ _id: c.id }, { $set: { webhookHash: hashSecret(secret) } });
    res.json({ secret, endpoint: `/api/ingest/${c.id}` });
  });
  router.post(`${root}/connections/:id/sync`, async (req, res) => {
    const c = await Connection.findOne({ _id: oid(req.params.id), workspaceId: req.companyId });
    if (!c) throw error('Connection not found', 404);
    res.json(await syncConnection(c.id));
  });
  router.get(`${root}/actions/:id/publish-preview`, async (req, res) => {
    const action = await CompanyAction.findOne({
      _id: oid(req.params.id),
      workspaceId: req.companyId,
    });
    const c = await Connection.findOne({
      _id: oid(req.query.connectionId),
      workspaceId: req.companyId,
      provider: 'github',
      enabled: true,
    });
    if (!action || !c) throw error('Action or connection not found', 404);
    res.json(taskPreview(action, c));
  });
  router.post(`${root}/actions/:id/publish`, async (req, res) => {
    const input = z
      .object({
        connectionId: z.string(),
        title: z.string().min(1).max(256),
        body: z.string().max(20000),
        confirm: z.literal(true),
      })
      .strict()
      .parse(req.body);
    const action = await CompanyAction.findOne({
      _id: oid(req.params.id),
      workspaceId: req.companyId,
    });
    const c = await Connection.findOne({
      _id: oid(input.connectionId),
      workspaceId: req.companyId,
      provider: 'github',
      enabled: true,
    }).select('+encryptedToken');
    if (!action || !c) throw error('Action or connection not found', 404);
    if (!c.encryptedToken) throw error('A GitHub token with issue write permission is required');
    const preview = taskPreview(action, c);
    if (preview.title !== input.title || preview.body !== input.body)
      throw error('Action changed. Refresh the publish preview.', 409);
    let dispatch = await TaskDispatch.findOne({ actionId: action._id });
    if (dispatch?.status === 'published') return res.json(dispatch);
    if (dispatch)
      throw error(
        'A prior publication is pending or uncertain. Reconcile it before retrying.',
        409,
      );
    try {
      dispatch = await TaskDispatch.create({
        workspaceId: req.companyId,
        actionId: action._id,
        connectionId: c._id,
        status: 'publishing',
        sentTitle: input.title,
        sentBody: input.body,
        publishedBy: req.user._id,
      });
    } catch (e) {
      if (e.code === 11000) throw error('Publication already started', 409);
      throw e;
    }
    try {
      const { data } = await githubRequest(c, '/issues', {
        method: 'POST',
        body: JSON.stringify({ title: input.title, body: input.body }),
      });
      dispatch.status = 'published';
      dispatch.issueNumber = data.number;
      dispatch.url = `https://github.com/${c.repository}/issues/${data.number}`;
      await dispatch.save();
      res.status(201).json(dispatch);
    } catch (e) {
      await TaskDispatch.updateOne(
        { _id: dispatch._id },
        { $set: { status: 'uncertain', error: e.message } },
      );
      throw error(
        'Publication outcome is uncertain. Use Reconcile; do not manually retry blindly.',
        502,
      );
    }
  });
  router.post(`${root}/dispatches/:id/reconcile`, async (req, res) => {
    const d = await TaskDispatch.findOne({ _id: oid(req.params.id), workspaceId: req.companyId });
    if (!d) throw error('Dispatch not found', 404);
    const c = await Connection.findOne({
      _id: d.connectionId,
      workspaceId: req.companyId,
      enabled: true,
    }).select('+encryptedToken');
    if (!c) throw error('Connection unavailable');
    const issues = await listIssues(c);
    const matching = issues.filter((i) =>
      (i.body || '').includes(`<!-- genesis-action:${d.actionId} -->`),
    );
    if (matching.length !== 1)
      return res.json({
        status: 'needs_review',
        message: matching.length
          ? 'Multiple matching issues found; inspect the repository.'
          : 'No matching issue found. Publication remains locked to prevent duplicates.',
      });
    d.status = 'published';
    d.issueNumber = matching[0].number;
    d.url = `https://github.com/${c.repository}/issues/${d.issueNumber}`;
    d.error = null;
    await d.save();
    res.json(d);
  });
  router.get(`${root}/market`, async (req, res) =>
    res.json(
      await MarketObservation.find({ workspaceId: req.companyId })
        .sort({ observedAt: -1 })
        .limit(100),
    ),
  );
  router.post(`${root}/market`, async (req, res) => {
    const input = marketInput.parse(req.body);
    if (Date.parse(input.observedAt) > Date.now())
      throw error('Observation cannot be in the future');
    const workspace = await Workspace.findById(req.companyId),
      competitor = workspace.competitors.id(input.competitorId);
    if (!competitor) throw error('Select a competitor in this workspace');
    const latest = await latestEvaluation(req.companyId);
    if (input.customerIds.some((id) => !latest?.snapshot.customers.some((c) => c.id === id)))
      throw error('Affected customers must exist in this company');
    const observation = await MarketObservation.create({
      ...input,
      workspaceId: req.companyId,
      competitorName: competitor.name,
      createdBy: req.user._id,
    });
    if (latest) await reevaluateWorkspace(req.companyId, new Date(), true);
    res.status(201).json(observation);
  });
  router.get(`${root}/questions`, async (req, res) =>
    res.json(
      await CompanyQuestion.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }).limit(30),
    ),
  );
  router.post(`${root}/questions`, async (req, res) => {
    const { question } = z
      .object({ question: z.string().trim().min(3).max(2000) })
      .strict()
      .parse(req.body);
    const [latest, financial, actions, decisions, scenarios] = await Promise.all([
      latestEvaluation(req.companyId),
      FinancialSnapshot.findOne({ workspaceId: req.companyId }).sort({ recordedAt: -1 }),
      CompanyAction.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }).limit(100),
      CompanyDecision.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }).limit(100),
      CompanyScenario.find({ workspaceId: req.companyId }).sort({ createdAt: -1 }).limit(20),
    ]);
    const answer = answerCompanyQuestion(question, {
      latest,
      financial,
      actions,
      decisions,
      scenarios,
    });
    res
      .status(201)
      .json(
        await CompanyQuestion.create({
          workspaceId: req.companyId,
          userId: req.user._id,
          question,
          ...answer,
        }),
      );
  });
}
