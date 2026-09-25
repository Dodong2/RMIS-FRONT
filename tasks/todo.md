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

### - [x] T1: Foundation
**Description:** Port the prototype's global styling and set up mock scaffolding and docs so every page task can just copy markup.
**Acceptance criteria:**
- [x] `src/index.css` has the prototype's `@theme` colors, fonts (Inter + Source Sans 3 + JetBrains Mono), body bg `#f0f4f8`, scrollbar, `.mono`, `.label-field`, `animate-fade-in`, `animate-slide-in`, without breaking existing shadcn tokens
- [x] `jspdf`, `jspdf-autotable`, `xlsx` installed; `src/mocks/REGISTRY.md` exists; `NoActualData` component and `src/lib/protoRole.ts` (RoleTier → prototype role, cosmetic only) exist
- [x] Prototype folder ignored by eslint and git (resolved Q3); CLAUDE.md styling/mock rules and handover scope note updated
- [x] tsconfig `baseUrl` deprecation fixed so `npx tsc -b` really type-checks; fix whatever it surfaces
**Verification:** `npm run build` passes; existing pages still render.
**Dependencies:** None
**Files:** `tsconfig.app.json`, `src/index.css`, `package.json`, `eslint.config.js`, `.gitignore`, `src/mocks/REGISTRY.md`, `src/components/common/NoActualData.tsx`, `src/lib/protoRole.ts`, `CLAUDE.md`, `.claude/rules/handover.md`
**Scope:** M
**Result (2026-09-25):** `npx tsc -b` now really type-checks: `baseUrl` was dropped, `paths` point to `./@/*`, and dead `../rmis-frontend-auth` includes were removed. It surfaced 0 errors. `npm run build` passes. eslint went from 78 to 19 errors, all pre-existing in our pages; the rest came from linting the prototype folder. The `cyan-light` token keeps our `#67e8f9`. The prototype only defines its tokens and uses inline hex, so there's no clash.

### - [x] T2: Layout (sidebar, topbar, nav)
**Description:** Rebuild `AppShell`/`AppSidebar`/`Topbar` from `Layout.tsx`: `#0a2050` sidebar, LSPU logo block, grouped nav (Core / Financial / Research / Insights / Administration), user card + Sign Out, topbar with page title + scope subtitle, notification bell (mock), role badge, prototype mobile overlay drawer.
**Acceptance criteria:**
- [x] `nav.ts` relabeled/regrouped to prototype labels; our extra items (Staff, Leader load, Personnel changes, Procurement, Pending registrations) placed in the matching group; `tiers` unchanged
- [x] Client-doc names win over prototype labels: no "Disbursement" (→ "Financial Monitoring"; it and Procurement sit together in one nav group "Procurement, Realignment & Financial Monitoring"), "Compliance Tracking" (not "Ethics and compliance"), "Document and Records Management" (see plan.md "Client docs alignment")
- [x] Active item style matches (cyan left border, `#67e8f9` text); active item still scrolls into view (commit `0e490eb`)
- [x] Logout, real user name/role, and role-based nav visibility still work
**Verification:** Log in as system_admin and a project_leader; compare sidebars to prototype logged in as Super Admin / Project Leader.
**Dependencies:** T1
**Files:** `src/components/layout/AppShell.tsx`, `AppSidebar.tsx`, `Topbar.tsx`, `NavIcon.tsx`, `src/lib/nav.ts`, `src/mocks/notifications.ts`
**Scope:** M
**Result (2026-09-25):** Built with the prototype's markup and inline styles. The mobile Sheet was replaced by the prototype's overlay drawer. Icons use the prototype's SVG paths, with heroicons-style cart, sync, and team added. Nav groups are Core / Financial / Procurement, Realignment & Financial Monitoring / Research / Insights / Administration. Reports moved to Research as "Reports & Data Export". Staff, Leader Load, and Personnel Changes are under Administration next to Personnel Coordination. "Budget Office Sync" is a `ready: false` placeholder until T17b. Tiers are unchanged. `/budget` uses `end` so it's no longer active on `/budget/forecast`. The avatar color comes from `protoRoleStyle`, and the label is our real role name. Notifications are mocked (REGISTRY row). tsc, eslint, and build are clean. **Not browser-checked yet** (needs a real login).

