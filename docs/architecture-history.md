# Initial architecture assessment — historical

## Existing repository

The repository is a small scaffold, not a complete operational intelligence platform. Inspection covered every source file, Docker configuration, and existing test.

| Area | Current implementation | Assessment |
| --- | --- | --- |
| Frontend | React workspace selector, idea trace, finance form, competitor list | Working foundation; no operational command center |
| API/auth | Express, JWT/password auth, optional Google OAuth, membership roles | Reuse; mutations currently allow viewers, internal callbacks lack authentication, run idempotency is globally scoped |
| Database | MongoDB/Mongoose: User, Workspace, AgentRun, Alert, FinancialSnapshot | Reuse Workspace as company boundary; no employees, teams, projects, products, features, customers, actions, decisions |
| Finance | Deterministic net burn, runway, baseline anomaly, delta scenarios | Reuse; company-level figures cannot establish customer ARR |
| Competitors | Workspace subdocuments, recurring digest, text snapshot comparisons | Partial; LLM summaries are not verified structured market observations |
| AI | FastAPI, seven-node LangGraph workflow, Groq/Ollama/fallback, search adapters | Reuse for optional explanations later; this is a workflow graph, not a company graph |
| Retrieval | Four framework documents with SHA-512-derived vectors in Chroma | Not semantic retrieval or company memory; replace before claiming semantic company grounding |
| Jobs/storage | Bull daily competitor dispatch, Redis, MinIO run artifacts | Extend existing jobs; scheduler is within API, not independently deployed |
| Verification | Five JS calculation tests, two Python graph structure tests | No API, tenancy, import, impact, or UI coverage |

## Smallest proposed architecture

Keep React, Express, MongoDB, Redis, and the existing AI service. Introduce no paid service, graph database, or additional deployment. Typed references inside immutable, workspace-scoped operational snapshots form the first company graph. This bounded import model favors an auditable vertical slice over many CRUD modules. A future connector can normalize into the same contract. Larger datasets can later move to indexed entity collections without changing the engine's contract.

Workspace remains Company; User remains the login identity, distinct from Employee. Existing FinancialSnapshot and embedded competitors remain authoritative for their current domains. Do not duplicate them. New operational snapshots contain Team, Employee (team reference and weekly capacity/allocation), Project (employee owners, team, deadline, completion), Product, Feature (project/product), Customer (feature dependencies, annual recurring revenue in integer minor units, renewal date, open support counts). Currency is single and explicit per snapshot. Historical snapshots preserve observations and source provenance.

Analysis stores structured events, impact paths, unique customer revenue exposure, rule severity, evidence confidence, recommendations, and an explicit uncertainty statement. Overload and overdue delivery are observed together; this does not prove workload caused delay. Exposed ARR is not predicted loss. No LLM calculates or invents facts. Missing baselines mean unknown change, never zero change.

One atomic analysis document stores the normalized snapshot and deterministic findings. Each workspace/import key is unique. Periodic jobs re-evaluate the latest snapshot for date-sensitive deadlines/renewals. Repeated evaluations for the same observation/day reuse their record. Older observations are rejected as new imports to prevent regressions. Full snapshots are capped to keep graph traversal and storage bounded.

Actions link to a stable risk key and capture employee owner, deadline, status, reason, expected result, and baseline evidence. Completion can be tracked independently from risk recovery. Outcome comparisons use later observations; report observed differences without claiming causal attribution. These action records provide the first decision memory; a broader decision/scenario system remains a later phase.

## First vertical slice and validation

1. Import validated JSON or explicitly load synthetic sample data.
2. Detect overloaded teams and unfinished overdue projects.
3. Traverse team → project → feature → customer; deduplicate ARR across features.
4. Show evidence, support/renewal context, limits, and recommended actions.
5. Assign an action, record intent, update its status, and compare later observations.
6. Re-evaluate using the existing Bull scheduler.

Tests must cover dangling references, duplicate identifiers, dates, negative/non-finite amounts, missing baselines, customer deduplication, completed projects, renewal boundaries, action outcomes, read-only roles, workspace isolation, replay/idempotency, and persisted API behavior. Preserve the five existing financial/competitor checks and compile the frontend. Run the full stack where locally available.

## Free-service policy and remaining roadmap

The first slice requires no external API, model key, or paid subscription. Existing self-hosted dependencies run locally. External connectors, live pricing/market evidence, statistical forecasts, opportunity rules, broader decision memory, and richer scenarios follow after this proof. Free-tier availability and quotas must be verified against provider documentation when a connector is actually selected; do not assume an unlimited or permanently free API.

Production follow-ups include secret management, rate limiting, OAuth account-linking review, backups, deployment hardening, connector consent/sync handling, larger graph storage, and data retention controls. Local demo readiness is not production certification.


This assessment predates the current implementation. See [current architecture](architecture.md).
