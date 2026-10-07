process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';
process.env.WORKER_ENABLED = 'false';
let backend;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    backend ||= await import('./src/index.js');
    await backend.connectDatabase();
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Account storage is temporarily unavailable. Please try again shortly.',
      }),
    );
  }
  return backend.app(req, res);
}
