# Company observations and the first demo

The command center accepts a complete JSON snapshot, not a partial patch. Every ID is stable within a workspace and every reference must exist in the same snapshot. IDs use letters, digits, underscores, and hyphens. Each import has a new `importKey` and an ISO UTC `observedAt` timestamp. Replaying identical data with its original key is safe; changing data under the same key is rejected. Observations cannot be in the future or older than the latest accepted observation.

Open **Company data** and use **Prepare sample data**, inspect the JSON, then **Validate and import**. This creates only explicitly labeled synthetic data. The sample demonstrates overloaded engineering, an overdue feature, three affected customers, and USD 83,000 in connected ARR. These are demonstration values, never claimed as the founder's company facts.

Create an action with an owner, deadline, reason, and expected result. Use **Edit latest observation**, update allocations, completion, and support counts to reflect a later observation, and import. The action then compares its baseline with the later evidence. A cleared rule means its conditions no longer hold; it does not prove causal success. Deleting dependencies produces an unknown outcome rather than claimed recovery.

## Contract

Required top-level fields: `importKey`, `observedAt`, `source: {kind, name}`, `currency`, and arrays `teams`, `employees`, `projects`, `products`, `features`, `customers`. `source.kind` is `manual`, `sample`, or `connector`. Connector provenance is currently a caller-supplied label, not verified external evidence.

All entities have `id` and `name`. Additional fields:

| Entity | Fields |
| --- | --- |
| Employee | `teamId`, `capacityHours`, `allocatedHours` (weekly planned hours) |
| Project | `teamId`, `ownerIds` (employees on that team), `dueDate` (YYYY-MM-DD), `completion` (0–100) |
| Feature | `projectId`, `productId` |
| Customer | `featureIds`, optional `requestedFeatureIds`, `arrMinor`, optional `renewalDate`, `openSupportIssues` |

Supported currencies are USD, EUR, GBP, BDT, CAD, AUD, INR, each represented in hundredths using integer `arrMinor`. Do not mix currencies in an observation or substitute monthly revenue for ARR. Customer relationships represent known feature dependencies supplied by the importer. Workload history requires multiple observations; a single observation cannot establish a percentage increase. Projects owned across multiple teams need a richer future contract; this first slice requires owners in the project's team.

## API

All routes require Bearer authentication and workspace membership. Viewer members can read but cannot mutate.

* `GET /api/workspaces/:id/intelligence`: latest observation, evidence, actions, outcome comparisons.
* `POST .../intelligence/import`: validate and persist a full snapshot with analysis.
* `POST .../intelligence/evaluate`: re-evaluate date-sensitive signals; deduplicated daily for the same observation.
* `POST .../intelligence/actions`: `riskKey`, `title`, `ownerId`, `dueDate`, `reason`, `expectedResult`.
* `PATCH .../intelligence/actions/:actionId`: `status` (`open`, `in_progress`, `completed`, `cancelled`).

The Bull dispatcher checks every 15 minutes; unchanged observations produce at most one periodic evaluation per UTC day. It does not refresh external company data. Import new observations to update workload, delivery, customer, and support evidence.

## Customer signals and priorities

The command center now separates Priorities, Actions, and Company data. Search matches signal text and customer names. Filters separate attention, opportunities, capacity, renewals, and concentration. Priorities sort by rule urgency, then connected ARR. Expand evidence to inspect relationships and account details; assign actions without leaving a priority. The Actions view defaults to active work and supports completed/cancelled filters, overdue labels, and outcome details.

Rules in `company-signals-v2`:

- Renewal attention: a renewal falls within 0–45 days inclusive and the customer has open support issues or unfinished overdue feature dependencies. A renewal within 14 days with both conditions is critical. No overload is required.
- Concentration: the top three positive-ARR imported accounts (or fewer if fewer exist) represent at least 50% of imported ARR. This is a review signal even for a small early customer base, not a judgment that the business is unhealthy. An incomplete customer import changes the denominator.
- Feature demand: at least three customers explicitly list a feature in `requestedFeatureIds`, and its project is unfinished. Dependencies in `featureIds` do not imply a request. Requested IDs must be unique and refer to existing features. Existing imports without this optional field remain valid.

Attention ARR is deduplicated across capacity and customer risk signals. Opportunity ARR describes existing revenue associated with requesting customers and is excluded from the attention total unless those customers also have attention signals. It is never projected new revenue.

Customer actions retain evidence baselines. If a signal disappears after a later import, the action needs review rather than being declared successful: a passed renewal date or changed request list does not prove recovery. Existing capacity action comparisons remain intact.

For observations evaluated with older rules, choose **Refresh signals**. Periodic evaluation keys include the rule version, so a prior same-day evaluation does not block the upgrade. Refreshing does not invent requests or fetch new source data.

## Guided company editor

