import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { AgentRun, Workspace } from '../models.js';
import { requireAuth, workspaceRole } from '../auth.js';
import { enqueueRun } from '../jobs/queue.js';

export const runRouter = Router();
runRouter.use(requireAuth);
runRouter.post('/workspaces/:workspaceId/idea-analysis', async (req, res, next) => { try {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace || !workspaceRole(workspace, req.user._id)) return res.status(404).json({ error: 'Workspace not found' }); if (req.method !== 'GET' && workspaceRole(workspace, req.user._id) === 'viewer') return res.status(403).json({ error: 'Viewer access is read-only' });
  const { idea, industry } = z.object({ idea: z.string().min(20).max(20000), industry: z.string().max(120).optional() }).parse(req.body);
  workspace.idea = idea; workspace.industry = industry || workspace.industry; workspace.updatedAt = new Date(); await workspace.save();
  const idempotencyKey = `idea:${workspace.id}:${req.get('Idempotency-Key') || crypto.randomUUID()}`;
  let run = await AgentRun.findOne({ idempotencyKey });
  if (!run) { run = await AgentRun.create({ workspaceId: workspace._id, kind: 'idea_analysis', trigger: 'manual', idempotencyKey }); await enqueueRun(run); }
  res.status(202).json(run);
} catch (error) { next(error); } });
runRouter.get('/:runId', async (req, res) => {
  const run = await AgentRun.findById(req.params.runId); const workspace = run && await Workspace.findById(run.workspaceId);
  if (!run || !workspace || !workspaceRole(workspace, req.user._id)) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});
