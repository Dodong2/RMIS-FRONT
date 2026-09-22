# RMIS Frontend — Current Status

## Module we're on
Module 8: Research Output and IP Tracking

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
Added src/types/outputs.ts, src/lib/outputsApi.ts, src/pages/OutputsPage.tsx,
wired /outputs route in App.tsx, flipped nav.ts "Research outputs" to
ready: true. Browser-tested the incentive computation display end-to-end
(₱60,000 ISI journal case, ₱75,000 SENSE-publisher book case, IP eligibility
state machine, creative work registration toggle) — no bugs found.

## Next thing to do in this repo
Same browser-test pass for Modules 4-5 (Budget, Disbursements/Realignments) —
only Modules 6, 7, and 8 have been click-tested so far. Certify a budget →
record a disbursement → request/review a minor/major/BOR realignment, and
confirm role gating matches what's live on rmis-backend.
