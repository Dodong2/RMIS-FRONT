# Todo: Prototype UI Clone

Source of truth for look: `University Research Operations Website/src/components/*`.
Rules and mapping: `tasks/plan.md`.

Standard verification for every task (not repeated below):
- `npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0` clean (until T1 fixes tsconfig), no new lint errors
- New endpoints get their API function in `src/lib/<domain>Api.ts` (types already exist since 2026-09-24)
- Side-by-side visual check vs prototype, desktop + ~390px mobile
- Existing API calls on the page still work; empty API → "No actual data"
- Every mocked section has a row in `src/mocks/REGISTRY.md`
- No code comments in new/changed code

---

## Phase 0: Foundation

### - [ ] T1: Foundation
**Description:** Port the prototype's global styling and set up mock scaffolding and docs so every page task can just copy markup.
**Acceptance criteria:**
- [ ] `src/index.css` has the prototype's `@theme` colors, fonts (Inter + Source Sans 3 + JetBrains Mono), body bg `#f0f4f8`, scrollbar, `.mono`, `.label-field`, `animate-fade-in`, `animate-slide-in`, without breaking existing shadcn tokens
- [ ] `jspdf`, `jspdf-autotable`, `xlsx` installed; `src/mocks/REGISTRY.md` exists; `NoActualData` component and `src/lib/protoRole.ts` (RoleTier → prototype role, cosmetic only) exist
- [ ] Prototype folder ignored by eslint and git (resolved Q3); CLAUDE.md styling/mock rules and handover scope note updated
- [ ] tsconfig `baseUrl` deprecation fixed so `npx tsc -b` really type-checks; fix whatever it surfaces
**Verification:** `npm run build` passes; existing pages still render.
**Dependencies:** None
**Files:** `tsconfig.app.json`, `src/index.css`, `package.json`, `eslint.config.js`, `.gitignore`, `src/mocks/REGISTRY.md`, `src/components/common/NoActualData.tsx`, `src/lib/protoRole.ts`, `CLAUDE.md`, `.claude/rules/handover.md`
**Scope:** M

### - [ ] T2: Layout (sidebar, topbar, nav)
**Description:** Rebuild `AppShell`/`AppSidebar`/`Topbar` from `Layout.tsx`: `#0a2050` sidebar, LSPU logo block, grouped nav (Core / Financial / Research / Insights / Administration), user card + Sign Out, topbar with page title + scope subtitle, notification bell (mock), role badge, prototype mobile overlay drawer.
**Acceptance criteria:**
- [ ] `nav.ts` relabeled/regrouped to prototype labels; our extra items (Staff, Leader load, Personnel changes, Procurement, Pending registrations) placed in the matching group; `tiers` unchanged
- [ ] Active item style matches (cyan left border, `#67e8f9` text); active item still scrolls into view (commit `0e490eb`)
- [ ] Logout, real user name/role, and role-based nav visibility still work
**Verification:** Log in as system_admin and a project_leader; compare sidebars to prototype logged in as Super Admin / Project Leader.
**Dependencies:** T1
**Files:** `src/components/layout/AppShell.tsx`, `AppSidebar.tsx`, `Topbar.tsx`, `NavIcon.tsx`, `src/lib/nav.ts`, `src/mocks/notifications.ts`
**Scope:** M

