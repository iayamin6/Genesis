# Public deployment and updates

Production URL: https://genesis-founder-workspace.vercel.app

The Vercel project is connected to `iayamin6/Genesis`, production branch `main`. Changes pushed to `main` trigger a new build at the same URL. Vercel builds the React frontend and an isolated Express function using the Build Output API. Source files, secrets, database contents and local configuration are never placed in the public static directory.

## Updating the app

1. Work from this repository and fetch the latest commits first.
2. Implement the change while preserving existing feature areas.
3. Run API and frontend checks, then build the frontend.
4. Commit and push to `main` (never force-push).
5. Check GitHub Actions and the Vercel deployment. Open the same production URL and verify the changed behavior. A failed Vercel build leaves the previous successful deployment in place.

The owner has authorized this publish-after-verification workflow for requested changes; see `AGENTS.md`. Changes to paid services, public data exposure or credentials still require appropriate approval.

## Infrastructure

The owner explicitly approved a MongoDB Atlas Free cluster for Genesis. The application database is separate from other projects, and its application user has read/write permissions only on `genesis`. Passwords are hashed; browser sessions use HTTP-only secure cookies rather than saved bearer tokens. Rate limiting is shared across server instances through expiring MongoDB records.

Vercel production variables are configured in project settings: `MONGO_URI`, `JWT_SECRET`, `INTERNAL_API_TOKEN`, `CONNECTOR_ENCRYPTION_KEY`, `WEB_ORIGIN`, and `WORKER_ENABLED=false`. Never place these values in GitHub or a frontend variable. Back up encryption keys separately: changing the connector key prevents existing connector secrets from being decrypted.

Public database network access must be explicitly approved and verified. Free Vercel deployments use changing outbound IPs; do not silently open Atlas network access. TLS and a strong database-scoped credential are required.

## Background service boundaries

The Vercel request handler deliberately does not start Bull workers, sockets or recurring schedulers. Redis and the persistent AI worker still require deployment and configuration for foundation analyses and automated competitor digests. Queue-dependent actions return a clear 503 when this infrastructure is missing, instead of claiming a report is running forever. Deterministic company analysis and manual financial/customer/scenario tools run in the web API and use saved MongoDB data.

Model-backed reports, recurring competitor checks, scheduled integration refreshes, automatic backups and a production restore rehearsal are separate verification gates. Do not describe the entire original v1 as complete merely because signup and Git deployment work.

## Checks

```sh
npm ci --prefix api
npm ci --prefix web
npm test --prefix api
npm test --prefix web
npm run build --prefix web
```

The database integration test requires `TEST_MONGO_URI=mongodb://127.0.0.1:27017/genesis_test_release`; it creates disposable test data and drops only that isolated test database. GitHub Actions supplies its own MongoDB service. Never point this test at production.
