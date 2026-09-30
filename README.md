# Genesis

**Founder operating intelligence: connect people, delivery, customers, and revenue to make better-informed decisions.**

Genesis brings company observations into a shared workspace, identifies risks and opportunities with supporting evidence, and tracks actions and decision outcomes. Its original seven-agent startup analysis remains available alongside the founder dashboard.

For example, Genesis can connect an overloaded team to an overdue project, follow that project's features to affected customers, and show the associated annual recurring revenue. Later observations help a founder review whether the underlying risk conditions changed.

## What you can explore

| Founder question | Feature |
| --- | --- |
| What needs attention today? | Founder brief, prioritized risks, and expandable evidence |
| Where is delivery under pressure? | Team capacity, project dependencies, and company relationship map |
| Which customers need a conversation? | Usage, support, renewal, payment, and revenue-concentration signals |
| What happens if we hire or lose a customer? | Financial runway, historical trends, and explicit what-if scenarios |
| Did our response help? | Assigned actions, later observations, and a decision journal |
| What supports this answer? | Company questions grounded in saved records and evidence |
| How can data enter the workspace? | Guided editor, CSV/JSON imports, GitHub workflows, and scoped ingestion |
| Is this startup idea worth investigating? | Seven AI perspectives: market, risk, legal, competition, assumptions, finance, and pitch |

**Project status:** a local prototype with synthetic demonstration data and automated checks. Live integrations, Google authentication, full browser acceptance testing, and production deployment still require configuration and verification. Revenue exposure is not a prediction of lost revenue; observed changes do not establish causation.

## Quick start

Install Docker with Compose, then run:

```sh
git clone https://github.com/iayamin6/Genesis.git
cd Genesis
cp .env.example .env
docker compose up --build
```

Open [Genesis at localhost:5180](http://localhost:5180), register a local account, and create a workspace. The UI needs the API and database; it is not a standalone static demo. In **Company data**, prepare and import the labeled sample to explore connected risks. The [setup guide](docs/setup.md) also explains the larger synthetic demo and local service development.

Model credentials are optional for the startup-analysis workflow: without a configured model provider, the service returns labeled fallback output. Live search and external integrations may still require network access. Company calculations use deterministic rules rather than LLM-generated numbers.

## Repository structure

```text
Genesis/
├── web/                    # React/Vite frontend
│   ├── src/features/       # Company, customers, decisions, scenarios, and other views
│   ├── src/components/     # Shared interface components
│   ├── src/lib/            # Data conversion, graph, and navigation helpers
│   └── test/               # Frontend data-helper tests
├── api/                    # Express API and background jobs
│   ├── src/intelligence/   # Company rules, evidence, scenarios, and decisions
│   ├── src/integrations/   # GitHub, ingestion models, and credential handling
│   ├── src/routes/         # Authenticated HTTP endpoints
│   ├── src/jobs/           # Bull queues and recurring work
│   ├── scripts/            # Synthetic demo and isolated integration checks
│   └── test/               # Domain-rule tests
├── ai-service/             # FastAPI, LangGraph, and provider adapters
├── docs/                   # Setup, architecture, import contract, and verification
├── deploy/                 # Backup tooling
├── docker-compose.yml      # Local development stack
└── compose.production.yml  # Deployment template; not a verified live deployment
```

## Technology and design

React and Vite provide the interface. Express and MongoDB manage workspace-scoped observations and records; Redis and Bull support background jobs. FastAPI and LangGraph orchestrate the AI workflow, with optional Groq or Ollama providers. MinIO stores analysis artifacts.

Company relationships use validated references within snapshots. Monetary exposure is calculated in integer minor units and deduplicated across overlapping paths. Historical observations and explicit scenario assumptions keep the calculations inspectable. See the [architecture guide](docs/architecture.md) for component boundaries.

## Development checks

Use Node.js 22.12+ and Python 3.11.

```sh
npm --prefix api ci
npm --prefix api test
npm --prefix web ci
npm --prefix web test
npm --prefix web run build
python3.11 -m venv .venv
.venv/bin/pip install -r ai-service/requirements.txt
(cd ai-service && ../.venv/bin/python -m pytest)
```

The [verification record](docs/verification.md) distinguishes automated checks from integration and production work that remains unverified.

## Documentation

- [Setup and synthetic demo](docs/setup.md)
- [Founder walkthrough](docs/founder-preview.md)
- [Architecture](docs/architecture.md) and [background jobs](docs/background-jobs.md)
- [Company import contract](docs/company-import.md)
- [Feature status](docs/remaining-features-status.md)
- [Production operations and recovery](docs/production-operations.md)