### - [x] T3: Login + auth pages
**Description:** Clone `Login.tsx` layout (navy hero left, sign-in card right) into `LoginPage` with the real flow: email + password + Google button. Restyle Register, GoogleChooseRole, RegistrationPending, AuthCallback in the same hero/card language.
**Acceptance criteria:**
- [x] No account picker, no demo password hint
- [x] Email/password login, Google login, pending-account error message all still work
- [x] Register + Google choose-role + pending + callback pages visually consistent with Login
**Verification:** Log in both ways against dev backend; register flow reaches pending page.
**Dependencies:** T1
**Files:** `src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `GoogleChooseRolePage.tsx`, `RegistrationPendingPage.tsx`, `AuthCallbackPage.tsx`, `src/components/auth/AuthShell.tsx`
**Scope:** M
**Result (2026-09-25):** `AuthShell` is now the prototype's Login layout (navy hero left, card with campus pills + footer strip right), so all 5 auth pages share it. The shared prototype-styled fields are in `src/components/auth/AuthFields.tsx`. The login/register/Google logic is unchanged. There's no account picker and no demo password. Checked with headless screenshots of /login, /register, /registration-pending at 1440px and 390px. Roles showed "No roles available" there only because the headless run used port 5199, which isn't in backend CORS. **Real login with Google/email not re-tested.** `LspuMark` is now unused. It's kept for when the real seal asset arrives.

## Checkpoint A: Foundation
- [x] Build + lint clean (tsc -b, build OK; eslint 18 pre-existing errors, 0 new)
- [ ] Login → dashboard → navigate all nav items works (pages still old style inside new shell)
- [ ] Human review of Layout + Login before continuing

---

## Phase 1: Core

### - [x] T4: Dashboard — KPIs + domain tabs
**Description:** Clone `Dashboard.tsx` top half: KPI strip, domain tabs (Projects/Budget/Compliance/Outputs/M&E/Risk/Personnel).
**Acceptance criteria:**
- [x] Projects/Budget/Compliance/Outputs tabs read `dashboardApi`; Risk tab reads `riskApi` (incl. `critical`); Personnel tab reads `dashboard/tasks/` + workload; M&E reads monitoring status indicators
- [x] Empty dev DB shows "No actual data" per section, not zeros that look like data
- [x] The 4 objective dashboards are visibly named: Compliance & Activity, Budget Monitoring, Forecasting Analytics (`dashboard/forecasting/`), Funding Allocation Decision (`dashboard/funding-allocation/`)
**Dependencies:** T2
**Files:** `src/pages/DashboardPage.tsx`, `src/mocks/dashboard.ts`
**Scope:** M
**Result (2026-09-25):** Rebuilt from the prototype's `Dashboard.tsx`.
- Top of the page: an institutional KPI strip (system_admin / institution_oversight only), a scope bar, and 7 domain summary tiles.
- The prototype's left drill-down column now holds the 4 named Objective Dashboards (5a–5d), linked only when the user's nav allows it.
- There are 7 domain tabs. They're all real data except the M&E tab, which uses a project picker (`monitoring/status/<id>/`), because institution-wide indicators would take N calls.
- Workload is fetched only for task-assigner roles.
- API additions: `dashboardApi.getForecastingDashboard`, `getFundingAllocationDashboard` (404 → null), `getTaskDashboard`, and `personnelApi.getWorkload`.
- `src/lib/projectStatus.ts` maps active/completed/archived → Ongoing/Completed/Closed with the prototype's colors.
- Removed from the old page: the "Welcome" header and the "Your modules" build-status card (all modules are built now). The admin Accounts counts are kept.
- Verified with headless Chrome (CDP, minted JWT, Django on :8001) as system_admin and project_leader, desktop and 390px: real data shows (1 project, ₱120K LIB, 1 critical risk), empty sections show "No actual data", and there were no console errors.
- Nothing is mocked, so there are no REGISTRY rows.

### - [x] T5: Dashboard — drill-down + export
**Description:** Institution → campus → college → project drill-down and the report quick-export (xlsx/pdf) from the prototype.
**Acceptance criteria:**
- [x] Drill-down uses `campus` filter on dashboard endpoints where supported; college/project levels mocked
- [x] Export buttons produce real .xlsx/.pdf files client-side
**Dependencies:** T4
**Files:** `src/pages/DashboardPage.tsx`, `src/lib/exportFiles.ts`, `src/mocks/dashboard.ts`
**Scope:** S
**Result (2026-09-25):**
- Drill-down is Institution → Campus → Project, all real. Campuses come from `Project.campus`. At campus scope, the projects/budget/risk/forecasting dashboards are refetched with `?campus=`. The other panels are filtered client-side by project id. Compliance/Outputs show an "Institution-wide figures" note, because those endpoints have no filter.
- **The college level is not shown**, not mocked. There's no `Project.college` yet (backend P11). Fake colleges between real campuses and real projects would give numbers that don't add up. Add the level when P11 lands.
- The Objective Dashboards (5a–5d) moved to a 4-card row under the grid, and the left column is the drill panel (as in the prototype).
- The Generate Report modal has 4 types (Consolidated / Project Status / Budget (LIB) / Risk Indicator) × PDF/XLSX, built from the scoped real data by `src/lib/exportFiles.ts`, which is reusable for T23.
- In the PDF, ₱ is written as "PHP" because jsPDF's built-in font has no ₱ glyph.
- Verified headless: the drill reaches P77, and the downloaded PDF/XLSX are real files (`file` + pdftotext/openpyxl content checked).

### - [x] T6: Projects list
**Description:** Clone the Projects list view (filters, cards/table, status pills, "Register Approved Project" CTA) onto `ProjectsPage`.
**Acceptance criteria:**
- [x] Real programs/projects from `researchApi`; status pill uses prototype colors mapped from our `active/completed/archived`
- [x] CTA still gated to system_admin/crc_chair and routes to `/projects/new`; Register Program still reachable
**Dependencies:** T2
**Files:** `src/pages/ProjectsPage.tsx`
**Scope:** S
**Result (2026-09-25):**
- Cloned the prototype list: header + CTAs, a status KPI strip that doubles as a filter (All/Ongoing/Completed/Closed), search + funding-type filter, and project cards.
- Card fields are real:
  - code, status, research type, funding type, campus chips
  - PI (lead email), implementing unit, cooperating agencies
  - total cost
  - period
  - milestones done/total (`getMilestones()` is now project-optional)
  - program
  - team (active assignments + leader)
  - physical/financial bars (`deliverables_pct`/`budget_used_pct` from `monitoring/status/<id>/`, one call per project, fine at capstone scale)
- The Programs table is kept as a "Research Programs" card below the list (it's our extra; the prototype has none).
- The page title is now "Project Management" (nav label).
- Headless check as system_admin (desktop) and project_leader (390px): OK.

### - [x] T7: Project detail
**Description:** Clone detail tabs (Overview, Registration Info, Team, Work Plan, Impact, History, Closure) onto `ProjectDetailPage`, keeping the existing dialogs (commit `0e490eb`).
**Acceptance criteria:**
- [x] All tabs real: Registration (incl. approval info fields), Team, Work Plan, Impact (expected outcomes/impacts + outcomes endpoint), History (`status-history/`), Closure (status change to completed/archived with remarks + terminal report status)
- [x] Milestone create/edit/status: `system_admin`/`crc_chair` + `program_leader`/`project_leader`/`study_leader` (backend `projects.manage_milestones`, rmis-backend `209dac2`). Leaders are scoped to their own projects; an out-of-scope write returns 400, and that message is shown as a toast. Project register/edit stays `system_admin`/`crc_chair`.
**Dependencies:** T6
**Files:** `src/pages/ProjectDetailPage.tsx`, `src/mocks/projects.ts`
**Scope:** M
**Result (2026-09-25):**
- Cloned the prototype detail: breadcrumb, navy header card (cost, LIB total, duration, team size, deliverables/budget bars from `monitoring/status`), and 7 tabs.
- The prototype's proposal workflow pipeline was **replaced** by a real lifecycle strip (NTP → Ongoing → Terminal Report → Certified → Completed → Closed). Q5 says the proposal flow stays outside RMIS.
- Tabs:
  - **Overview:** description, info cards, objectives from the `objectives` text, and Studies with the Add Study dialog kept.
  - **Registration Info:** classification, read-only approval reference fields, beneficiaries, SDGs.
  - **Team:** leader + active assignments, linking to Personnel Coordination.
  - **Work Plan:** Gantt from `start_date`→`target_date`, milestone cards with a status select, and an Add Milestone dialog that now also sends start date/objective/deliverable.
  - **Impact:** beneficiaries, 6Ps expected-vs-actual, expected + recorded outcomes/impacts.
  - **History:** `status-history/` timeline plus the registration entry.
  - **Closure:** status, terminal report state, and a status change with remarks via project PATCH (`status_remarks`, writes history), for system_admin/crc_chair.
- The prototype's closure checklist was left out because it isn't persisted anywhere.
- Loading now uses a reload-key effect, which clears the old eslint-disable.
- API additions: `researchApi.updateProject`, `getStatusHistory`, extended `createMilestone`, `outputsApi.getExpectedVsActual`, `getOutcomes`.
- There are no mocks, so `src/mocks/projects.ts` wasn't needed.
- Headless check as system_admin and project_leader: OK. Writes (add milestone, status change) were not exercised live, to avoid touching the dev DB.

### - [x] T8: Register Approved Project wizard
**Description:** Clone the 8-step wizard (Basic Info → Validate & Register) onto `RegisterProjectPage`, submitting to the existing create-project endpoint.
**Acceptance criteria:**
- [x] All fields the backend accepts are in the right step and still submit; success redirects as today
- [x] Research Information step → description, objectives, beneficiaries, expected_outcomes, expected_impacts; Approval Information step → `ntp_number` (Approval Ref No.), `proposal_approved_on`/`ntp_date`, `reviewing_body`, proposal submitted/reviewed dates
- [x] Approval document + supporting docs uploaded to `documents/` right after the project is created
- [x] Wording says "Register Approved Project"; no ethics-committee approval anywhere (panel recommendation)
- [x] Completeness check panel (step 8) reflects actual filled fields
**Dependencies:** T6
**Files:** `src/pages/RegisterProjectPage.tsx`, `src/mocks/projects.ts`
**Scope:** M
**Result (2026-09-25):**
- It's a full page, not the prototype's modal. The form is too long for a dialog, and that decision was made 2026-09-22.
- 7 steps instead of 8: Basic Info / Description / Objectives & Impact / Beneficiaries & Classification / Org. Scope & Proponent / Approval Info / Validate & Register.
- Dropped from the prototype:
  - The "Project Team" step, because assignments happen in Personnel Coordination after registration.
  - Textareas with no backend field (Introduction, RRL, Sustainability, Risks, Ethical Considerations, References). They'd look saved but be thrown away.
  - The auto-generated `LSPU-RD-…` code, because the official code is manual per Q4.
- The objectives list is joined into the `objectives` text as a numbered list.
- Approval + supporting files are uploaded to `documents/` (type `other`, stage `inception`) after create, with a 25MB client check. A failed upload doesn't undo the project; the toast says to add the file from Documents.
- The completeness panel is computed from real form state (required vs recommended); clicking an item jumps to its step. Register is blocked until the required items + certification are done.
- Verified with a rolled-back APIClient run (0 leaked rows): create with the new fields → 201, status PATCH → history row, project_leader milestone on own project → 201. The concurrency-limit 400 surfaced correctly on the first try. Headless screenshots of the steps look fine.

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
- [ ] Add/edit milestone gated to `projects.manage_milestones` roles (admin, crc_chair, program/project/study leaders)
**Dependencies:** T2
**Files:** `src/pages/WorkPlanPage.tsx`, `src/App.tsx`, `src/lib/nav.ts`, `src/mocks/workPlan.ts`
**Scope:** M

### - [ ] T11: Tasks (Personnel & Tasks)
**Description:** Clone `PersonnelTasks.tsx` (Task Board kanban, Task List, Workload, Personnel) onto `TasksPage`.
**Acceptance criteria:**
- [ ] Real tasks in kanban/list; existing create/update-status actions still work
- [ ] Comments = real task updates; Workload tab = `personnel/workload/`; overdue via `?overdue=true`
- [ ] Kanban columns = real statuses incl. **For Review** (`for_review`, rmis-backend `209dac2`). An assignee can move a task only to in_progress/blocked/for_review; "done" comes only from a leader/assigner via `tasks/<id>/review/` (`approve` → done, `return` → in_progress, with remarks)
- [ ] Real priority (`?priority=`), estimated/logged hours, tags (`?tag=`), started/completed dates, update kinds (update/comment/blocker/completion) + hours per update, deliverables checklist (`tasks/<id>/deliverables/`, `task-deliverables/<id>/`). Nothing on this page stays mocked
- [ ] Workload tab shows estimated/logged hours
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
- [ ] Create budget, add/remove line item, certify still work with the `MANAGE_ROLE_CODES` / `CERTIFY_ROLE_CODES` split intact. `MANAGE_ROLE_CODES` gains `program_leader` + `project_leader` (backend `budget.manage`, rmis-backend `209dac2`): leaders encode their own LIB and get a 400 on other projects. Certify stays finance_budget/system_admin
- [ ] Remove line item hidden on a certified budget (backend now 400s the delete)
- [ ] `/budget` RoleGate + nav tiers gain study_leader, view-only (Q12). Study-level allocation is mocked + REGISTRY row until backend P11 (`LineItem.study`)
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
- [ ] `/procurement` RoleGate + nav tiers gain program_leader/project_leader (Q12; they can't open the page today). The APP worklist stays visible to them (backend scopes budget data to their projects)
**Dependencies:** T15
**Files:** `src/pages/ProcurementPage.tsx`, `src/lib/financialApi.ts`
**Scope:** M

### - [ ] T17b: Budget Office Sync page (Module 15)
**Description:** New Module 15 page for the XLSX import + reconciliation, styled with the Budget page's KPI strip + table. It gets its own sidebar item (decision revised 2026-09-25).
**Acceptance criteria:**
- [ ] New `BudgetSyncPage` at `/budget-sync`: own nav item in the Financial group (Alignment doc lists Module 15 separately). RoleGate = finance_budget/system_admin write + oversight/finance read, mirroring the backend
- [ ] Upload .xlsx (system_admin/finance_budget), list imports and records, manually link/unlink a record to a project
- [ ] Reconciliation table with matched/discrepancy/no_rmis_budget/unlinked summary
**Dependencies:** T13
**Files:** `src/pages/BudgetSyncPage.tsx`, `src/lib/budgetSyncApi.ts`, `src/App.tsx`, `src/lib/nav.ts`
**Scope:** M

## Checkpoint D: Financial
- [ ] Build + lint clean; certify → disburse → realign walk-through; human review

---

## Phase 3: Research

### - [ ] T18: Compliance
**Description:** Clone `Compliance.tsx` onto `CompliancePage` per resolved Q1.
**Acceptance criteria:**
- [ ] All 5 existing logs still work; leaders can now encode; RIUH "Verify" action on each record
- [ ] AI declaration form has an optional `ai_content_pct` (0–100) input; an "Over 20% AI" badge shows from `exceeds_ai_threshold` (server-computed, never recomputed client-side)
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
- [ ] Per-document sharing with expiry (Q8) mocked + REGISTRY row (backend P14 not built)
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
- [ ] Role-banded alert inbox (Q7) mocked + REGISTRY row (backend P15 `risk/alerts/` not built)
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
- [ ] Custom report builder / scheduled generation (Alignment doc, Module 14) mocked + REGISTRY row
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
- [ ] Temporary replacement while suspended (Q3) mocked + REGISTRY row (backend P13 not built)
- [ ] Scope (campus/college) shown per user and editable via `PATCH admin/users/<id>/scope/` (a blank value clears it). Note in the UI hint: college is stored but not enforced yet
- [ ] Extra tab "Roles & Permissions": read-only role × permission matrix from `GET admin/permissions/` (36 codes × 12 roles, grouped by module). No editing (client: future enhancement)
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
