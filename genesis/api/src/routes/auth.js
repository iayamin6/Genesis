import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models.js';
import { comparePassword, hashPassword, tokenFor } from '../auth.js';

const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes'), name: z.string().min(1).max(120).optional() });
export const authRouter = Router();
authRouter.post('/register', async (req, res, next) => { try {
  const input = credentials.parse(req.body);
  if (!input.name) return res.status(400).json({ error: 'Name is required' });
  if (await User.exists({ email: input.email })) return res.status(409).json({ error: 'Email is already registered' });
  const user = await User.create({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) });
  res.status(201).json({ token: tokenFor(user), user: { id: user.id, email: user.email, name: user.name } });
} catch (err) { next(err); } });
authRouter.post('/login', async (req, res, next) => { try {
  const input = credentials.omit({ name: true }).parse(req.body);
  const user = await User.findOne({ email: input.email });
  if (!user?.passwordHash || !(await comparePassword(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: tokenFor(user), user: { id: user.id, email: user.email, name: user.name } });
} catch (err) { next(err); } });
