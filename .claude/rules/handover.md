# RMIS Frontend — Current Status

## Module we're on
Module 13: Risk Indicators (functionally complete, wired up 2026-09-23) —
five live early-warning flags per active project. API-smoke-tested by
Claude only — not yet browser-tested. See the Module 13 bullet below for
what's built.

## Design reference
`../University Research Operations Website` (sibling dir to this repo) is a
Figma Make prototype (mock data, no real backend) that was the original
design intent for this app's look. It uses navy + **cyan** as its palette;
our app previously used navy + gold (a branding call made in an earlier
session, since reverted 2026-09-22 per client instruction to match the
reference instead). Two cyan shades matter and are NOT interchangeable:
`#0891b2` (rich/dark) for accents on light backgrounds, `#67e8f9`
(bright/light) specifically for text/borders that sit on the navy sidebar —
the reference itself uses both shades for exactly this reason, so a blind
single-color rename would have broken contrast in a few spots (the
AuthCallbackPage spinner, sidebar active-nav text). See `--lspu-cyan` /
`--lspu-cyan-light` in `src/index.css`.

The reference's "Compliance" module models something different from our
actual backend (a generic requirement-tracker with define/assign/evidence/
review workflow, vs. our real Module 6's Ethics Reviews/Similarity Checks/AI
Declarations/COI/Misconduct logs) — client confirmed: keep our real data,
don't chase the reference's Compliance content, only its visual language.

Scope agreed with client 2026-09-22: **design-system pass only** — shared
tokens/components (colors, sidebar, topbar, card/badge style), not a
per-page rebuild to match the reference's bespoke KPI-strip/stat-tile
layouts. Since every page here is built on the same shared shadcn
components and CSS custom properties (unlike the reference's per-page
inline-styled JSX), a token-level change already propagates everywhere
automatically — most pages needed zero code changes for this pass.

## Frontend status (this repo)
- Module 1 (Auth/RBAC pages): done, stable.
- Module 2 (Programs/Projects/Studies/Milestones pages): done, stable. UI
  reworked 2026-09-22 per client request: ProjectsPage's two inline "Register
  a Program"/"Register a Project" forms (the project one had 20+ fields) were
  pulled out into dedicated pages (RegisterProgramPage at /programs/new,
  RegisterProjectPage at /projects/new) — chose full pages over a modal
  because the project form is too long for a comfortable dialog. Buttons now
  live in each table's card header instead of inline forms cluttering the
  list. Same canRegister (system_admin/crc_chair) gating, now enforced via
  RoleGate at the route level like /staff, /budget, etc. Browser-tested:
  navigation, both forms rendering correctly, and Program registration
  end-to-end (create → redirect → appears in table) all confirmed working.
- Module 3 (Personnel/Roles/Task Coordination pages): done, stable.
- Module 4 (Budget pages): BudgetPage built against budget_lib — project selector,
  line items, add-item form, certify, plus a Budget Summary section (Approved/
  Adjusted/Actual/Available) that lights up once a budget is certified.
- Module 5 (Disbursements/Realignments): DisbursementsPage built against
  financial_monitoring — record disbursements against a certified budget's line
  items, request fund realignments (existing item or new BOR-tier item), and
  review pending ones inline (BOR tier requires a resolution number). Review is
  tier-gated per client confirmation 2026-09-22: major tier (33-100%) can be
  reviewed by university_admin or system_admin; BOR tier (>100%/new item) is
  system_admin only. A pending row a viewer can't act on shows "Awaiting ..."
  instead of the Approve/Reject buttons. Untested end-to-end — backend migrated
  and smoke-tested via shell only, not yet hit with real HTTP requests on either side.
