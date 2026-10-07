import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from './models.js';

const secret = () => process.env.JWT_SECRET || 'development-only-secret';
export const tokenFor = (user) =>
  jwt.sign({ sub: user._id.toString(), email: user.email }, secret(), { expiresIn: '7d' });
export const hashPassword = (password) => bcrypt.hash(password, 12);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);
export const publicUser = (user) => ({ id: user.id, email: user.email, name: user.name });
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});
export function setSession(res, user) {
  res.cookie('genesis_session', tokenFor(user), { ...cookieOptions(), maxAge: 7 * 86400000 });
}
export function clearSession(res) {
  res.clearCookie('genesis_session', cookieOptions());
}
export function readSession(cookie = '') {
  const entry = cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('genesis_session='));
  return entry ? decodeURIComponent(entry.slice('genesis_session='.length)) : null;
}

export async function requireAuth(req, res, next) {
  try {
    const token =
      readSession(req.headers.cookie) || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    req.user = await User.findById(jwt.verify(token, secret(), { algorithms: ['HS256'] }).sub);
    if (!req.user) return res.status(401).json({ error: 'Unknown user' });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function workspaceRole(workspace, userId) {
  return workspace?.members.find((m) => m.userId.equals(userId))?.role;
}
export function requireWorkspaceRole(...allowed) {
  return (req, res, next) =>
    allowed.includes(req.workspaceRole)
      ? next()
      : res.status(403).json({ error: 'Insufficient workspace role' });
}
