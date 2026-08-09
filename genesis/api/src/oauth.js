import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from './models.js';
import { tokenFor } from './auth.js';

export function configureGoogleOAuth(app) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return;
  passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_CALLBACK_URL }, async (_access, _refresh, profile, done) => {
    try { let user = await User.findOne({ googleId: profile.id }); if (!user) user = await User.findOneAndUpdate({ email: profile.emails[0].value }, { googleId: profile.id, name: profile.displayName }, { new: true, upsert: true }); done(null, user); } catch (error) { done(error); }
  }));
  app.use(passport.initialize());
  app.get('/api/auth/google', passport.authenticate('google', { scope: ['email', 'profile'], session: false }));
  app.get('/api/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${process.env.WEB_ORIGIN}/?authError=google` }), (req, res) => res.redirect(`${process.env.WEB_ORIGIN}/?token=${encodeURIComponent(tokenFor(req.user))}`));
}