- Module 6 (Ethics/Integrity/Compliance): CompliancePage built against the
  compliance app — project selector + a pill tab switcher across five reference
  logs (Ethics Reviews, Similarity Checks, AI Declarations, COI Disclosures,
  Misconduct Cases). No approval workflow anywhere here, matching the backend:
  these are logs of external process outcomes, not adjudication. Ethics reviews,
  similarity checks, and misconduct cases are riuh/system_admin write; AI
  declarations and COI disclosures are self-service (any authenticated user).
  COI status updates are riuh/system_admin only. Misconduct case "subject" is
  captured as free-text subject_name only — no user picker — to keep the form
  simple; the backend also accepts a system-user subject FK but the frontend
  doesn't expose it. Browser-tested 2026-09-22 (Playwright, headless, throwaway
  test account+data, cleaned up after): Ethics Reviews, Similarity Checks
  (threshold flagging confirmed for both under/over 20%), COI Disclosures, and
  Misconduct Cases all work end-to-end including inline status updates. AI
  Declarations initially failed with a 400 ("This field is required.") — a real
  backend bug (`AIUseDeclarationSerializer` didn't mark `declared_by` read-only,
  unlike every sibling serializer in that file) — fixed in rmis-backend
  (compliance/serializers.py) and re-verified working.
