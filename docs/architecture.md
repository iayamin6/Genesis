# Architecture

[Back to Genesis](../README.md)

## Services

| Service | Responsibilities |
| --- | --- |
| `web/` | Founder navigation, company editor, evidence views, scenarios, and analysis traces |
| `api/` | Authentication, membership, validated imports, deterministic company intelligence, persistence, and integration endpoints |
| `ai-service/` | Seven-agent startup-analysis workflow, provider calls, framework retrieval, and authenticated progress callbacks |
| MongoDB | Workspace records, observations, decisions, actions, scenarios, and questions |
| Redis / Bull | Queued analysis and recurring jobs inside the API service |
| MinIO | Analysis artifacts |

## Company-intelligence path

A founder imports an observation through the editor, CSV/JSON interface, or a configured connector. The API validates entity IDs, references, dates, and monetary amounts before saving the workspace-scoped snapshot. Domain modules in `api/src/intelligence/` calculate capacity, delivery, customer, and revenue signals. The frontend presents the evidence and lets the founder record actions or decisions. Later observations support comparisons without overwriting the original baseline.

Snapshot references form the company relationship graph; no separate graph database is required. Exposure is deduplicated by customer and calculated using integer minor units. A cleared rule means its conditions changed, not that a particular action caused the improvement. Company questions use saved evidence and deterministic answer logic; they are distinct from the AI idea-analysis workflow.

## AI-analysis path

The API queues an analysis, the Python service runs the LangGraph workflow, and authenticated callbacks deliver progress to the API and browser. Market, risk, legal, competitive, and assumption analysis begin as parallel branches. Financial analysis follows market analysis; pitch synthesis waits for its required inputs. Model providers are optional and fallback output is labeled.

`ai-service/app/rag.py` currently performs lexical retrieval over a small set of framework documents. It is not semantic company search. ChromaDB remains in the inherited dependency list but is not used by this retrieval implementation.

## Code organization

Frontend views live under `web/src/features/`, shared UI under `components/`, and data/navigation helpers under `lib/`. The API separates HTTP routes, intelligence rules, integrations, and background jobs. Service-specific tests stay beside their respective services. The repository root contains the shared setup and Compose entry points.

See [import contracts](company-import.md), [background jobs](background-jobs.md), and [production operations](production-operations.md). The [initial assessment](architecture-history.md) is retained as historical design context, not a statement of current behavior.
