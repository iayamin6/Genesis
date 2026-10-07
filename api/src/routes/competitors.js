import { Router } from 'express';
import { z } from 'zod';
import { Workspace, AgentRun } from '../models.js';
import { requireAuth, workspaceRole } from '../auth.js';
import { enqueueRun, requireQueue } from '../jobs/queue.js';

export const competitorRouter = Router();
competitorRouter.use(requireAuth);
competitorRouter.post('/workspaces/:workspaceId/competitors', async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace || !workspaceRole(workspace, req.user._id))
      return res.status(404).json({ error: 'Workspace not found' });
    if (req.method !== 'GET' && workspaceRole(workspace, req.user._id) === 'viewer')
      return res.status(403).json({ error: 'Viewer access is read-only' });
    const competitor = z
      .object({ name: z.string().min(1).max(120), url: z.string().url().optional() })
      .parse(req.body);
    if (workspace.competitors.length >= 25)
      return res.status(400).json({ error: 'Competitor limit reached' });
    workspace.competitors.push(competitor);
    await workspace.save();
    res.status(201).json(workspace.competitors.at(-1));
  } catch (error) {
    next(error);
  }
});
competitorRouter.get('/workspaces/:workspaceId/competitors', async (req, res) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace || !workspaceRole(workspace, req.user._id))
    return res.status(404).json({ error: 'Workspace not found' });
  if (req.method !== 'GET' && workspaceRole(workspace, req.user._id) === 'viewer')
    return res.status(403).json({ error: 'Viewer access is read-only' });
  res.json(workspace.competitors);
});
competitorRouter.post('/workspaces/:workspaceId/competitors/digest', async (req, res) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace || !workspaceRole(workspace, req.user._id))
    return res.status(404).json({ error: 'Workspace not found' });
  if (req.method !== 'GET' && workspaceRole(workspace, req.user._id) === 'viewer')
    return res.status(403).json({ error: 'Viewer access is read-only' });
  const day = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `competitor-digest:${workspace.id}:${day}`;
  let run = await AgentRun.findOne({ idempotencyKey });
  if (!run) {
    await requireQueue();
    run = await AgentRun.create({
      workspaceId: workspace._id,
      kind: 'competitor_digest',
      trigger: 'manual',
      idempotencyKey,
    });
    await enqueueRun(run);
  }
  res.status(202).json(run);
});
