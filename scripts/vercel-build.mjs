import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
// Only this generated build directory is replaced; project files and secrets are excluded.
const output = path.join(root, '.vercel/output');
await rm(output, { recursive: true, force: true });
const fn = path.join(output, 'functions/api.func');
await mkdir(fn, { recursive: true });
await cp(path.join(root, 'web/dist'), path.join(output, 'static'), { recursive: true });
await cp(path.join(root, 'api/src'), path.join(fn, 'src'), { recursive: true });
await cp(path.join(root, 'api/node_modules'), path.join(fn, 'node_modules'), { recursive: true });
await cp(path.join(root, 'api/package.json'), path.join(fn, 'package.json'));
await cp(path.join(root, 'deploy/vercel-handler.mjs'), path.join(fn, 'index.mjs'));
await writeFile(
  path.join(fn, '.vc-config.json'),
  JSON.stringify({
    runtime: 'nodejs24.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: true,
    maxDuration: 60,
  }),
);
await writeFile(
  path.join(output, 'config.json'),
  JSON.stringify({
    version: 3,
    routes: [
      {
        src: '/.*',
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        },
        continue: true,
      },
      { src: '/api(?:/.*)?', dest: '/api' },
      { handle: 'filesystem' },
      { src: '/.*', dest: '/index.html' },
    ],
  }),
);
console.log(
  'Built static frontend and isolated Express function. No secrets or local data included.',
);