- Module 7 (Documents): DocumentsPage built against document_management —
  project selector, upload form (any authenticated user, no role gate — matches
  backend's `IsAuthenticated`-only permission on the list/create view),
  current-vs-all-versions toggle, Download (fetches the detail endpoint for a
  fresh signed URL, then `window.open`s it — list responses omit `download_url`
  on purpose to avoid N+1 signing calls), and Archive (riuh/system_admin only).
  Browser-tested 2026-09-22 end-to-end against real Supabase Storage: uploaded
  a real PDF through the actual multipart form, verified the returned
  `download_url` resolves and the downloaded bytes match the original file
  exactly, then archived it. No bugs found this time. Client-side 25MB size
  check added ahead of upload to match the backend's cap and avoid a wasted
  round trip. Test document + storage object + test account all cleaned up
  after.
- Module 8 (Research Output and IP Tracking): OutputsPage built against the
  outputs app — project selector + a pill tab switcher across Publications,
  IP Records, Creative Works, and SENSE-Ranked Publishers (a global lookup
  table, not project-scoped — its tab works without a project selected).
  `estimated_incentive` (Publications) and `incentive_eligible` (IP Records)
  are server-computed per the Manual's Article V incentive tables — the
  frontend only renders them, never recomputes. Simplification: `lead_author`
  (Publications), `creator` (IP Records, Creative Works) are set to the
  current user automatically, no picker — matches the self-service pattern
  used for AI Declarations/COI Disclosures in Module 6; `co_creators` stays
  free-text like the model already provides. Write roles mirror the backend
  exactly: system_admin/riuh/project_leader/study_leader for Publications and
  IP Records, plus project_staff for Creative Works, system_admin/riuh only
  for the SENSE Publisher list. Browser-tested 2026-09-22 end-to-end: a
  journal article (ISI, impact factor 2.5) correctly computed ₱60,000, a book
  with a SENSE-ranked publisher correctly computed ₱75,000, an IP record's
  eligibility badge correctly flipped disclosed→registered (eligible)→claimed
  (not eligible again, per the "once per patent" rule), and the Creative Work
  registration toggle worked. No bugs found. All test data and the test
  account cleaned up after.
- Module 9 (Project Monitoring and Reporting): MonitoringPage built against
  the monitoring app — project selector + a pill tab switcher across Status,
  Monthly Reports, Midterm Reports (Appendix E), Terminal Report (Appendix
  F, one per project), Evaluations, and Renewal Applications. `document` on
  each report is an optional FK picked from a Select of that project's
  already-uploaded documents (via document_management's list endpoint) —
  no new upload UI, reuses Module 7. `escalation_status`,
  `budget_used_pct`/`deliverables_pct`, and `renewal_eligible` are all
  server-computed live (no Celery/cron on the backend) — the frontend only
  renders them, same pattern as `estimated_incentive` in Module 8. Terminal
  report certify and renewal-application decide are separate action
  endpoints (POST .../certify/, POST .../decide/), same shape as
  budget certify (Module 4) and realignment review (Module 5). Write roles
  mirror the backend exactly: system_admin/riuh/project_leader/study_leader/
  project_staff can submit monthly/midterm/terminal reports and renewal
  applications; system_admin/riuh only can certify a terminal report;
  system_admin/vprei/drd/crc_chair (the evaluation panel) can schedule
  evaluations and record outcomes; system_admin/riuh/drd/vprei can decide
  renewal applications. Nav entry at `/monitoring` was previously
  `ready: false` and scoped to oversight tiers only — flipped to `ready:
  true` and widened to all research tiers (`ALL_RESEARCH`) since reads are
  `IsAuthenticated`-only on the backend and project/study leads and staff
  can submit reports too, same as Documents/Outputs. Claude smoke-tested
  every endpoint directly against the real dev DB with a JWT minted for the
  system_admin test account (all 5 list/create endpoints plus certify,
  decide, and the evaluation PATCH), response shapes checked against the
  frontend types field-by-field, then all test rows deleted (no Chrome
  extension was available in that session for a real click-through).
  Client then manually browser-tested end-to-end 2026-09-23 against project
  Test-100 (RFA-3456-333) — all six tabs confirmed working.
- Module 10 (Analytics and Institutional Reporting): AnalyticsPage built
  against the dashboard app — 7 tabs: Projects, Budget, Compliance, Outputs,
  REI Thrust Alignment, Planning Targets, and Data Exports. First use of
  shadcn's `chart` component in this repo (`npx shadcn add chart`, pulled in
  `recharts` — see `@/components/ui/chart.tsx`); every breakdown (by status/
  funding type/campus/type) renders as a single-color horizontal bar chart
  via `CountBarChart`, since color isn't carrying series identity here (one
  measure, axis labels carry category identity) — this sidesteps a real
  finding: the brand's navy/slate chart tokens (`--chart-1`, `--chart-5` in
  index.css) fail the dataviz skill's colorblind-safety validator as bare
  categorical swatches (too dark/desaturated to read as color, though still
  clearly distinguishable — CVD separation passes fine). Kept the brand
  colors rather than introducing off-brand ones since every chart here is
  single-series; flagged to the client, not silently overridden. Planning
  Target comparison is the one place color *is* status (good/warning/
  critical vs. `pct_of_target`, using `--success`/`--warning`/`--destructive`
  — reserved status colors, not decorative) and every bar is direct-labeled
  so color is never the only signal. Field-type gotcha worth remembering:
  `dashboard/services.py` builds its Response dicts by hand instead of going
  through a ModelSerializer, so Decimal aggregates (`total_approved`,
  `total_actual`, `total_estimated_publication_incentive`,
  `PlanningTargetComparison.target_value`/`actual_value`/`pct_of_target`)
  serialize as plain JSON numbers — unlike every other Decimal field in this
  app (e.g. `LineItem.amount`), which goes through a ModelSerializer's
  DecimalField and comes back as a **string**. Confirmed both ways by curl
  before typing `dashboard.ts`; don't assume string just because it's money.
  Planning Targets have no PATCH/DELETE on the backend (ListCreateAPIView
  only) — the UI reflects that: create + list only, no edit/delete affordance.
  `/analytics` route is role-gated (system_admin/vprei/university_admin/drd/
  crc_chair/riuh/finance_budget) even though every dashboard GET is
  `IsAuthenticated`-only on the backend — deliberate product scoping (this is
  institution-wide aggregate reporting, not a module individual project
  leads/staff need), same pattern already used for `/budget` and
  `/compliance`, unlike Outputs/Documents/Monitoring which stayed open to
  all research tiers. `npm run build`/`eslint` clean. Claude smoke-tested
  every endpoint (5 dashboards, planning-target create + list + comparison,
  appendix-e/f/g exports) directly via curl with a minted JWT — response
  shapes matched the new TS types exactly, one throwaway planning target
  deleted after (no DELETE endpoint exists, so it was removed via Django
  shell). Not yet browser-tested — dev servers left running for the client.