### - [ ] T3: Login + auth pages
**Description:** Clone `Login.tsx` layout (navy hero left, sign-in card right) into `LoginPage` with the real flow: email + password + Google button. Restyle Register, GoogleChooseRole, RegistrationPending, AuthCallback in the same hero/card language.
**Acceptance criteria:**
- [ ] No account picker, no demo password hint
- [ ] Email/password login, Google login, pending-account error message all still work
- [ ] Register + Google choose-role + pending + callback pages visually consistent with Login
**Verification:** Log in both ways against dev backend; register flow reaches pending page.
**Dependencies:** T1
**Files:** `src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `GoogleChooseRolePage.tsx`, `RegistrationPendingPage.tsx`, `AuthCallbackPage.tsx`, `src/components/auth/AuthShell.tsx`
**Scope:** M

## Checkpoint A: Foundation
- [ ] Build + lint clean
- [ ] Login → dashboard → navigate all nav items works (pages still old style inside new shell)
- [ ] Human review of Layout + Login before continuing

---

## Phase 1: Core

### - [ ] T4: Dashboard — KPIs + domain tabs
**Description:** Clone `Dashboard.tsx` top half: KPI strip, domain tabs (Projects/Budget/Compliance/Outputs/M&E/Risk/Personnel).
**Acceptance criteria:**
- [ ] Projects/Budget/Compliance/Outputs tabs read `dashboardApi`; Risk tab reads `riskApi` (incl. `critical`); Personnel tab reads `dashboard/tasks/` + workload; M&E reads monitoring status indicators
- [ ] Empty dev DB shows "No actual data" per section, not zeros that look like data
**Dependencies:** T2
**Files:** `src/pages/DashboardPage.tsx`, `src/mocks/dashboard.ts`
**Scope:** M

### - [ ] T5: Dashboard — drill-down + export
**Description:** Institution → campus → college → project drill-down and the report quick-export (xlsx/pdf) from the prototype.
**Acceptance criteria:**
- [ ] Drill-down uses `campus` filter on dashboard endpoints where supported; college/project levels mocked
- [ ] Export buttons produce real .xlsx/.pdf files client-side
**Dependencies:** T4
**Files:** `src/pages/DashboardPage.tsx`, `src/lib/exportFiles.ts`, `src/mocks/dashboard.ts`
**Scope:** S

### - [ ] T6: Projects list
**Description:** Clone the Projects list view (filters, cards/table, status pills, "Register Approved Project" CTA) onto `ProjectsPage`.
**Acceptance criteria:**
- [ ] Real programs/projects from `researchApi`; status pill uses prototype colors mapped from our `active/completed/archived`
- [ ] CTA still gated to system_admin/crc_chair and routes to `/projects/new`; Register Program still reachable
**Dependencies:** T2
**Files:** `src/pages/ProjectsPage.tsx`
**Scope:** S

### - [ ] T7: Project detail
**Description:** Clone detail tabs (Overview, Registration Info, Team, Work Plan, Impact, History, Closure) onto `ProjectDetailPage`, keeping the existing dialogs (commit `0e490eb`).
**Acceptance criteria:**
- [ ] All tabs real: Registration (incl. approval info fields), Team, Work Plan, Impact (expected outcomes/impacts + outcomes endpoint), History (`status-history/`), Closure (status change to completed/archived with remarks + terminal report status)
- [ ] Milestone status update still restricted to system_admin/crc_chair (known gap, unchanged)
**Dependencies:** T6
**Files:** `src/pages/ProjectDetailPage.tsx`, `src/mocks/projects.ts`
**Scope:** M

### - [ ] T8: Register Approved Project wizard
**Description:** Clone the 8-step wizard (Basic Info → Validate & Register) onto `RegisterProjectPage`, submitting to the existing create-project endpoint.
**Acceptance criteria:**
- [ ] All fields the backend accepts are in the right step and still submit; success redirects as today
- [ ] Research Information step → description, objectives, beneficiaries, expected_outcomes, expected_impacts; Approval Information step → `ntp_number` (Approval Ref No.), `proposal_approved_on`/`ntp_date`, `reviewing_body`, proposal submitted/reviewed dates
- [ ] Approval document + supporting docs uploaded to `documents/` right after the project is created
- [ ] Wording says "Register Approved Project"; no ethics-committee approval anywhere (panel recommendation)
- [ ] Completeness check panel (step 8) reflects actual filled fields
**Dependencies:** T6
**Files:** `src/pages/RegisterProjectPage.tsx`, `src/mocks/projects.ts`
**Scope:** M

### - [ ] T9: Register Program restyle
**Description:** Restyle `RegisterProgramPage` in the wizard's visual language (no prototype counterpart).
**Acceptance criteria:**
- [ ] Program create → redirect → appears in list still works
**Dependencies:** T8
**Files:** `src/pages/RegisterProgramPage.tsx`
**Scope:** XS

## Checkpoint B: Dashboard + Projects
- [ ] Build + lint clean
- [ ] Register a project end-to-end through the new wizard
- [ ] Human review

### - [ ] T10: Work Plan (new page)
**Description:** New `/work-plan` page cloned from `WorkPlan.tsx` (Gantt, Activities, Deliverables, Version History).
**Acceptance criteria:**
- [ ] Project selector real; Gantt rows from milestones (`start_date` → `target_date`), activities table shows objective/deliverable/responsible, delayed filter uses `?delayed=true`; dependencies/versions mocked
- [ ] Route wrapped in ProtectedRoute + RoleGate matching nav tiers; nav item `ready: true`
**Dependencies:** T2
**Files:** `src/pages/WorkPlanPage.tsx`, `src/App.tsx`, `src/lib/nav.ts`, `src/mocks/workPlan.ts`
**Scope:** M

### - [ ] T11: Tasks (Personnel & Tasks)
**Description:** Clone `PersonnelTasks.tsx` (Task Board kanban, Task List, Workload, Personnel) onto `TasksPage`.
**Acceptance criteria:**
- [ ] Real tasks in kanban/list; existing create/update-status actions still work
- [ ] Comments = real task updates; Workload tab = `personnel/workload/`; overdue via `?overdue=true`
- [ ] Kanban columns follow real statuses (pending/in_progress/blocked/done); priority/hours shown disabled + registry row (not in backend)
**Dependencies:** T2
**Files:** `src/pages/TasksPage.tsx`, `src/mocks/tasks.ts`
**Scope:** M

### - [ ] T12: Staff / Leader load / Personnel changes
**Description:** Clone `Personnel.tsx` onto `StaffPage`; restyle `LeaderLoadPage` and `PersonnelChangesPage` to match.
**Acceptance criteria:**
- [ ] All existing staff assignment, leader-load, and personnel-change actions still work
- [ ] Assignment `department` shown/editable; cross-departmental collaboration view from `personnel/collaboration/`
**Dependencies:** T2
**Files:** `src/pages/StaffPage.tsx`, `LeaderLoadPage.tsx`, `PersonnelChangesPage.tsx`
**Scope:** M

## Checkpoint C: Core complete
- [ ] Build + lint clean; human review

---

## Phase 2: Financial

### - [ ] T13: Budget — overview + line items
**Description:** Clone `Budget.tsx` project picker, Overview and Line Items tabs onto `BudgetPage`.
**Acceptance criteria:**
- [ ] Create budget, add/remove line item, certify still work with `MANAGE_ROLE_CODES` / `CERTIFY_ROLE_CODES` split intact
- [ ] PS/MOOE/CO grouping from `category`; fiscal year, funding source, counterpart fields in the add form; `exceeds_dry_cap` shown as a non-blocking warning
**Dependencies:** T2
**Files:** `src/pages/BudgetPage.tsx`, `src/mocks/budget.ts`
**Scope:** M

### - [ ] T14: Budget — funding, utilization, history, LIB wizard
**Description:** Remaining Budget tabs: Funding Sources, Utilization, Version History, LIB wizard.
**Acceptance criteria:**
- [ ] Utilization + Funding Sources read the summary's `by_category`/`by_funding_source`/`utilization_pct`; version history from budget versions; LIB review workflow mocked
**Dependencies:** T13
**Files:** `src/pages/BudgetPage.tsx`, `src/mocks/budget.ts`
**Scope:** M

### - [ ] T15: Disbursements
**Description:** Clone `Disbursement.tsx` (Ledger, Utilization, Variance, Budget Adjustments, Financial Report) onto `DisbursementsPage`.
**Acceptance criteria:**
- [ ] Ledger = real disbursements incl. payee + supporting document; Adjustments = real realignments incl. tier-gated review + BOR resolution number
- [ ] Variance/Report computed from real data where possible, else mocked
**Dependencies:** T2
**Files:** `src/pages/DisbursementsPage.tsx`, `src/mocks/disbursements.ts`
**Scope:** M

### - [ ] T16: Budget Forecast
**Description:** Clone `BudgetForecast.tsx` onto `BudgetForecastPage`.
**Acceptance criteria:**
- [ ] Real ARIMA runs + trigger + insufficient-data message still work
- [ ] Prototype method/scenario controls mocked (backend has ARIMA only)
**Dependencies:** T2
**Files:** `src/pages/BudgetForecastPage.tsx`, `src/mocks/forecast.ts`
**Scope:** M

### - [ ] T17: Procurement — restyle + procurement requests
**Description:** Restyle `ProcurementPage` in the Disbursement page's language and add the new procurement-request pipeline.
**Acceptance criteria:**
- [ ] APP-flagged worklist + project filter still work
- [ ] Leaders can file a request (certified budget only); procurement_officer_lib/system_admin move Requested → Processing → Released/Cancelled; overdue filter
**Dependencies:** T15
**Files:** `src/pages/ProcurementPage.tsx`, `src/lib/financialApi.ts`
**Scope:** M

### - [ ] T17b: Budget Office Sync view in Budget Management (Module 15)
**Description:** Add a "LIB Register | Budget Office Sync" toggle to the Budget Management landing view (the prototype's institution-wide LIB register), with the XLSX import + reconciliation in the same KPI-strip + table style. No new sidebar item.
**Acceptance criteria:**
- [ ] Upload .xlsx (system_admin/finance_budget), list imports and records, manually link/unlink a record to a project
- [ ] Reconciliation table with matched/discrepancy/no_rmis_budget/unlinked summary
**Dependencies:** T13
**Files:** `src/pages/BudgetPage.tsx`, `src/lib/budgetSyncApi.ts`
**Scope:** M

## Checkpoint D: Financial
- [ ] Build + lint clean; certify → disburse → realign walk-through; human review

---

## Phase 3: Research

### - [ ] T18: Compliance
**Description:** Clone `Compliance.tsx` onto `CompliancePage` per resolved Q1.
**Acceptance criteria:**
- [ ] All 5 existing logs still work; leaders can now encode; RIUH "Verify" action on each record
- [ ] Prototype requirement tracker wired to `compliance/requirements/` (create, submit with document, review → compliant/returned/non_compliant, overdue)
- [ ] No "Ethics Committee approval" wording (panel recommendation)
**Dependencies:** T2
**Files:** `src/pages/CompliancePage.tsx`, `src/mocks/compliance.ts`
**Scope:** M

### - [ ] T19: Documents
**Description:** Clone `Documents.tsx` onto `DocumentsPage`.
**Acceptance criteria:**
- [ ] Upload (25MB check), current/all versions, download (signed URL), archive all still work
- [ ] Access level = real `sensitivity`; review status + review action real; module links mocked
**Dependencies:** T2
**Files:** `src/pages/DocumentsPage.tsx`, `src/mocks/documents.ts`
**Scope:** M

### - [ ] T20: Research Outputs
**Description:** Clone `ResearchOutputs.tsx` onto `OutputsPage`.
**Acceptance criteria:**
- [ ] Publications + IP real (server-computed incentive shown); Creative Works + SENSE publishers kept as extra tabs
- [ ] Outcomes & Impacts real (`outputs/outcomes/`); 6Ps expected outputs + expected-vs-actual real; Technologies/Partnerships detail forms mocked
**Dependencies:** T2
**Files:** `src/pages/OutputsPage.tsx`, `src/mocks/outputs.ts`
**Scope:** M

### - [ ] T21: Monitoring & Evaluation
**Description:** Clone `Monitoring.tsx` onto `MonitoringPage`.
**Acceptance criteria:**
- [ ] Evaluations tab real; Status, Monthly/Midterm/Terminal, Renewal kept as extra tabs, all actions working
- [ ] Indicators = status `indicators` block; evaluation criteria rubric + scores + weighted score real; extension requests (submit/endorse/approve) real; indicator baseline/target series mocked
**Dependencies:** T2
**Files:** `src/pages/MonitoringPage.tsx`, `src/mocks/monitoring.ts`
**Scope:** M

### - [ ] T22: Risk Management
**Description:** Clone `RiskManagement.tsx` onto `RisksPage`.
**Acceptance criteria:**
- [ ] Risk register real (`risk/register/` + updates): 5×5 matrix, owner, mitigation, status
- [ ] Computed 5×5 flags + `recommended_action` kept real (Institution Overview + Project Risk Status)
**Dependencies:** T2
**Files:** `src/pages/RisksPage.tsx`, `src/mocks/risks.ts`
**Scope:** M

## Checkpoint E: Research
- [ ] Build + lint clean; human review

---

## Phase 4: Insights

### - [ ] T23: Reports
**Description:** Clone `Reports.tsx` report catalog onto `ReportsPage`.
**Acceptance criteria:**
- [ ] Appendix E/F/G + Project List download real server files (`file_format`, blob error handling unchanged); Generation Log real + role-gated
- [ ] Financial/Compliance/Personnel/Outputs module reports download from `reports/<type>/`
- [ ] Only catalog entries with no endpoint export client-side from mock data (jspdf/xlsx)
**Dependencies:** T5 (shared export helper)
**Files:** `src/pages/ReportsPage.tsx`, `src/mocks/reports.ts`, `src/lib/exportFiles.ts`
**Scope:** M

### - [ ] T24: Analytics
**Description:** Clone `Analytics.tsx` onto `AnalyticsPage`.
**Acceptance criteria:**
- [ ] All existing real charts/tabs (incl. Planning Targets create + comparison, exports) still present in prototype style
**Dependencies:** T2
**Files:** `src/pages/AnalyticsPage.tsx`, `src/mocks/analytics.ts`
**Scope:** M

### - [ ] T25: Decision Support
**Description:** Clone `DecisionSupport.tsx` onto `DecisionSupportPage`.
**Acceptance criteria:**
- [ ] Criteria, AHP weighting/finalize, recommendation trigger, sensitivity all still work
- [ ] Decision records real (`recommendation-runs/<id>/decisions/`, University President can decide); prototype DSS "models" view mocked if kept
**Dependencies:** T2
**Files:** `src/pages/DecisionSupportPage.tsx`, `src/mocks/decisionSupport.ts`
**Scope:** M

## Checkpoint F: Insights
- [ ] Build + lint clean; human review

---

## Phase 5: Administration + wrap-up

### - [ ] T26: User & Access Management
**Description:** Clone `UserManagement.tsx` tabs (Accounts, Profiles, Assignments, Audit) across `UsersListPage` + `PendingUsersPage`.
**Acceptance criteria:**
- [ ] Existing user list + approve/reject pending users still work
- [ ] Office/position shown; Suspend/Reactivate/Deactivate via `account-status/` (deactivate shows the hand-over-first error); assignments mocked where no endpoint
**Dependencies:** T2
**Files:** `src/pages/admin/UsersListPage.tsx`, `src/pages/admin/PendingUsersPage.tsx`, `src/mocks/users.ts`
**Scope:** M

### - [ ] T27: Audit Logs
**Description:** Clone `AuditLogs.tsx` onto `AuditLogsPage`.
**Acceptance criteria:**
- [ ] Real audit log list with actor/method filters
**Dependencies:** T2
**Files:** `src/pages/admin/AuditLogsPage.tsx`
**Scope:** S

### - [ ] T28: Settings (new page)
**Description:** New `/admin/settings` page cloned from `Settings.tsx`, fully mocked.
**Acceptance criteria:**
- [ ] system_admin-only route; nav item `ready: true`; nothing pretends to persist
**Dependencies:** T2
**Files:** `src/pages/admin/SettingsPage.tsx`, `src/App.tsx`, `src/lib/nav.ts`, `src/mocks/settings.ts`
**Scope:** S

### - [ ] T29: Wrap-up
**Description:** Audit registry vs code, update handover, full walkthrough.
**Acceptance criteria:**
- [ ] Every `src/mocks/*` import has a registry row and vice versa
- [ ] Handover "Module we're on" / "Last thing done" / "Next thing to do" updated
**Dependencies:** T1–T28
**Files:** `src/mocks/REGISTRY.md`, `.claude/rules/handover.md`
**Scope:** S

## Checkpoint: Complete
- [ ] Build + lint clean
- [ ] Every nav item visited as system_admin, a project_leader, and finance_budget
- [ ] Human sign-off
