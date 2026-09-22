# RMIS Frontend — Current Status

## Module we're on
Module 7: Document and Records Management

## Frontend status (this repo)
- Module 1 (Auth/RBAC pages): done, stable.
- Module 2 (Programs/Projects/Studies/Milestones pages): done, stable.
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
Added src/types/document.ts, src/lib/documentApi.ts, src/pages/DocumentsPage.tsx,
wired /documents route in App.tsx (no RoleGate — matches backend's
IsAuthenticated-only access), flipped nav.ts "Documents" to ready: true.
Browser-tested upload → signed download → archive end-to-end against real
Supabase Storage; no bugs found.

## Next thing to do in this repo
Same browser-test pass for Modules 4-5 (Budget, Disbursements/Realignments) —
only Modules 6 and 7 have been click-tested so far. Certify a budget → record a
disbursement → request/review a minor/major/BOR realignment, and confirm role
gating matches what's live on rmis-backend.
