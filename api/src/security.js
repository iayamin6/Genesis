import crypto from 'node:crypto';
import mongoose from 'mongoose';
const RateBucket = mongoose.model(
  'RateBucket',
  new mongoose.Schema({ _id: String, count: Number, expiresAt: { type: Date, expires: 0 } }),
);
export function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.MONGO_URI) throw new Error('Production requires MONGO_URI');
  for (const key of ['JWT_SECRET', 'INTERNAL_API_TOKEN'])
    if (
      !process.env[key] ||
      process.env[key].length < 32 ||
      /development|local-development/.test(process.env[key])
    )
      throw new Error(`Production requires a strong ${key}`);
  if (
    !process.env.CONNECTOR_ENCRYPTION_KEY ||
    Buffer.from(process.env.CONNECTOR_ENCRYPTION_KEY, 'base64').length !== 32
  )
    throw new Error('Production requires a base64-encoded 32-byte CONNECTOR_ENCRYPTION_KEY');
  if (!(process.env.WEB_ORIGIN || '').split(',').every((x) => x.trim().startsWith('https://')))
    throw new Error('Production WEB_ORIGIN must use HTTPS');
}
export function safeEqual(a, b) {
  const x = Buffer.from(a || ''),
    y = Buffer.from(b || '');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export function rateLimit(limit = 120, windowMs = 60000) {
  return async (req, res, next) => {
    const now = Date.now(),
      window = Math.floor(now / windowMs);
    const identity = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'local-rate-limit')
      .update(req.ip || 'unknown')
      .digest('hex');
    const key = limit + ':' + windowMs + ':' + window + ':' + identity;
    try {
      const update = {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 2) * windowMs) },
      };
      let item;
      try {
        item = await RateBucket.findOneAndUpdate({ _id: key }, update, { upsert: true, new: true });
      } catch (e) {
        if (e.code !== 11000) throw e;
        item = await RateBucket.findOneAndUpdate(
          { _id: key },
          { $inc: { count: 1 } },
          { new: true },
        );
      }
      if (item.count > limit) {
        res.set('Retry-After', String(Math.ceil(((window + 1) * windowMs - now) / 1000)));
        return res.status(429).json({ error: 'Too many requests; please retry later' });
      }
      next();
    } catch {
      res
        .status(503)
        .json({ error: 'Account security checks are temporarily unavailable. Please retry.' });
    }
  };
}
export function wrapRouter(router) {
  const wrap = (fn) =>
    function (req, res, next, ...args) {
      try {
        Promise.resolve(fn.call(this, req, res, next, ...args)).catch(next);
      } catch (e) {
        next(e);
      }
    };
  for (const layer of router.stack)
    if (layer.route)
      for (const routeLayer of layer.route.stack) routeLayer.handle = wrap(routeLayer.handle);
    else layer.handle = wrap(layer.handle);
  for (const name of Object.keys(router.params || {}))
    router.params[name] = router.params[name].map(wrap);
  return router;
}
