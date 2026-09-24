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
  execution→researcher. Cosmetic only — never used for access control.
- **Conflicting modules: prototype tabs first, our extras kept.** Where the
  prototype models a module differently from our backend (Compliance,
  Outputs, Monitoring, Forecast, DSS, Risk, Reports), the page gets the
  prototype's tabs/sections (real where an equivalent endpoint exists, mock
  otherwise) **plus** our existing real features as additional tabs styled
  the same way. Nothing existing is removed. *(Open question 1 — confirm.)*
- **No shared "design system" layer up front.** Prototype files are
  self-contained; copying them that way is the most accurate. Extract a
  shared piece only after it shows up in 3+ pages (e.g. `NoActualData`,
  status pill). Keeps it explainable.
- **Exports:** add `jspdf`, `jspdf-autotable`, `xlsx` (same versions as
  prototype) for the client-side exports on Dashboard/Reports that have no
  backend export. Our existing server-side Module 14 exports stay as-is.

## Page mapping
Updated 2026-09-24 after rmis-backend `dea9255` ("align backend with DPMIS
spec"). Types for every new/changed serializer are already in `src/types/`;
the API functions in `src/lib/<domain>Api.ts` get added inside each page task.

| Prototype component | Our page(s) | Real API now | Still mock (no endpoint) |
|---|---|---|---|
| Layout | `AppShell`, `AppSidebar`, `Topbar`, `nav.ts` | auth user (+ `office`, `position`) | notifications |
| Login | `LoginPage` (+ Register, GoogleChooseRole, RegistrationPending, AuthCallback restyled) | auth | — |
| Dashboard | `DashboardPage` | projects/budget/compliance/outputs + **forecasting, funding-allocation, tasks** dashboards, risk dashboard | college/project drill-down levels |
| Projects | `ProjectsPage`, `ProjectDetailPage`, `RegisterProjectPage`, `RegisterProgramPage` | projects + **description/objectives/beneficiaries/outcomes/impacts, proposal reference fields (dates, reviewing body), status history** | approval reference no. (use document upload), closure fields |
| WorkPlan | **new** `WorkPlanPage` (`/work-plan`) | milestones + **start date, objective, deliverable, responsible, `?delayed=true`** | dependencies, planned-vs-actual %, version history |
| PersonnelTasks | `TasksPage` | tasks + **`?overdue=true`, task updates, workload** | priority, hours, kanban "review" column |
| Personnel | `StaffPage` (+ `LeaderLoadPage`, `PersonnelChangesPage` restyled) | assignments + **department, collaboration (cross-dept)** | expertise tags |
| Budget | `BudgetPage` | budgets/line items + **fiscal year, funding source, counterpart, `exceeds_dry_cap`, summary by category/funding source** | LIB review workflow, version-change notes |
| Disbursement | `DisbursementsPage` | disbursements + **payee, supporting document**, realignments (= Budget Adjustments) | txn flags, reversal |
| (none) | `ProcurementPage` restyled | APP worklist + **procurement requests (Requested → Processing → Released, ₱25k routing, `?overdue=true`)** | — |
| BudgetForecast | `BudgetForecastPage` | ARIMA runs | method/scenario switcher |
| Compliance | `CompliancePage` | 5 logs + **RIUH verify**, **requirements tracker (submit/review, overdue)** | — (prototype's tracker is now real) |
| Documents | `DocumentsPage` | documents + **sensitivity, review status/review action** | module links |
| ResearchOutputs | `OutputsPage` | publications, IP, creative works, SENSE + **6Ps expected outputs, expected-vs-actual, outcomes/impacts** | technologies/partnerships detail forms (map to 6Ps "products"/"places_partnerships") |
| Monitoring | `MonitoringPage` | reports, evaluations + **evaluation rubric + weighted score, extension requests, indicators block** | indicator baseline/target time series |
| RiskManagement | `RisksPage` | **5×5 scored flags (low…critical), risk register + updates** | — (prototype's register is now real) |
| Reports | `ReportsPage` | Appendix E/F/G, project list + **financial/compliance/personnel/outputs** module reports | report history re-download |
| Analytics | `AnalyticsPage` | dashboard endpoints | — |
| DecisionSupport | `DecisionSupportPage` | AHP/WSM + **decision records, risk criterion** | — |
| UserManagement | `UsersListPage`, `PendingUsersPage` | users + **office/position, account status (suspend/reactivate/deactivate)** | profile editing beyond role |
| AuditLogs | `AuditLogsPage` | audit logs | — |
| Settings | **new** `SettingsPage` (`/admin/settings`) | none | everything |
| (none) | **new** `BudgetSyncPage` — Module 15 Budget Office sync | **imports (.xlsx), records + manual link, reconciliation** | — |

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
- [ ] T1 Foundation: global CSS, deps, mocks scaffolding, helpers, docs
- [ ] T2 Layout: sidebar, topbar, nav regroup
- [ ] T3 Login + auth pages
### Checkpoint A

### Phase 1: Core
- [ ] T4 Dashboard — KPIs + domain tabs
- [ ] T5 Dashboard — drill-down + export
- [ ] T6 Projects list
- [ ] T7 Project detail
- [ ] T8 Register Approved Project wizard
- [ ] T9 Register Program restyle
### Checkpoint B
- [ ] T10 Work Plan (new page)
- [ ] T11 Tasks (Personnel & Tasks)
- [ ] T12 Staff / Leader load / Personnel changes
### Checkpoint C

### Phase 2: Financial
- [ ] T13 Budget — overview + line items
- [ ] T14 Budget — funding, utilization, history, LIB wizard
- [ ] T15 Disbursements
- [ ] T16 Budget Forecast
- [ ] T17 Procurement — restyle + procurement requests
- [ ] T17b Budget Office Sync (new page, Module 15)
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
| `eslint .` and `**/*.{ts,tsx}` currently also lint the prototype folder (it sits inside the repo root now) | Med | T1 adds it to `globalIgnores`; decide gitignore vs. move (Open question 3) |
| Prototype files are huge (Budget 1.4k, WorkPlan 1.5k lines); literal copies bloat pages | Med | Split big pages into 2 tasks; move mock arrays to `src/mocks/`, keeping page files mostly markup |
| Mock data looks real to the panel and diverges from real records created elsewhere | Med | Registry makes it traceable; swap to real as backend lands. Accepted per interview |
| Form fields in prototype with no backend field (e.g. Approval Info, beneficiaries) | High | Open question 2 — don't silently drop user input |
| Losing an existing real feature while replacing markup | High | "Our extras kept" rule; each task's acceptance lists the existing API calls that must still work |
| Prototype hand-rolled mobile drawer vs our Sheet | Low | Use prototype's overlay drawer (no behavior worth shadcn) |
| Inline styles bypass dark-mode/theme tokens | Low | App has no dark mode today; accepted |

## Open Questions
1. **Conflicting modules** — OK ba ang rule na "prototype tabs muna (real kung may katumbas na API, mock kung wala) + existing real features natin as extra tabs"? *Mas maliit na ito after `dea9255`:* Compliance tracker at Risk register ay real na; ang natitirang conflict ay Forecast (ARIMA vs prototype methods/scenarios) at DSS (AHP/WSM vs prototype weighted models).
2. **Form fields na walang backend field** — mas konti na (beneficiaries, objectives, outcomes, proposal dates meron na). Natitira: approval reference number/approving office sa wizard, closure fields, task priority/hours. Recommendation: ipakita pero naka-disabled.
3. **Prototype folder sa loob ng repo** — i-`.gitignore` at i-ignore sa eslint (recommended), o ibalik bilang sibling dir gaya ng dati?
4. **Budget Office Sync (Module 15)** — walang prototype component. Bagong page sa Financial group, naka-style sa prototype design language (recommended), o isama bilang tab sa Budget page?
