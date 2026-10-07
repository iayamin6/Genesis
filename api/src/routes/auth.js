import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models.js';
import {
  comparePassword,
  hashPassword,
  publicUser,
  setSession,
  clearSession,
  requireAuth,
} from '../auth.js';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .max(72)
    .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes'),
  name: z.string().trim().min(1).max(120).optional(),
});
export const authRouter = Router();
authRouter.post('/register', async (req, res, next) => {
  try {
    const input = credentials.parse(req.body);
    if (!input.name) return res.status(400).json({ error: 'Name is required' });
    if (await User.exists({ email: input.email }))
      return res.status(409).json({ error: 'Email is already registered' });
    const user = await User.create({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    });
    setSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});
authRouter.post('/login', async (req, res, next) => {
  try {
    const input = credentials.omit({ name: true }).parse(req.body);
    const user = await User.findOne({ email: input.email }).select('+passwordHash');
    if (!user?.passwordHash || !(await comparePassword(input.password, user.passwordHash)))
      return res.status(401).json({ error: 'Invalid email or password' });
    setSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});
authRouter.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});
