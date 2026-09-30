import { Router } from 'express';
import { z } from 'zod';
import { Workspace } from '../models.js';
import { requireAuth, workspaceRole } from '../auth.js';

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);
workspaceRouter.get('/', async (req, res) =>
  res.json(await Workspace.find({ 'members.userId': req.user._id })),
);
workspaceRouter.post('/', async (req, res, next) => {
  try {
    const input = z
      .object({
        name: z.string().min(1).max(120),
        idea: z.string().max(20000).optional(),
        industry: z.string().max(120).optional(),
      })
      .parse(req.body);
    const workspace = await Workspace.create({
      ...input,
      members: [{ userId: req.user._id, role: 'founder' }],
    });
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});
workspaceRouter.param('workspaceId', async (req, res, next, id) => {
  const workspace = await Workspace.findById(id);
  const role = workspace && workspaceRole(workspace, req.user._id);
  if (!role) return res.status(404).json({ error: 'Workspace not found' });
  req.workspace = workspace;
  req.workspaceRole = role;
  next();
});
workspaceRouter.get('/:workspaceId', (req, res) => res.json(req.workspace));
