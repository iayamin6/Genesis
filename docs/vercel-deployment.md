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

On 2026-10-08 the owner explicitly approved Atlas access from any IPv4 address for Vercel's changing outbound IPs. The Genesis project now permits `0.0.0.0/0`; the endpoint is internet-reachable, not anonymously readable. TLS and the strong Genesis-scoped database credential remain required. Never expose that credential in browser code or GitHub. Revisit a narrower network policy if fixed outbound addresses become available.

## Live verification — 2026-10-08

The production health endpoint returned `200` with `database: connected`. Synthetic test accounts verified registration, secure HTTP-only session cookies, logout, fresh-client login, duplicate-account rejection, saved workspaces and financial snapshots, a four-month runway calculation, account isolation, and rejection of an untrusted request origin. These tests used invented QA data, not founder data. The public page now opens the signup form instead of the account-storage-unavailable screen.

The GitHub-triggered production deployment and GitHub Actions checks passed for commit `b57f8ef`. Database connectivity does not depend on a local computer remaining on. Compass is an optional administrator desktop client, not the database host, and founders do not need it.

Browser verification also covered registration, sign-out, return login, workspace restoration, importing explicitly synthetic company data, and opening People & delivery. The live dashboard correctly displayed 107 allocated hours against 80 hours of capacity, 27 hours of individual overload, two people above capacity, and one overdue project. These are test fixtures, not claims about any real founder's business. Workload trends correctly remained unknown without an earlier observation.

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
