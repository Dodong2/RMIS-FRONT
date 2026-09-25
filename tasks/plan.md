# Implementation Plan: Prototype UI Clone

## Overview
Make every page in `src/pages` look exactly like its counterpart in
`University Research Operations Website/src/components` (21 components +
`Layout.tsx`), while keeping every existing backend flow, API call, and
role gate. UI only — no backend, role, scoping, or data-model changes.

Confirmed intent (2026-09-24) supersedes the 2026-09-22 "design-system pass
only" scope recorded in `.claude/rules/handover.md`.

## Data rule (applies to every section of every page)
| Situation | What the section shows |
|---|---|
| Backend API exists and returns rows | Real data |
| Backend API exists but returns nothing | "No actual data" fallback (`NoActualData` component) |
| No backend API for it | Prototype mock data, imported from `src/mocks/<domain>.ts` — no visible badge |

Every mocked section is listed in `src/mocks/REGISTRY.md` (page, section,
mock file, endpoint it is waiting for). When the user says "read mo yung
changes sa rmis-backend", diff the backend, find registry rows whose
endpoint now exists, swap them to real API calls, delete the row.

## Architecture Decisions
- **Literal markup.** Copy the prototype's JSX (Tailwind classes + inline
  `style={{...}}`) nearly verbatim; replace mock reads with real data where
  the rule above says so. Strip the prototype's code comments (project rule:
  no comments).
