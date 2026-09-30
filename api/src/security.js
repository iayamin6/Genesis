import crypto from 'node:crypto';
export function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
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
  const clients = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, v] of clients) if (v.until <= now) clients.delete(key);
  }, windowMs);
  timer.unref();
  return (req, res, next) => {
    const key = req.ip,
      now = Date.now();
    let item = clients.get(key);
    if (!item || item.until <= now) {
      if (clients.size >= 10000) return res.status(503).json({ error: 'Server busy; retry later' });
      item = { count: 0, until: now + windowMs };
      clients.set(key, item);
    }
    if (++item.count > limit) {
      res.set('Retry-After', String(Math.ceil((item.until - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests; please retry later' });
    }
    next();
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
