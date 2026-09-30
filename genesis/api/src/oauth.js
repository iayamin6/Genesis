import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from './models.js';
import { tokenFor } from './auth.js';
export function configureGoogleOAuth(app) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return;
  const origin = (process.env.WEB_ORIGIN || 'http://localhost:5180').split(',')[0].trim();
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 600000 };
  passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_CALLBACK_URL }, async (_access, _refresh, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email || !(profile._json?.email_verified === true || profile.emails?.[0]?.verified === true)) return done(new Error('Verified Google email required'));
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        if (await User.exists({ email })) return done(new Error('Use the existing sign-in method. Automatic account linking is disabled.'));
        user = await User.create({ email, googleId: profile.id, name: profile.displayName || email });
      }
      done(null, user);
    } catch (e) { done(e); }
  }));
  app.use(passport.initialize());
  app.get('/api/auth/google', (req, res, next) => {
    const state = jwt.sign({ nonce: crypto.randomBytes(24).toString('hex') }, process.env.JWT_SECRET || 'development-only-secret', { expiresIn: '10m', audience: 'google-oauth-state' });
    res.cookie('genesis-oauth-state', state, cookieOptions);
    passport.authenticate('google', { scope: ['email', 'profile'], session: false, state })(req, res, next);
  });
  app.get('/api/auth/google/callback', (req, res, next) => {
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('genesis-oauth-state='))?.slice('genesis-oauth-state='.length);
    res.clearCookie('genesis-oauth-state', cookieOptions);
    try { if (typeof req.query.state !== 'string' || req.query.state !== cookie) throw new Error('Invalid state'); jwt.verify(req.query.state, process.env.JWT_SECRET || 'development-only-secret', { algorithms: ['HS256'], audience: 'google-oauth-state' }); }
    catch { return res.redirect(`${origin}/?authError=google`); }
    passport.authenticate('google', { session: false }, (error, user) => {
      if (error || !user) return res.redirect(`${origin}/?authError=google`);
      res.redirect(`${origin}/#token=${encodeURIComponent(tokenFor(user))}`);
    })(req, res, next);
  });
}
