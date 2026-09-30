# Remaining-feature implementation pass

This records what was implemented, what requires configuration, and what is not verified. It is not a production-readiness certificate. The current user instruction prohibits tests and build checks; none were run during this pass.

| Area | Implemented in this pass | Boundary |
| --- | --- | --- |
| Live integrations | GitHub issues, encrypted optional repository tokens, mapped project progress, pause/resume, manual/background sync, cached issue inventory, credential rotation | A repository/token must be configured; provider calls have not been exercised. Full lists are capped at 1,000 issue/PR entries. No partial progress import. |
| Other systems | Scoped bearer-secret ingestion endpoint for validated full company observations; same schema supports CRM, usage, payment, and support fields | This is a connector boundary, not native HubSpot, Stripe, Slack, Jira, or Salesforce adapters. Those systems need an adapter/export workflow that sends this contract. |
| External action execution | Exact GitHub issue preview, deliberate publish, stored external links, sync of closed/reopened status, uncertain-write reconciliation | Requires a token with issue write access. No external issue was created by this implementation session. Other task destinations are not native adapters. |
| Customer health | Optional account ownership, segment, active users/window, overdue payments, outstanding amount, support age, pricing concerns; combined health and expansion-review signals | Values come from imports/editor, not inferred personal behavior. Missing values stay unknown. Thresholds are review heuristics, not calibrated probabilities. |
| Competitor impact | User-recorded sourced observations, matching customer segments/selected accounts, deduplicated ARR and pricing concerns, linked actions/decisions | Sources are linked, not independently verified. Existing AI competitor research is labeled unverified and does not automatically create verified change alerts. |
| Operational scenarios | Hiring start month, linear capacity ramp, target team, explicit project delay and deferred-revenue assumptions, horizon cash/depletion | User assumptions are not learned productivity or churn models. Delayed revenue does not catch up later; 30-day buckets are explicit. |
| Financial forecasting | Six-month transparent linear trend from at least three comparable observations spanning 60 days | Requires sufficient dated history. Not a validated predictive model or confidence interval. |
| Company questions | Local evidence retrieval across current risks, teams, customers, finance, actions, decisions, and saved scenarios; cited records and saved Q&A history | This is bounded record retrieval, not unrestricted LLM conversation or multistep autonomous reasoning. No model API key needed. |
| Hardening | Production secret checks, AES-GCM connector secrets, scoped ingestion secrets, rate limits, async route error handling, signed JWT algorithm checks, OAuth state/verified-email checks, authenticated AI execution, local port binding, write audit, serialized imports | Auth/session architecture still uses bearer tokens in browser storage. Rate limiting is per process. Dependency findings and full security review remain unresolved. |
| Deployment/recovery | Separate production image/Compose definitions, static frontend proxy/security headers, database readiness endpoint, backup script and recovery instructions | These definitions were not built or deployed. TLS proxy, secrets, backups, restore rehearsal, vulnerability verification, browser QA, and live integration checks remain operator work. |

## How to use

- **Customers**: inspect account health; add optional metrics through Company data or ingestion.
- **More tools → Connections**: configure GitHub or create a scoped ingestion endpoint. Public GitHub reads can omit a token; private reads/publication need the appropriate repository permissions.
- **Connections → Publish action**: preview the exact content, then publish deliberately. Uncertain publication outcomes are locked until reconciliation rather than blindly retried.
- **More tools → Market impact**: add a competitor, source a recorded change, select affected segments/accounts.
- **More tools → Scenarios**: expand operational assumptions or historical financial trend.
- **More tools → Ask Genesis**: query saved company evidence and open cited records.
- **Refresh signals** upgrades older observations to `company-signals-v4`.

## Provider references used

Implementation follows GitHub's official [issue endpoints](https://docs.github.com/en/rest/issues/issues) and [fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens). The pinned request header is API version `2026-03-10`. Provider limits and permission requirements can change; configure the least repository access needed.
