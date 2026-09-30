# Deployment and recovery

## Status

The files in `compose.production.yml`, `api/Dockerfile.production`, `web/Dockerfile.production`, and `web/nginx.conf` are deployment definitions, not an executed deployment. See [verification](verification.md) for local test/build results. Penetration checks, TLS setup, and restore rehearsals remain unverified. Existing dependency findings have not been certified fixed.

## Configuration

Supply secrets outside source control:

- `JWT_SECRET` and `INTERNAL_API_TOKEN`: independent random secrets of at least 32 characters; development defaults are rejected in production.
- `CONNECTOR_ENCRYPTION_KEY`: base64 encoding of exactly 32 random bytes. Keep this key backed up separately; losing it makes saved repository tokens unreadable.
- `WEB_ORIGIN`: the actual public HTTPS origin.
- `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`: non-default credentials.
- Optional Google client credentials and HTTPS callback URL. Automatic linking to existing password accounts is deliberately disabled; use the original sign-in method.

Development creates a local `api/data/connector.key` with restricted file permissions when encrypting the first connector credential. Docker development uses the api-data volume. Do not delete that file/volume while retaining encrypted tokens. Production has no implicit encryption-key fallback.

The production Compose stack publishes only `127.0.0.1:8080` for a static web server/API proxy. Place a properly configured TLS reverse proxy in front of it. MongoDB, Redis, MinIO, and AI service ports are not published. This is network isolation, not database-level authentication; consider dedicated authenticated stores in a shared-host deployment. Image tags should be pinned to vetted digests as part of release verification.

`/health` reports API process availability. `/ready` reports database readiness. The API no longer blocks startup waiting on the recurring scheduler; background failures are logged. A read-only UI can still operate if the queue is unavailable, but integrations and recurring intelligence will not refresh.

Nginx supplies CSP, frame blocking, no-sniff, and referrer controls for the production frontend. Trust-proxy forwarding is intentionally not globally enabled. Per-process rate limiting may count all proxied users together; configure a trusted proxy and distributed rate limiter before scaling public traffic.

## Data and secrets

Company observations, decisions, actions, scenarios, market records, and saved questions are workspace-scoped in MongoDB. Repository credentials are AES-256-GCM encrypted and omitted from normal connector reads. Ingestion secrets are hashed and returned only when created/rotated. Rotating an ingestion secret invalidates the old one. Pause a connection to stop its endpoint and future syncs; an in-flight read may still finish.

Write audit records omit bodies, tokens, and query strings; they retain route/method/user/workspace/status and expire after one year. Auditing is best-effort if MongoDB is unavailable. This is not a tamper-proof compliance audit.

JWTs remain bearer tokens stored by the frontend. They have an expiry but no revocation registry or password-reset workflow. Production authentication assessment, secure-session design, dependency remediation, and organization-level access provisioning remain release gates.

## Backup

From the repository root, `sh deploy/backup.sh /secure/local/backup/path` creates a new timestamped compressed MongoDB archive with restrictive file permissions. It does not overwrite an existing archive. The script has not been executed in this pass.

Back up MinIO artifacts and the secret configuration/encryption key separately. Keep backups encrypted and outside the live volumes. Decide retention and access requirements for the actual deployment; this project does not silently delete core company history.

## Recovery

1. Stop writers (API/scheduler) and preserve the current volumes before attempting recovery.
2. Restore into an isolated new MongoDB database using `mongorestore --archive=<archive> --gzip --nsFrom='genesis.*' --nsTo='genesis_recovery.*'`; do not use a destructive drop against live data.
3. Restore corresponding artifacts and configure the original connector encryption key.
4. Point an isolated API instance at the recovery database. Keep connectors paused so a recovery rehearsal cannot create external writes.
5. Validate membership, observations, evidence, and connector decryption before planning a controlled cutover. Those checks remain unperformed.

## External-write recovery

A published GitHub action has a unique marker in its issue body and one dispatch record per action. If a publication request fails after it may have reached GitHub, Genesis marks it uncertain and does not automatically POST again. Reconcile searches a complete bounded issue listing for the marker. If none or multiple match, inspect the repository manually; Genesis keeps the write locked rather than risking duplicates.

## Known constraints

- Native integrations in this pass are GitHub issues plus a generic snapshot ingestion API, not every provider in the product brief.
- GitHub progress is closed issue count / total issue count for the configured repository, not effort-weighted work completion.
- Generic ingestion replaces a full company observation; it is not a partial-update protocol. Sender-provided `observedAt` and provenance must reflect actual freshness.
- Import leases expire after 60 seconds. The current snapshot bounds keep normal analysis short; lease renewal is needed before supporting much larger graphs.
- Bounded read lists (20 scenarios, 100 decisions/actions/market records, 30 questions) need pagination for larger organizations.
- Production deployment, full integration tests, browser QA, and dependency remediation remain unverified. Do not present the project as production-certified.