- **shadcn only for behavior**: Dialog, Select, Tooltip, toast (`notify`),
  restyled to match. Everything else is the prototype's raw elements.
  CLAUDE.md updated to say this (it currently says "don't recreate
  Button/Select").
- **Real flow, prototype look.** When the prototype's UI flow contradicts the
  backend (e.g. Login's demo account picker + `lspu2024` password), keep the
  real flow and put its elements in the prototype's layout/style.
- **Roles stay ours.** RoleGate/`user.role?.code`/nav tiers unchanged. Where
  the prototype branches UI on its own 9 roles, map from our `RoleTier` via
  one helper (`src/lib/protoRole.ts`):
  system_admin→super_admin, institution_oversight→research_director,
  campus_coordination→campus_research_coordinator,
  college_oversight→college_research_coordinator, finance→finance_officer,
  procurement→finance_officer, project_management/study_management→project_leader,
  execution→researcher, with one code override: riuh→compliance_officer (client Clarification Q1a). `management_bor` is
  never used, because BOR is not a system user (Q1b). Cosmetic only — never used for access control.
- **Conflicting modules: prototype tabs first, our extras kept.** Where the
  prototype models a module differently from our backend (Compliance,
  Outputs, Monitoring, Forecast, DSS, Risk, Reports), the page gets the
  prototype's tabs/sections (real where an equivalent endpoint exists, mock
  otherwise) **plus** our existing real features as additional tabs styled
  the same way. Nothing existing is removed. *(Confirmed — resolved Q1.)*
- **No shared "design system" layer up front.** Prototype files are
  self-contained; copying them that way is the most accurate. Extract a
  shared piece only after it shows up in 3+ pages (e.g. `NoActualData`,
  status pill). Keeps it explainable.
- **Exports:** add `jspdf`, `jspdf-autotable`, `xlsx` (same versions as
  prototype) for the client-side exports on Dashboard/Reports that have no
  backend export. Our existing server-side Module 14 exports stay as-is.

## Page mapping
Updated 2026-09-24 after rmis-backend `dea9255` ("align backend with DPMIS
spec"), and again 2026-09-25 after `209dac2`..`85b8e9c` (backend Phase 3 P1–P10). Types for every new/changed serializer are already in `src/types/`;
the API functions in `src/lib/<domain>Api.ts` get added inside each page task.

| Prototype component | Our page(s) | Real API now | Still mock (no endpoint) |
|---|---|---|---|
| Layout | `AppShell`, `AppSidebar`, `Topbar`, `nav.ts` | auth user (+ `office`, `position`) | notifications |
| Login | `LoginPage` (+ Register, GoogleChooseRole, RegistrationPending, AuthCallback restyled) | auth | — |
| Dashboard | `DashboardPage` | projects/budget/compliance/outputs + **forecasting, funding-allocation, tasks** dashboards, risk dashboard | college/project drill-down levels |
| Projects | `ProjectsPage`, `ProjectDetailPage`, `RegisterProjectPage`, `RegisterProgramPage` | projects + **description/objectives/beneficiaries/outcomes/impacts, approval info (`ntp_number`, `proposal_approved_on`, `reviewing_body`), status history**; approval docs via Documents | — |
| WorkPlan | **new** `WorkPlanPage` (`/work-plan`) | milestones + **start date, objective, deliverable, responsible, `?delayed=true`** | dependencies, planned-vs-actual %, version history |
| PersonnelTasks | `TasksPage` | tasks + `?overdue=true`, task updates (kind + hours), workload (+ est/logged hours), **For Review + leader approve/return, priority, estimated/logged hours, tags, deliverables checklist, started/completed dates** | — |
| Personnel | `StaffPage` (+ `LeaderLoadPage`, `PersonnelChangesPage` restyled) | assignments + **department, collaboration (cross-dept)** | expertise tags |
| Budget | `BudgetPage` | budgets/line items + **fiscal year, funding source, counterpart, `exceeds_dry_cap`, summary by category/funding source** | LIB review workflow, version-change notes |
| Disbursement | `DisbursementsPage` | disbursements + **payee, supporting document**, realignments (= Budget Adjustments) | txn flags, reversal |
| (none) | `ProcurementPage` restyled | APP worklist + **procurement requests (Requested → Processing → Released, ₱25k routing, `?overdue=true`)** | — |
| BudgetForecast | `BudgetForecastPage` | ARIMA runs | method/scenario switcher |
| Compliance | `CompliancePage` | 5 logs + RIUH verify, requirements tracker (submit/review, overdue), **AI-content % + over-20% flag** | — (prototype's tracker is now real) |
| Documents | `DocumentsPage` | documents + **sensitivity, review status/review action** | module links |
| ResearchOutputs | `OutputsPage` | publications, IP, creative works, SENSE + **6Ps expected outputs, expected-vs-actual, outcomes/impacts** | technologies/partnerships detail forms (map to 6Ps "products"/"places_partnerships") |
| Monitoring | `MonitoringPage` | reports, evaluations + **evaluation rubric + weighted score, extension requests, indicators block** | indicator baseline/target time series |
| RiskManagement | `RisksPage` | **5×5 scored flags (low…critical), risk register + updates** | — (prototype's register is now real) |
| Reports | `ReportsPage` | Appendix E/F/G, project list + **financial/compliance/personnel/outputs** module reports | report history re-download |
| Analytics | `AnalyticsPage` | dashboard endpoints | — |
| DecisionSupport | `DecisionSupportPage` | AHP/WSM + **decision records, risk criterion** | — |
| UserManagement | `UsersListPage`, `PendingUsersPage` | users + office/position, account status (suspend/reactivate/deactivate), **scope (campus/college) assignment, read-only permission matrix** | profile editing beyond role |
| AuditLogs | `AuditLogsPage` | audit logs | — |
| Settings | **new** `SettingsPage` (`/admin/settings`) | none | everything |
| (none) | **new** `BudgetSyncPage` (`/budget-sync`, Module 15) | **imports (.xlsx), records + manual link, reconciliation** | — |

## Backend permission codes → our role gates (rmis-backend `85b8e9c`, 2026-09-25)
The backend now gates with DB permission codes (`HasRole("budget.certify")`, table `RolePermission`, 36 codes). The
day-one seed was frozen from the old role-list constants, and a parity script shows 0 differences. **So 403 behavior
is identical except for the P1/P2 widenings marked NEW below.** The frontend keeps its role-code arrays, per the "roles
stay ours" rule. We don't fetch `admin/permissions/` for gating (it's system_admin-only). Each page's `*_ROLE_CODES`
array has to mirror the row below; `system_admin` is in every row.

| Permission code | Roles (besides system_admin) | Frontend gate |
|---|---|---|
| accounts.manage_users | — | admin pages |
| accounts.view_users_by_role | crc_chair | leader/staff pickers |
| projects.register | crc_chair | `REGISTRATION_ROLE_CODES` (Projects, ProjectDetail) |
| projects.manage_milestones | crc_chair, **NEW** program_leader, project_leader, study_leader (scoped) | ProjectDetail milestones, WorkPlan (T7, T10) |
| personnel.manage | crc_chair, drd, riuh | Staff, PersonnelChanges |
| personnel.view_leader_load | crc_chair, drd, riuh, program_leader, project_leader | LeaderLoad |
| personnel.assign_tasks | crc_chair, drd, riuh, program/project/study leaders | `TASK_ASSIGNER_CODES`; also gates review, deliverable create/delete, workload |
| personnel.clearance | crc_chair, drd, riuh, procurement_officer_lib | PersonnelChanges clearance |
| budget.manage | finance_budget, procurement_officer_lib, **NEW** program_leader, project_leader (scoped) | BudgetPage `MANAGE_ROLE_CODES` (T13) |
| budget.certify | finance_budget | `CERTIFY_ROLE_CODES` |
| financial.record_disbursement | finance_budget | Disbursements |
| financial.request_realignment | project_leader | Disbursements |
| financial.review_major_realignment / review_bor_realignment | university_admin / — | Disbursements review |
| financial.request_procurement / update_procurement | program_leader, project_leader / procurement_officer_lib | Procurement (T17) |
| budget_sync.manage | finance_budget | Budget Office Sync (T17b) |
| compliance.manage / compliance.encode | riuh / riuh + leaders | Compliance |
| documents.manage | riuh | Documents |
| outputs.manage / report / report_creative_work | riuh / riuh, project_leader, study_leader / + project_staff | Outputs |
| monitoring.report | riuh, project_leader, study_leader, project_staff | Monitoring |
| monitoring.certify_terminal / evaluate / decide_renewal | riuh / vprei, drd, crc_chair / riuh, drd, vprei | Monitoring |
| monitoring.request / endorse / approve_extension | program+project leader / drd, crc_chair / university_admin | Monitoring extensions |
| dashboard.manage_targets | riuh, drd, vprei | Analytics targets |
| forecasting.run | drd, vprei, finance_budget | BudgetForecast |
| dss.manage / dss.decide | drd, vprei / + university_admin | DecisionSupport |
| risk.manage_register | drd, vprei, crc_chair, riuh, program_leader, project_leader | Risks register |
| reports.view_logs | riuh, drd, vprei | Reports log tab |

Scope (unchanged from `dea9255`): budget/financial endpoints are row-scoped (leaders see their own projects, staff see
none, campus roles see their `scope.campus`). `scope.college` is stored but not enforced. Other modules are still
unscoped (backend P11–P15 are not built yet). When they land, re-run this sync.

## Client docs alignment (checked 2026-09-25)
Sources: `../RMIS chap1/RMIS_Module_Objective_Alignment.docx` and `RMIS_Clarification_Answers.docx`. rmis-backend
followed both. These override the prototype wherever the two disagree:
- **Labels (T2 + each page title):** Module 5 = "Procurement, Realignment, and Financial Monitoring". LSPU has no
  Disbursement office, so no "Disbursement" wording anywhere in the UI (the prototype's `Disbursement.tsx` → our
  `DisbursementsPage`, labeled "Financial Monitoring"). Module 5 stays 2 pages (Financial Monitoring + Procurement) under one
  nav group "Procurement, Realignment & Financial Monitoring" (Carl OK'd 2026-09-25). Module 6 = "Compliance Tracking" (no ethics committee / IACUC
  wording). Module 7 = "Document and Records Management". Proposal = read-only reference only (Q5), so there's no
  proposal submission/approval UI even if the prototype has one.
- **Actors (Q1):** VP / University Admin / DRD = one university-wide group. BOR is not a user, only a resolution number.
  RIUH = compliance verifier at college level. CRC Chair = campus scope, with a read-only compliance view.
- **Module 10 hosts the 4 objective dashboards (5a–5d):** Compliance & Activity, Budget Monitoring, Forecasting
  Analytics, Funding Allocation Decision. They must be visibly named that way (T4/T24).
- **Q12 budget access** (route gates must follow this):
  - Project Leader: views own budget, requests LIB, procurement, and realignment.
  - Program Leader: roll-up view.
  - Study Leader: own-study allocation, read-only.
  - Staff: none.
  - Procurement: campus procurement items plus status/release.
  - Finance: campus, plus certify/actual.
  - Gaps in our gates: `/procurement` lacks program/project leaders (they file requests, `financial.request_procurement`),
    and `/budget` lacks study_leader (view-only).
  - Backend note: until P11 there's no `LineItem.study`, so a study leader sees the whole project LIB.
- **Required by the docs but not in the backend yet** (rmis-backend P11–P15) → mock + REGISTRY row, per the data rule:
  - temporary replacement while a user is suspended (Q3, T26)
  - per-document sharing with expiry (Q8, T19)
  - risk alert inbox: medium → PL, high → RIUH+CRC, critical → VP/DRD (Q7, T22 / topbar notifications)
  - study-level allocation (Q12, T13)
  - Module 14's "custom filtered report builder / scheduled generation" (T23)
- **Needs client confirm (don't build more than the backend has):** Q4 project-code format, Q6 peso allocation (ranking
  only), Q7 score bands, Q9 rubric (configurable), Q11 6Ps definition.

## Dependency graph
```
T1 foundation (CSS, deps, mocks/, NoActualData, protoRole, lint ignore, docs)
 └─ T2 Layout (shell + nav)          ← every authenticated page renders inside it
     ├─ T3 Auth pages (Login first)  ← independent of T2 visually, but shares T1
     ├─ T4–T5 Dashboard
     ├─ T6–T9 Projects cluster       ← T8 wizard depends on T6/T7 patterns
     │    └─ T10 Work Plan (uses project + milestones)
     ├─ T11–T12 Tasks / Personnel
     ├─ T13–T17 Financial
     ├─ T18–T22 Research modules
     ├─ T23–T25 Insights
     └─ T26–T28 Admin
T29 wrap-up (registry audit, handover)
```
After T2, page tasks are independent of each other and can be done in any
order; the order below front-loads the pages the panel sees first.

## Task List
See `tasks/todo.md` for full acceptance criteria per task.

### Phase 0: Foundation
- [x] T1 Foundation: global CSS, deps, mocks scaffolding, helpers, docs
- [x] T2 Layout: sidebar, topbar, nav regroup
- [x] T3 Login + auth pages
### Checkpoint A

### Phase 1: Core
- [x] T4 Dashboard — KPIs + domain tabs
- [x] T5 Dashboard — drill-down + export
- [x] T6 Projects list
- [x] T7 Project detail
- [x] T8 Register Approved Project wizard
- [x] T9 Register Program restyle
### Checkpoint B
- [x] T10 Work Plan (new page)
- [x] T11 Tasks (Personnel & Tasks)
- [x] T12 Staff / Leader load / Personnel changes
### Checkpoint C

### Phase 2: Financial
- [ ] T13 Budget — overview + line items
- [ ] T14 Budget — funding, utilization, history, LIB wizard
- [ ] T15 Disbursements
- [ ] T16 Budget Forecast
- [ ] T17 Procurement — restyle + procurement requests
- [ ] T17b Budget Office Sync page (Module 15, own nav item)
### Checkpoint D

### Phase 3: Research
- [ ] T18 Compliance
- [ ] T19 Documents
- [ ] T20 Research Outputs
- [ ] T21 Monitoring & Evaluation
- [ ] T22 Risk Management
### Checkpoint E

### Phase 4: Insights
- [ ] T23 Reports
- [ ] T24 Analytics
- [ ] T25 Decision Support
### Checkpoint F

### Phase 5: Administration + wrap-up
- [ ] T26 User & Access Management
- [ ] T27 Audit Logs
- [ ] T28 Settings (new page)
- [ ] T29 Wrap-up: registry audit, handover, full walkthrough
### Checkpoint: Complete

## Verification approach
No test suite exists in this repo (no `test` script). Each task is verified by:
- `npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0` clean (until T1 fixes the tsconfig) and no *new* `npm run lint` errors (17 pre-existing `react-hooks/set-state-in-effect` errors in untouched files)
- Side-by-side visual check: prototype (`cd "University Research Operations Website" && pnpm dev`) vs ours (`npm run dev`), same page, same viewport (desktop + ~390px mobile)
- Real-data check: the page's existing API calls still fire and render (dev DB), and the empty-API path shows "No actual data"
- Every mocked section has a row in `src/mocks/REGISTRY.md`

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| `npx tsc -b` never actually type-checked: tsconfig's deprecated `baseUrl` (TS 6) raises TS5101 and stops before checking. Real errors surfaced on 2026-09-24 once silenced | High | T1 fixes the tsconfig; until then verify with `npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0` |
| Budget/financial endpoints are now row-level scoped: project_staff get empty lists, leaders only see their own | Med | Empty list → "No actual data", not an error |
| `eslint .` and `**/*.{ts,tsx}` currently also lint the prototype folder (it sits inside the repo root now) | Med | T1 adds it to `globalIgnores`; and `.gitignore` (resolved Q3) |
| Prototype files are huge (Budget 1.4k, WorkPlan 1.5k lines); literal copies bloat pages | Med | Split big pages into 2 tasks; move mock arrays to `src/mocks/`, keeping page files mostly markup |
| Mock data looks real to the panel and diverges from real records created elsewhere | Med | Registry makes it traceable; swap to real as backend lands. Accepted per interview |
| Form fields in prototype with no backend field (e.g. Approval Info, beneficiaries) | High | Resolved Q2 — mapped to existing backend fields; only task priority/hours stay disabled |
| Losing an existing real feature while replacing markup | High | "Our extras kept" rule; each task's acceptance lists the existing API calls that must still work |
| Prototype hand-rolled mobile drawer vs our Sheet | Low | Use prototype's overlay drawer (no behavior worth shadcn) |
| Inline styles bypass dark-mode/theme tokens | Low | App has no dark mode today; accepted |

## Resolved Questions (2026-09-24)
1. **Conflicting modules** — prototype tabs first (real where an equivalent endpoint exists, mock otherwise) + our existing real features as extra tabs in the same style. Now only really matters for Forecast (ARIMA vs prototype methods/scenarios) and DSS (AHP/WSM vs prototype weighted models).
2. **Form fields without a backend field** — checked rmis-backend (`dea9255`/`80cf678`). Already implemented, map to existing fields:
   - Approval Reference Number → `ntp_number`; Approval Date → `proposal_approved_on` (+ `ntp_date`); Approving Office/Authority → `reviewing_body`; proposal submitted/reviewed dates → `proposal_submitted_on`/`proposal_reviewed_on`
   - Approval Document / supporting documents → uploaded through Documents after the project is created (`toe` or `other` type); the wizard's upload step posts to `documents/` once the project id exists
   - Closure → project `status` change to completed/archived (recorded in `status-history/` with remarks) + terminal report certify
   - Project status: backend stays `active/completed/archived`; the prototype's Registered/Ongoing/Completed/Closed pills are display labels mapped from those (no data-model change)
   - ~~Not implemented anywhere: task priority, hours, For Review~~ → all real since rmis-backend `209dac2` (2026-09-25). No task mocks needed.
3. **Prototype folder** — add to `.gitignore` and eslint `globalIgnores` (T1).
4. **Budget Office Sync (Module 15)** — REVISED 2026-09-25 (Carl OK'd): the Alignment doc lists it as its own module, so it gets its **own nav item + page** (`/budget-sync`, Financial group). It keeps the Budget page's KPI-strip + table styling. Superseded note:  the prototype has no screen for it. Its closest home in the prototype is **Budget Management** (`Budget.tsx`), whose landing view is the institution-wide LIB register (KPI strip + table of every project's LIB). Sync reconciles exactly those LIB totals against the Budget Office workbook, so it goes there as a second view toggle ("LIB Register | Budget Office Sync") using the same KPI-strip + table styling, not a new sidebar item.