Company data now opens a form editor for Teams, Employees, Projects, Products, Features, and Customers. IDs are generated for new records and preserved when editing. Teams and delivery relationships use named dropdowns; project owners and customer dependencies/requests use checkboxes. Workload is entered in weekly hours, completion as a percentage, and ARR in currency units with up to two decimal places.

Add or edit a record, choose **Add to draft**, then **Review changes** and **Save observation & update signals**. Changes do not reach the server until the final save. Review identifies added, edited, and removed records. **Undo last change** reverses committed draft edits. Records with active references cannot be removed until those relationships are updated. Changing a project team clears its draft owners; moving an employee between teams is blocked while incompatible project ownership remains.

Drafts survive switching between Priorities, Actions, and Company data within the same workspace. They are held in memory, not automatically stored on disk; save or download the draft before switching workspaces. Leaving/reloading the page with draft edits triggers a browser unsaved-change warning. Download draft exports committed draft records, not unfinished record-form edits. Set company currency before adding customers; the editor does not convert existing customer amounts.

The save flow checks whether another observation replaced its starting observation before submitting and keeps the draft if it detects a conflict. The backend remains the final validator. This preflight check is not an atomic multi-editor locking protocol.

Read-only members can inspect records but cannot edit. Editing sample data retains its sample source label. Existing JSON import remains under **Advanced: JSON import and sample data**. CSV import is not included in this increment.

## CSV import

In Company data, select a record type and choose **Import CSV**. The importer runs locally in your browser with no external service. Download a header template or choose a CSV/TSV file, select its separator, map columns, and choose **Preview import**. Preview shows additions, updates, normalized values, and row-level errors. Every error must be resolved before the batch can be added to the draft. The usual observation review/save step persists it and updates signals; **Undo last change** reverses a CSV batch before saving.

- Comma, semicolon, and tab separators are supported, including quoted fields, escaped quotes, and quoted multiline values. Files need unique, nonempty headers and consistent field counts. Maximum file size is 900 KB, with up to 1,000 data rows and 50 columns, subject to the existing entity limits.
- Map `id` to update an existing record; unknown valid IDs create new records. Omit IDs to generate new ones. Existing records expose **CSV update identifier** below their names. Duplicate new names, repeated IDs, and ambiguous relationships block the batch.
- Unmapped fields retain existing values on updates. New records require all mandatory values. Mapped blank optional values clear them. Map a name column for every import. One source column can map to only one destination field.
- Relationships accept IDs or case-insensitive exact unique names from the existing company draft. Separate multiple owners/features with `|`. Import teams before employees/projects, and products/projects before features/customers. Missing references are never silently created.
- Customer ARR uses the selected company currency in ordinary units, without currency symbols or thousands separators. Dates use YYYY-MM-DD. Explicit feature requests remain distinct from dependencies.
- Import adds or updates records and never deletes existing records. A file is not applied while any row has an error. Preview displays the first 50 valid records and first 30 issues; the full valid batch is added together once all issues are resolved.

This increment was implemented without running tests or build checks, as requested.

## Company relationship explorer

Open **Company map** to browse the saved observation. Search by record name, filter by record type, and select a team, employee, project, product, feature, or customer. The selected record shows its incoming/outgoing relationships. Click connected records to follow the graph; **Back** retraces up to 30 navigation steps.

The map draws only explicit relationships from company data: team membership, responsible teams, project ownership, project-to-feature delivery, product features, customer dependencies, and explicit feature requests. Requests are hidden by default and can be included with a toggle; their connections use dashed borders.

Connected customer ARR follows outgoing relationships and counts each customer once, including when several project/feature paths reach the same account. Selecting a customer shows that account's own revenue context. The total is associated recurring revenue, not a forecast of loss or a risk score. Incoming exploration does not turn every account in a connected component into downstream revenue exposure.

Related signals reference the selected record in their stored evidence paths or customer lists. These signal links are independent of the request-relationship display toggle. Actions are linked through those signals; selecting an employee also includes actions assigned to that employee. Open a signal to view its priority, or open Actions to manage work. The map does not mutate company records, and it is available to read-only workspace members. Unsaved editor drafts appear only after saving a new observation.

The explorer adds no external service or dependency. Tests and build checks were not run for this increment, following the current instruction.

## Decision memory

The Decisions view records choices independently of tasks. Each decision stores its original title, reason, alternatives, owner, expected result, and initial review date. It can link one current signal and up to ten existing workspace actions. Choose yourself as owner without importing employees, or select an employee. Original signal evidence, observation date, and source label are retained. This adds no paid API or external integration.

A review appends the actual result, lesson, reviewer, assessment, date, and available signal evidence. Assessments are user-reported: achieved, partially achieved, not achieved, or insufficient evidence. They do not assert statistical causation. A future follow-up date keeps the decision open; otherwise it becomes reviewed. Earlier reasoning and reviews remain available. The initial review date stays fixed even when the next review date changes.