- Module 11 (Budget Forecasting): BudgetForecastPage built against the
  forecasting app — project selector limited to institutional/externally-
  funded projects (Core-Funded is out of this module's scope), role-gated
  "Run New Forecast" button (system_admin/drd/vprei/finance_budget), a
  clickable run-history table, and a detail card with an ARIMA forecast
  chart (shadcn `chart` + recharts `ComposedChart`: a range-`Area` confidence
  band plus a `Line`, single accent color since it's one series with the
  endpoint value labeled directly rather than every point) plus backtest
  stats (MAE/RMSE/MAPE, "Not backtested" fallback when history is too short
  to hold out a backtest window) and a destructive-badge overrun-risk flag
  (projected total at the 3-month horizon vs. approved budget). A run needs
  at least 6 months of disbursement history to fit an ARIMA model — fewer
  than that returns `status: "insufficient_data"` with an explanatory
  message rather than erroring, and the UI just shows that message instead
  of a chart. `/budget/forecast` route is role-gated (system_admin/vprei/
  university_admin/drd/finance_budget), matching nav.ts's tiers
  (system_admin/institution_oversight/finance) — same oversight/finance-only
  pattern as Budget, Compliance, and Analytics. Field-type note: unlike
  dashboard's raw-dict endpoints, `ForecastRun`/`MonthlyForecast` go through
  a ModelSerializer, so `predicted_amount`/`lower_bound`/`upper_bound`/`mae`/
  `rmse`/`mape`/budget totals all come back as **strings**, not numbers —
  confirmed by curl before typing `forecasting.ts`. Claude smoke-tested the
  full pipeline against the real dev DB: seeded 8 months of throwaway
  disbursements to force a real ARIMA fit and confirmed the success path
  (forecast points, confidence bounds, backtest metrics, overrun-risk flag
  all present and correctly typed), then confirmed the insufficient-data
  path with fewer months, then deleted all seeded disbursements and forecast
  runs afterward via Django shell (no DELETE endpoint exists on either). Not
  yet browser-tested by the client — the real project currently has no
  disbursement history, so a first click-through will hit the
  insufficient-data path, not the chart, until real disbursements exist.
- Module 12 (Decision Support System): DecisionSupportPage built against the
  decision_support app — 3 pill tabs: Criteria, AHP Weighting, and Funding
  Recommendations. This module has no Manual precedent (docx-spec only), so
  the default criteria set (output volume, compliance completeness, budget
  utilization, monitoring health, renewal eligibility, forecast overrun-risk
  inverse) is a reasonable choice drawn from data RMIS already tracks, not
  something client-confirmed — flagged as such in the model docstring and
  worth a sanity check with the client before a real funding cycle uses it.
  AHP tab: create a run against a chosen criteria subset, fill in pairwise
  comparisons via a Saaty 1–9 scale dropdown per pair (labeled by meaning,
  not raw numbers, e.g. "3 — Row moderately more important"), then one
  "Finalize Weights" action submits all pairs and finalizes in sequence
  (the backend supports incremental submission across multiple calls before
  finalizing, but the UI collapses that into one step since there's no
  reason here to leave a run in a submitted-but-not-finalized state).
  Finalize computes weights + consistency ratio (CR) via eigenvector
  approximation; CR > 0.10 finalizes anyway (matches backend) but is flagged
  as inconsistent and excluded from the recommendation trigger's AHP-run
  picker. Funding Recommendations tab: trigger a WSM scoring pass (optional
  funding_type/campus filters, no project picker — omitting `project_ids`
  scores every project matching the filters, matching the backend's
  default), ranked table with a per-criterion normalized-score column
  (traceability, not a chart — a ranked table with visible per-criterion
  breakdown reads better than a bar chart when the actual ask is judging
  exact composite scores against each other for a funding decision) plus a
  live sensitivity-analysis panel (bump one criterion's weight, see the
  re-ranked table, rank changes badged directly rather than color-only).
  Only 3 finalized-run statuses gate anything: draft AHP runs can't be used
  to trigger a recommendation, and neither can an inconsistent one (CR >
  0.10) — both enforced server-side, mirrored in what the UI's picker
  offers. Write roles mirror the backend exactly: system_admin/drd/vprei
  only for creating criteria, creating/finalizing AHP runs, and triggering
  recommendation runs; reads (criteria list, AHP run list/detail,
  recommendation run list/detail, sensitivity) are `IsAuthenticated`-only on
  the backend, same institution-wide-reporting product scoping as Analytics/
  Budget Forecast applied at the route level (system_admin/vprei/
  university_admin/drd/finance_budget can view; only the DSS write-roles
  subset can operate it). Route `/decision-support` reuses a nav.ts entry
  that already existed ("Funding recommendations") — just flipped `ready`
  to true, no other nav change needed. `tsc --noEmit` and `eslint` both
  clean. Claude smoke-tested the full pipeline against the real dev DB:
  created 3 throwaway criteria, an AHP run, submitted comparisons, finalized
  (CR 0.0032, consistent), created a second throwaway project so there were
  2 WSM candidates, triggered a recommendation run, ran sensitivity
  analysis — every response shape matched the new TS types exactly (all
  numeric fields here are plain JSON numbers via FloatField/JSONField, not
  Decimal-as-string like forecasting.ts), including confirming the
  min-max-normalize tie-handling path when both candidates scored
  identically. All throwaway criteria/AHP run/recommendation run/project
  deleted afterward via Django shell (no DELETE endpoint exists on any of
  these). Not yet browser-tested by the client.
- Module 13 (Risk Indicators): RisksPage built against the risk_indicators
  app — a pure read-only reporting module, no models/writes at all (both
  endpoints are computed on read, same no-Celery/cron live-compute
  convention as Module 9's escalation status, reusing several of its
  compute functions directly). Two tabs: Institution Overview (dashboard —
  optional campus/funding_type filters, stat tiles for total/low/medium/
  high active-project counts, and a table of only the projects that have at
  least one flag, each flag rendered as a destructive badge with a tooltip
  detail) and Project Risk Status (project selector + the same 5-flag
  breakdown for one project regardless of whether it's currently flagged,
  via the separate per-project status endpoint). The 5 flags: non-submission
  warning (reuses Module 9's `compute_escalation_status`), budget
  underutilization (<70% used, reuses Module 9's `compute_budget_used_pct`),
  deliverable slippage (any overdue, non-done milestone), personnel change
  frequency (2+ changes in a trailing 12-month window), and forecast overrun
  (reuses the latest successful `ForecastRun.is_overrun_risk` from Module
  11 — `null`/`has_forecast: false` if none exists yet, not treated as a
  flag either way). `risk_level` (low/medium/high) is a simple flagged-count
  threshold (0 / 1-2 / 3+) computed alongside the flags, not stored.
  Dashboard only lists projects with `status: "active"` and only returns
  projects with `flagged_count > 0` in `flagged_projects` — a "low risk,
  zero flags" project only shows up in the `by_risk_level.low` tally, not as
  a row, which is why the Project Risk Status tab's per-project endpoint
  exists separately (it works for any project, flagged or not). No write
  roles anywhere in this module (both endpoints are `IsAuthenticated`-only
  GETs) — the frontend has no canManage concept here, unlike every other
  module so far. Route `/risks` reuses a nav.ts entry that already existed
  — just flipped `ready` to true, tiers unchanged
  (`[...OVERSIGHT, "project_management"]`, mapped 1:1 to role codes on the
  RoleGate). All numeric fields here are plain floats/ints (no Decimal
  fields anywhere in this module), confirmed by curl before typing
  `risk.ts`. `tsc --noEmit` and `eslint` both clean. Claude smoke-tested
  both the clean path (project 11 as-is: low risk, all 5 flags clear) and a
  forced flagged path (created one throwaway overdue `WorkPlanMilestone` via
  Django shell to trip deliverable_slippage, confirmed it correctly bumped
  risk_level to medium and appeared in the dashboard's flagged_projects,
  then deleted it and reconfirmed the dashboard was back to its clean
  all-low state). Not yet browser-tested by the client.

## Backend endpoints available to consume right now
budget_lib (Module 4):
- GET/POST /api/budget/budgets/?project=<id>, POST .../certify/
- GET/POST /api/budget/line-items/?budget=<id>

financial_monitoring (Module 5):
- GET/POST /api/financial/disbursements/?budget=<id> (finance_budget/system_admin only to POST)
- GET/POST /api/financial/realignments/?budget=<id> (project_leader/system_admin only to POST;
  tier and status are server-computed)
- POST /api/financial/realignments/<id>/review/ — major tier: university_admin/
  system_admin; BOR tier: system_admin only (client-confirmed 2026-09-22, no BOR
  role exists in-system). BOR approval requires bor_resolution_number.
- GET /api/financial/budgets/<id>/summary/ — Approved/Adjusted/Actual/Available per line item

compliance (Module 6):
- GET/POST /api/compliance/ethics-reviews/?project=<id>&study=<id> (riuh/system_admin to POST)
- GET/POST /api/compliance/similarity-checks/?project=<id>&study=<id> (riuh/system_admin to POST;
  is_within_threshold is server-computed against 15%/20% thresholds)
- GET/POST /api/compliance/ai-declarations/?project=<id>&study=<id> (any authenticated user, self only)
- GET/POST /api/compliance/coi-disclosures/?project=<id> (any authenticated user creates; status/
  mitigation PATCH is riuh/system_admin only)
- GET/POST /api/compliance/misconduct-cases/?project=<id> (riuh/system_admin only)

document_management (Module 7):
- GET /api/documents/documents/?project=<id>&study=<id>&document_type=<t>&stage=<s>&current_only=true
  — list uses the lighter serializer, no download_url (avoids N+1 signed-URL calls)
- POST /api/documents/documents/ (multipart, `file` field; any authenticated user) —
  version_number and is_current are server-computed per (project, document_type, study)
- GET /api/documents/documents/<id>/ — includes a fresh signed `download_url` (1hr expiry)
- POST /api/documents/documents/<id>/archive/ — riuh/system_admin only, no hard delete anywhere

outputs (Module 8):
- GET/POST /api/outputs/publications/?project=<id>&study=<id> (system_admin/riuh/
  project_leader/study_leader to POST; estimated_incentive is server-computed)
- GET /api/outputs/sense-publishers/ (any authenticated user), POST (system_admin/riuh only)
- GET/POST/PATCH /api/outputs/ip-records/?project=<id>&study=<id> (same write roles as
  publications; incentive_eligible is server-computed, incentive_claimed is a manual
  RIUH/report-role flag to prevent double-counting)
- GET/POST/PATCH /api/outputs/creative-works/?project=<id> (write roles above + project_staff)

monitoring (Module 9):
- GET /api/monitoring/status/<project_id>/ — live snapshot (escalation_status,
  months_since_last_report, budget_used_pct, deliverables_pct,
  midterm_submitted_years, terminal_submitted); any authenticated user
- GET/POST /api/monitoring/monthly-reports/?project=<id> (system_admin/riuh/
  project_leader/study_leader/project_staff to POST; unique per project+period,
  `period` gets normalized to the 1st of the month server-side)
- GET/POST /api/monitoring/midterm-reports/?project=<id> (same write roles;
  unique per project+project_year)
- GET/POST /api/monitoring/terminal-reports/?project=<id> (same write roles;
  OneToOne per project — POST a second time 400s)
- POST /api/monitoring/terminal-reports/<id>/certify/ — system_admin/riuh only
- GET/POST /api/monitoring/evaluations/?project=<id> (POST: system_admin/vprei/
  drd/crc_chair), PATCH /api/monitoring/evaluations/<id>/ (same roles;
  evaluated_by/evaluated_at auto-set server-side the moment outcome leaves "pending")
- GET/POST /api/monitoring/renewal-applications/?project=<id> (POST: same roles
  as monthly/midterm/terminal reports; renewal_eligible/budget_used_pct/
  deliverables_pct are computed, not stored)
- POST /api/monitoring/renewal-applications/<id>/decide/ — system_admin/riuh/
  drd/vprei only, body `{"status": "approved"|"denied"}`

dashboard (Module 10):
- GET /api/dashboard/projects/?campus=<c>&funding_type=<t> — total_projects,
  by_status/by_funding_type/by_campus counts; any authenticated user
- GET /api/dashboard/budget/?campus=<c> — project_count, total_approved,
  total_actual, utilization_pct (null if no certified budgets in scope)
- GET /api/dashboard/compliance/ — no filters; ethics/COI/misconduct counts
  by status, similarity-check within/over-threshold counts, AI declaration count
- GET /api/dashboard/outputs/?year=<y> — publications_by_type, ip_records_by_status,
  creative_works_count, total_estimated_publication_incentive, ip_incentive_eligible_count
- GET /api/dashboard/rei-thrust-alignment/ — no filters, no campus/funding_type param
- GET/POST /api/dashboard/planning-targets/ (POST: system_admin/riuh/drd/vprei
  only; no PATCH/DELETE route exists — targets are create-once). `target_value`
  is a **string** here (ModelSerializer DecimalField)
- GET /api/dashboard/planning-targets/comparison/?year=<y> — actual vs. target
  per row, computed live; `target_value`/`actual_value`/`pct_of_target` are
  plain **numbers** here (raw dict, not a serializer — different from the line above)
- GET /api/dashboard/exports/appendix-e/<project_id>/ — array, one entry per
  midterm report year
- GET /api/dashboard/exports/appendix-f/<project_id>/ — single object, or 404
  `{"detail": "..."}` if no terminal report exists yet
- GET /api/dashboard/exports/appendix-g/?campus=<c>&year=<y> — single
  institution-wide (or campus-scoped) summary object
- All dashboard/export GETs are `IsAuthenticated`-only (no role restriction);
  the frontend's `/analytics` route is still role-gated as a product choice
  (see Module 10 bullet above)

forecasting (Module 11):
- GET /api/forecasting/runs/?project=<id> — list past forecast runs for a
  project, each with nested `forecasts` (monthly predicted/lower/upper);
  any authenticated user
- GET /api/forecasting/runs/<id>/ — single run detail (same shape)
- POST /api/forecasting/runs/trigger/ body `{"project": <id>}` —
  system_admin/drd/vprei/finance_budget only; fits ARIMA on disbursement
  history, backtests if there's enough history to hold out a window,
  computes overrun risk; needs 6+ months of history or returns
  `status: "insufficient_data"` instead of erroring. No DELETE endpoint.

decision_support (Module 12):
- GET/POST /api/decision-support/criteria/ (POST: system_admin/drd/vprei
  only). No PATCH/DELETE — criteria are create-once, like Planning Targets.
- GET/POST /api/decision-support/ahp-runs/ (POST: same roles) — `criteria`
  is a list of criterion ids on create; `weights`/`consistency_ratio`/
  `is_consistent` are null until finalized
- GET /api/decision-support/ahp-runs/<id>/ — includes nested `comparisons`
- POST /api/decision-support/ahp-runs/<id>/comparisons/ body
  `{"comparisons": [{"criterion_row": id, "criterion_col": id, "value": n}]}`
  — same roles; only valid on a draft run; the backend normalizes
  row/col ordering and reciprocal values itself, so the caller doesn't need
  to pre-sort pairs
- POST /api/decision-support/ahp-runs/<id>/finalize/ — same roles; 400s if
  fewer than n*(n-1)/2 comparisons exist; computes weights + CR via
  eigenvector approximation and sets status to finalized either way (CR >
  0.10 just flags `is_consistent: false`, doesn't block finalizing)
- GET/POST /api/decision-support/recommendation-runs/ (any authenticated
  user to GET; trigger below is how you POST) — nested `scores` per project
- POST /api/decision-support/recommendation-runs/trigger/ body
  `{"ahp_run": id, "label"?, "funding_type"?, "campus"?, "project_ids"?}` —
  system_admin/drd/vprei only; requires a finalized + consistent ahp_run;
  needs 2+ candidate projects after filtering or 400s
- GET /api/decision-support/recommendation-runs/<id>/ — single run detail
- GET /api/decision-support/recommendation-runs/<id>/sensitivity/?criterion=<id>&delta=<f>
  — any authenticated user; live-computed re-ranking, not persisted

risk_indicators (Module 13):
- GET /api/risk/dashboard/?campus=<c>&funding_type=<t> — any authenticated
  user; scoped to active projects only; `flagged_projects` only includes
  projects with `flagged_count > 0`
- GET /api/risk/status/<project_id>/ — any authenticated user; works for
  any project regardless of status or flag count. No write endpoints exist
  in this module.

## Design pattern to follow
Same as ProjectsPage/ProjectDetailPage: AppShell + ProtectedRoute + PageHeader
+ EmptyState + TableSkeletonRows + notify toasts, gate write-forms behind a
canManage-style role check computed from useAuth().

## Known gaps / things to double check once backend is live
- Realignment "once per calendar year per project" and "60 days before
  target_end_date" rules are enforced server-side only — no client-side
  pre-check, so the form just surfaces whatever error message the backend returns.
- BOR-tier review requires typing a resolution number inline before Approve is
  clicked; there's no separate confirmation step.

## Last thing done in this repo
Wired up Module 13 (Risk Indicators): added src/types/risk.ts,
src/lib/riskApi.ts, src/pages/RisksPage.tsx, the role-gated `/risks` route
in App.tsx, and flipped its (pre-existing) nav.ts entry to ready (see
Module 13 bullet above for the flag-detail and dashboard-scoping details
worth remembering). `tsc --noEmit` and `eslint` both clean. Claude
smoke-tested both the clean path (project 11 as-is) and a forced flagged
path (a throwaway overdue milestone created via Django shell to trip
deliverable_slippage, confirmed medium risk_level and the dashboard's
flagged_projects both updated correctly), then deleted the throwaway
milestone and reconfirmed the dashboard was back to clean. Not yet
browser-tested by the client.

## Next thing to do in this repo
1. Browser-test Module 13 end-to-end — both tabs, and ideally with at least
   one real flag active (the dev DB's one project is currently clean/low
   risk on all 5 flags) to see the medium/high styling for real.
2. Browser-test Module 12 end-to-end — define a couple of real criteria,
   run a full AHP weighting + funding recommendation cycle, and sanity
   check whether the default criteria set (output volume, compliance,
   budget utilization, monitoring health, renewal eligibility, forecast
   overrun-risk) is actually what the client wants scored, since it's a
   reasonable default rather than something client-confirmed.
3. Browser-test Module 11 end-to-end once there's real disbursement history
   to forecast from (or ask Claude to seed temporary throwaway data again
   for a live look at the chart/success path).
4. Browser-test Module 10 end-to-end — walk all 7 tabs, set a planning
   target, and confirm the comparison chart's status coloring reads right
   once there's non-zero data to look at (the dev DB is currently sparse:
   1 project, no budgets/compliance/outputs recorded, so most charts will
   show their empty state rather than real bars).
5. Browser-test pass for Modules 4-5 (Budget, Disbursements/Realignments) —
   only Modules 6, 7, 8, and 9 have been click-tested so far. Certify a
   budget → record a disbursement → request/review a minor/major/BOR
   realignment, and confirm role gating matches what's live on rmis-backend.