Search covers titles, reasons, owners, and lessons. Filters show all, due, open, or reviewed decisions. Due dates use UTC. Read-only members can inspect decisions but cannot create or review them. Decisions and linked actions are workspace-scoped. Creation and review submissions have replay identifiers to avoid duplicate records on retries. The view loads the latest 100 decisions and each decision supports up to 50 reviews.

API additions, under `/api/workspaces/:id/intelligence`:

- `POST /decisions`: `requestId` (UUID), `title`, `reason`, `expectedResult`, optional `alternatives`, `ownerId` (`self` or an employee ID), `reviewDate`, optional `signalKey`, and optional `actionIds`.
- `POST /decisions/:decisionId/reviews`: `requestId` (UUID), `result`, `actualResult`, `lesson`, optional future `nextReviewDate`.
- The existing intelligence GET now includes `decisions`.

No tests or build checks were run for this increment, as requested. The local API was restarted to load the added routes.

## Scenario planner

The Scenarios view combines the existing financial snapshot/runway calculation with selected customer ARR and explicit user assumptions. Save an actual financial baseline with a currency first; historical financial observations without currency are not silently relabeled. Baseline entry reuses the financial API and creates a real FinancialSnapshot. Scenario calculations create separate CompanyScenario records and never change the financial baseline or operational observation.

Supported adjustments: immediate new hires and fully loaded monthly cost per hire, a one-time percentage adjustment to remaining monthly revenue, other recurring expense changes, one-time cash costs, and losing selected customers. Customer losses require matching currencies and existing customer IDs. Duplicate selected IDs are counted once. Monthly customer loss is ARR/12; a loss exceeding the financial monthly revenue baseline is rejected for reconciliation. Expense reductions cannot make total expenses negative.

Scenarios hold their original assumptions, financial/company observation dates, customer names/ARR, source provenance, baseline result, projected result, and monthly cash timeline. The UI shows a cash chart with an inspectable month control and an accessible data table. Up to three saved scenarios can be compared. Each scenario keeps its own baseline and currency; comparisons across differing baselines need interpretation.

Changes start immediately and remain constant. Revenue adjustments are not compounded growth. Hiring productivity, collections timing, seasonality, taxes, financing and working-capital effects are not modeled. Negative projected cash is a funding shortfall, not spendable cash. A nonpositive burn rate produces no finite depletion runway under those assumptions. One-time costs above starting cash produce an immediate funding gap and zero runway.

The existing intelligence GET includes `financial` and the latest 20 `scenarios`. `POST /api/workspaces/:id/intelligence/scenarios` accepts `name`, `hires`, `monthlyCostPerHire`, `revenueChangePct`, `monthlyExpenseDelta`, `oneTimeCost`, `lostCustomerIds`, and `months` (3–36). Workspace write permissions apply; viewers can read saved scenarios but cannot create them or update financial records.

No tests or build checks were run for this increment, following the current instruction. This is a deterministic scenario tool, not a validated predictive financial forecast.

## Deeper team intelligence

The Teams view uses `teamHealth` stored with each company evaluation under rule version `company-signals-v3`. Refresh signals to upgrade an older saved observation; the periodic job uses versioned keys and will also evaluate the new rules. No external service is required.

The analysis separates total allocation/capacity, net team overload, summed individual overload, and summed unallocated hours. Those measures are deliberately not interchangeable: individual pressure can coexist with unused capacity elsewhere. Allocation trends require the same employee IDs in the previous observation and a positive prior allocation. Membership changes or missing baselines produce an unavailable trend rather than a fabricated percentage.

Only unfinished projects appear as active work. Flags include individual overload, no recorded team members, unowned projects, sole recorded project owners, overdue projects, near-term deadlines (within 14 days and below 75% complete), and ownership concentration (at least two owned/co-owned active projects and at least 50% of the team's active projects). Flags are review prompts, not performance scores, causal conclusions, or automatic churn predictions.

Customer context follows project → feature → customer dependencies. Each customer is counted once within a project and once within a team total. Requests alone do not count as dependencies. Team totals can overlap and must not be summed as company-wide exposure. No skills, availability, hiring ramp-up, or productivity effects are assumed.

The view supports search, flagged-team filtering, team selection, people/ownership tables, project/customer evidence, rule definitions, and navigation to linked priorities, actions, or decision memory. Existing action and decision workflows are reused; team flags are not silently promoted into financial risk signals. Analysis uses saved observations and preserves the synthetic-data label shown by the command center.

No tests or build checks were run for this increment, following the user's current instruction.

### Connector observation freshness

Optional `domainsObservedAt` contains ISO timestamps for `customers`, `capacity`, and `delivery`, each no newer than the overall `observedAt`. GitHub progress updates advance delivery freshness while retaining customer and capacity timestamps. Customer comparisons use the preceding distinct customer measurement, so repeated delivery syncs cannot manufacture a new usage baseline. Manual editor saves attest a fresh full observation. Optional customer amounts in the editor and CSV use ordinary currency units; the JSON contract uses integer `outstandingAmountMinor`, consistent with `arrMinor`.
