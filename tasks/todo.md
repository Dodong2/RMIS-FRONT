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

### - [x] T9: Register Program restyle
**Description:** Restyle `RegisterProgramPage` in the wizard's visual language (no prototype counterpart).
**Acceptance criteria:**
- [x] Program create → redirect → appears in list still works
**Dependencies:** T8
**Files:** `src/pages/RegisterProgramPage.tsx`
**Scope:** XS
**Result (2026-09-25):** Restyled in the wizard card language (navy header, info note, prototype inputs, footer actions). Same fields and gates. Verified with a rolled-back APIClient run: create → 201, appears in `programs/`, 0 leaked rows.

## Checkpoint B: Dashboard + Projects
- [ ] Build + lint clean
- [ ] Register a project end-to-end through the new wizard
- [ ] Human review

### - [x] T10: Work Plan (new page)
**Description:** New `/work-plan` page cloned from `WorkPlan.tsx` (Gantt, Activities, Deliverables, Version History).
**Acceptance criteria:**
- [x] Project selector real; Gantt rows from milestones (`start_date` → `target_date`), activities table shows objective/deliverable/responsible, delayed filter uses `?delayed=true`; dependencies/versions mocked
- [x] Route wrapped in ProtectedRoute + RoleGate matching nav tiers; nav item `ready: true`
- [x] Add/edit milestone gated to `projects.manage_milestones` roles (admin, crc_chair, program/project/study leaders)
**Dependencies:** T2
**Files:** `src/pages/WorkPlanPage.tsx`, `src/App.tsx`, `src/lib/nav.ts`, `src/mocks/workPlan.ts`
**Scope:** M
**Result (2026-09-25):**
- New `/work-plan` page cloned from `WorkPlan.tsx`: a project list, then detail via `?project=<id>`. Activities are milestones.
- The prototype's per-activity planned/actual % has no backend field, so it's replaced by real numbers:
  - planned % = milestones whose target date has passed
  - actual % = milestones done
  - variance = days late
- Tabs:
  - **Gantt** (start→target, today line).
  - **Activities:** expandable rows, inline status select, Edit/Add dialog with start/target/responsible (project lead + active assignees)/objective/deliverable via the new `researchApi.updateMilestone`, and a "Show delayed only" toggle backed by `?delayed=true`.
  - **Deliverables** register.
  - **Version History:** mocked (`src/mocks/workPlan.ts`, REGISTRY row), hidden until the project has activities.
- **Dependencies are not shown at all** (neither mocked nor faked). Mock links between real milestones would read as real scheduling data.
- Route RoleGate matches the nav tiers; the nav item is now `ready: true`. Writes are gated to `MILESTONE_ROLE_CODES`.
- Verified with a rolled-back APIClient run as project_leader: create with responsible → 201, PATCH title/start/responsible → 200, `?delayed=true` returns the overdue row, 0 leaked. Headless screenshots OK.

### - [x] T11: Tasks (Personnel & Tasks)
**Description:** Clone `PersonnelTasks.tsx` (Task Board kanban, Task List, Workload, Personnel) onto `TasksPage`.
**Acceptance criteria:**
- [x] Real tasks in kanban/list; existing create/update-status actions still work
- [x] Comments = real task updates; Workload tab = `personnel/workload/`; overdue via `?overdue=true`
- [x] Kanban columns = real statuses incl. **For Review** (`for_review`, rmis-backend `209dac2`). An assignee can move a task only to in_progress/blocked/for_review; "done" comes only from a leader/assigner via `tasks/<id>/review/` (`approve` → done, `return` → in_progress, with remarks)
- [x] Real priority (`?priority=`), estimated/logged hours, tags (`?tag=`), started/completed dates, update kinds (update/comment/blocker/completion) + hours per update, deliverables checklist (`tasks/<id>/deliverables/`, `task-deliverables/<id>/`). Nothing on this page stays mocked
- [x] Workload tab shows estimated/logged hours
**Dependencies:** T2
**Files:** `src/pages/TasksPage.tsx`, `src/mocks/tasks.ts`
**Scope:** M
**Result (2026-09-25):** `TasksPage` rebuilt from `PersonnelTasks.tsx`. Nothing is mocked.
- Layout: KPI strip → project list (staff only see projects with tasks assigned to them) → board at `?project=<id>`.
- Tabs:
  - **Task Board:** 5 real columns, To Do/In Progress/For Review/Blocked/Completed.
  - **Task List**
  - **Workload:** `personnel/workload/?project=`, assigners only because the backend 403s others.
  - **Personnel:** leader + active assignments, with per-person task counts.
- Filters: search/tag, priority, member, and "overdue only" via `?overdue=true`.
- Task detail modal:
  - deliverables checklist (tick = assignee/assigner, add/delete = assigner)
  - tags
  - real updates feed + post (kind + hours)
  - hours bar (estimated vs logged)
  - status buttons: assignee limited to in_progress/blocked/for_review; assigner gets all
  - Approve/Return with remarks when For Review (`tasks/<id>/review/`)
  - Edit and Delete for assigners
- Create modal: assignee, study, priority, due, est. hours, tags, deliverables (posted after create).
- **Bug fixed:** the old form filled assignees from `users/by-role`, which is system_admin/crc_chair only, so leaders got an empty list. It now uses the project's active assignments + leader.
- **Also fixed globally:** hand-rolled overlays now portal to `document.body` (Tasks + Dashboard report modal); they were clipped to the content area by the page's `animate-fade-in` transform. The fade-in keyframes also end at `transform: none`.
- API additions: `personnelApi` updateTask/reviewTask/getTaskUpdates/postTaskUpdate/add|set|deleteTaskDeliverable, and getTasks gains priority/tag/overdue.
- Verified with a rolled-back APIClient run as project_leader (create with priority/hours/tags → deliverable → tick → update 2.5h → for_review → approve → done, logged 2.5 → workload → overdue filter → delete; 0 leaked). The assignee-only path was not live-tested because the dev DB has no project_staff user. Headless screenshots OK.

### - [x] T12: Staff / Leader load / Personnel changes
**Description:** Clone `Personnel.tsx` onto `StaffPage`; restyle `LeaderLoadPage` and `PersonnelChangesPage` to match.
**Acceptance criteria:**
- [x] All existing staff assignment, leader-load, and personnel-change actions still work
- [x] Assignment `department` shown/editable; cross-departmental collaboration view from `personnel/collaboration/`
**Dependencies:** T2
**Files:** `src/pages/StaffPage.tsx`, `LeaderLoadPage.tsx`, `PersonnelChangesPage.tsx`
**Scope:** M
**Result (2026-09-25):**
- **StaffPage (Personnel Coordination):** cloned from `Personnel.tsx`.
  - KPIs, search, and a personnel card grid built from staff profiles + assignments.
  - Person detail: level switcher, assignments with End.
  - "Set Staff Level" and "Assign to Project" modals (portaled); department added to the assign form.
  - Tabs: Personnel / Assignments (department editable inline via assignment PATCH) / Cross-Department Collaboration (`personnel/collaboration/`, cross-only toggle).
  - The prototype's expertise tags were **left out, not mocked**: there's no data for them, and mocked chips on real people would read as real.
- **LeaderLoadPage:** KPI strip + leader cards with count/cap bars.
- **PersonnelChangesPage:** restyled (KPIs, native selects, SectionCards). The logic is unchanged apart from the reload-key effect, which clears an old lint error.
- Shared prototype pieces were extracted now that 3+ pages repeat them: `src/components/common/proto.tsx` (SectionCard, KpiCard, Field, TableHead, Pill, SkeletonRows) and `src/lib/protoStyles.ts` (input/button constants).
- Known limitation (pre-existing): staff pickers use `users/by-role`, which only system_admin/crc_chair can read, so drd/riuh managers see no staff to assign.
- Verified with rolled-back APIClient runs (temp project_staff user created inside the rollback): assignment create with department → 201, department PATCH → 200, shows in collaboration, staff level → 201, 0 leaked. Headless screenshots OK.

## Checkpoint C: Core complete
- [ ] Build + lint clean; human review

---

## Phase 2: Financial

### - [x] T13: Budget — overview + line items
**Description:** Clone `Budget.tsx` project picker, Overview and Line Items tabs onto `BudgetPage`.
**Acceptance criteria:**
- [x] Create budget, add/remove line item, certify still work with the `MANAGE_ROLE_CODES` / `CERTIFY_ROLE_CODES` split intact. `MANAGE_ROLE_CODES` gains `program_leader` + `project_leader` (backend `budget.manage`, rmis-backend `209dac2`): leaders encode their own LIB and get a 400 on other projects. Certify stays finance_budget/system_admin
- [x] Remove line item hidden on a certified budget (backend now 400s the delete)
- [x] `/budget` RoleGate + nav tiers gain study_leader, view-only (Q12). Study-level allocation is mocked + REGISTRY row until backend P11 (`LineItem.study`)
- [x] PS/MOOE/CO grouping from `category`; fiscal year, funding source, counterpart fields in the add form; `exceeds_dry_cap` shown as a non-blocking warning
**Dependencies:** T2
**Files:** `src/pages/BudgetPage.tsx`, `src/mocks/budget.ts`
**Scope:** M
**Result (2026-09-25):** `BudgetPage` rebuilt from `Budget.tsx`.
- **LIB register:** 6 KPIs (Total LIB, Certified ₱, Certified count, Draft, Over dry cap, No LIB yet), a card per current LIB (status, version, dry-cap flag, PS/MOOE/CO split, certification prompt), and a "Prepare New LIB" project picker.
- **Detail** at `?project=`:
  - header with totals + Certify (finance_budget/system_admin, disabled when there are no items)
  - **Overview:** category bar, annual allocations by `fiscal_year` ("No fiscal year" column for nulls), certified baseline from the summary
  - **Line Items:** grouped PS/MOOE/CO tables with APP/counterpart chips; an add form with fiscal year/funding source/counterpart; Remove only on draft
- The prototype's LIB statuses (submitted/under review/returned) map onto our real draft/certified only.
- Leaders were added to `MANAGE_ROLE_CODES`, and study_leader to the `/budget` RoleGate + nav tier (read-only).
- **Study-level allocation is not mocked.** Study leaders see a note that per-study allocation isn't tracked yet (until backend P11 `LineItem.study`). A fake split of a real LIB would misstate real money.
- Verified with a rolled-back APIClient run as project_leader: add CO item with FY/funding/counterpart → 201, APP-flagged; delete → 204; 0 leaked. There's no study_leader account in the dev DB to test with. Headless screenshots OK.

### - [x] T14: Budget — funding, utilization, history, LIB wizard
**Description:** Remaining Budget tabs: Funding Sources, Utilization, Version History, LIB wizard.
**Acceptance criteria:**
- [x] Utilization + Funding Sources read the summary's `by_category`/`by_funding_source`/`utilization_pct`; version history from budget versions; LIB review workflow mocked
**Dependencies:** T13
**Files:** `src/pages/BudgetPage.tsx`, `src/mocks/budget.ts`
**Scope:** M
**Result (2026-09-25):**
- **Funding Sources:** grouped from line items' `funding_source` + `is_counterpart` (works on drafts too), with actual/available from `summary.by_funding_source` once certified.
- **Utilization:** PS/MOOE/CO cards (adjusted, actual, %, available) + a per-line-item Approved→Adjusted→Actual→Available table from the summary. Drafts show the prototype's "starts after certification" state.
- **Version History:** real versions table (created, certified, items, total, current) + a timeline of real events (Prepared / Certified).
- **LIB wizard:** real, not mocked. Steps are Budget Info (default FY + funding source) → PS → MOOE → CO → Validate & Save. It creates the budget when none exists (or appends to the current draft) and POSTs each item with amount = qty × unit cost; qty/unit/unit cost are kept in the description text because the model has no fields for them. Checks: ≥1 item, descriptions, FY and funding source present. It shows the dry-cap warning when institutional dry research goes over ₱100k.
- **The prototype's LIB review workflow (submitted/returned/revision requested) is not mocked.** The real flow is draft → Budget Officer certify, and that is what the page shows.
- Dropped from the prototype: its "Upload LIB file" option. The xlsx import belongs to Budget Office Sync (T17b).
- The wizard's save was not exercised live (it would write items to P77's real draft). It uses the same `createBudget`/`createLineItem` calls verified in T13. Headless screenshots OK.

### - [x] T15: Disbursements
**Description:** Clone `Disbursement.tsx` (Ledger, Utilization, Variance, Budget Adjustments, Financial Report) onto `DisbursementsPage`.
**Acceptance criteria:**
- [x] Ledger = real disbursements incl. payee + supporting document; Adjustments = real realignments incl. tier-gated review + BOR resolution number
- [x] Variance/Report computed from real data where possible, else mocked
**Dependencies:** T2
**Files:** `src/pages/DisbursementsPage.tsx`, `src/mocks/disbursements.ts`
**Scope:** M
**Result (2026-09-25):** `DisbursementsPage` ("Financial Monitoring") rebuilt from `Disbursement.tsx`. Everything is real; nothing is mocked.
- **List:** 6 KPIs from all budgets/disbursements/realignments, and a card per project (certified / not certified / no LIB, pending realignments, utilization vs certified LIB).
- **Board** at `?project=`, 5 tabs:
  - **Ledger:** real disbursements with payee, reference, category filter, and a detail modal showing funding source and supporting document.
  - **Utilization:** summary per line item with adjusted/actual/balance bars.
  - **Variance:** flags computed from real figures. Over >100%, near limit >85%, under <20% on ≥₱50k, realigned >15%. The prototype's "missing LIB link" flag is dropped because every disbursement must be linked.
  - **Budget Adjustments:** real realignments with tier/status, tier-gated Approve/Reject inline, and the BOR resolution no. required for BOR approval.
  - **Financial Report:** summary KPIs, category breakdown, monthly bar chart from disbursement dates.
- **Record modal:** LIB item picker showing available/%, an over-available block, payee, reference, and a supporting document picker from the project's current documents.
- **Realign modal:** existing or new item, and an expected-tier preview; the tier itself is server-computed.
- The prototype's draft/posted/flagged/reversed transaction statuses have no backend field; every disbursement shows as Posted.
- Verified with a rolled-back APIClient run (0 leaked, budget 18 back to draft):
  - certify → 200
  - disbursement with payee → 201
  - over-available → 400 with the balance message
  - summary actual updates
  - leader realignment → 201 (major, pending)
  - admin review → approved
- Headless screenshots OK; P77 is still draft, so the board shows the "needs certified LIB" states.

### - [x] T16: Budget Forecast
**Description:** Clone `BudgetForecast.tsx` onto `BudgetForecastPage`.
**Acceptance criteria:**
- [x] Real ARIMA runs + trigger + insufficient-data message still work
- [x] Prototype method/scenario controls mocked (backend has ARIMA only)
**Dependencies:** T2
**Files:** `src/pages/BudgetForecastPage.tsx`, `src/mocks/forecast.ts`
**Scope:** M
**Result (2026-09-25):** `BudgetForecastPage` rebuilt from `BudgetForecast.tsx` (parameters panel + Projections / Budget Comparison / Saved Forecasts tabs).
- **The prototype's method/scenario controls are real, not mocked.** Burn rate, linear trend (least squares over the anchor period), moving average, and % completion (remaining budget ÷ months to `target_end_date`) are computed in the browser from the project's actual monthly disbursements (`disbursements/?project=`, zero-filled months). Scenarios are optimistic ×0.85, base, and conservative ×(1+contingency). These quick runs are not persisted (no endpoint); the page says so.
- ARIMA (server) is the default method: trigger (FORECAST roles), confidence-band chart, MAE/RMSE/MAPE, overrun flag, insufficient-data message.
- "Saved Forecasts" = the real ARIMA run history, with Load.
- Budget status uses the certified summary (adjusted) when available, otherwise the LIB total.
- Headless screenshot OK. **The quick-method charts were not seen with data**: the dev DB has 0 disbursements, so they show "No actual data".

### - [x] T17: Procurement — restyle + procurement requests
**Description:** Restyle `ProcurementPage` in the Disbursement page's language and add the new procurement-request pipeline.
**Acceptance criteria:**
- [x] APP-flagged worklist + project filter still work
- [x] Leaders can file a request (certified budget only); procurement_officer_lib/system_admin move Requested → Processing → Released/Cancelled; overdue filter
- [x] `/procurement` RoleGate + nav tiers gain program_leader/project_leader (Q12; they can't open the page today). The APP worklist stays visible to them (backend scopes budget data to their projects)
**Dependencies:** T15
**Files:** `src/pages/ProcurementPage.tsx`, `src/lib/financialApi.ts`
**Scope:** M
**Result (2026-09-25):** Two tabs: Procurement Requests (pipeline dots, routing label, delayed flag, inline status actions for update roles) and APP Worklist (> ₱50,000). There are 6 KPIs; Delayed comes from `?overdue=true`. The New Request modal only lists projects with a certified current LIB and shows a routing preview. Rolled-back APIClient smoke test: leader file → 201 (routed to university_president); leader status move → 403; requested→released skip → 400; processing → released → 200; 0 leaked rows. Headless-checked as project_leader. The dev DB has no certified LIB, so the modal shows its empty state.

### - [x] T17b: Budget Office Sync page (Module 15)
**Description:** New Module 15 page for the XLSX import + reconciliation, styled with the Budget page's KPI strip + table. It gets its own sidebar item (decision revised 2026-09-25).
**Acceptance criteria:**
- [x] New `BudgetSyncPage` at `/budget-sync`: own nav item in the Financial group (Alignment doc lists Module 15 separately). RoleGate = finance_budget/system_admin write + oversight/finance read, mirroring the backend
- [x] Upload .xlsx (system_admin/finance_budget), list imports and records, manually link/unlink a record to a project
- [x] Reconciliation table with matched/discrepancy/no_rmis_budget/unlinked summary
**Dependencies:** T13
**Files:** `src/pages/BudgetSyncPage.tsx`, `src/lib/budgetSyncApi.ts`, `src/App.tsx`, `src/lib/nav.ts`
**Scope:** M
**Result (2026-09-25):** New `BudgetSyncPage` at `/budget-sync` (RoleGate: system_admin/vprei/university_admin/drd/finance_budget; nav item is now ready). It has an import picker, a "+ Import Workbook (.xlsx)" button (system_admin/finance_budget), 5 KPIs from the reconciliation summary, a Reconciliation table (status pill, Budget Office vs RMIS LIB totals with the difference, inline Link/Unlink for managers), a status filter, and an Import History tab. The records endpoint only adds the leader and implementing unit under each title. Rolled-back smoke test with the real consolidated workbook: leader upload → 403; .csv → 400; admin upload → 201 (49 sheets, P77 auto-matched); link → manual; unlink → ''; leader PATCH → 403; 0 leaked. Headless-checked with a throwaway import (deleted after). The dev DB has no imports, so the page shows its empty state until finance uploads one.

## Checkpoint D: Financial
- [ ] Build + lint clean; certify → disburse → realign walk-through; human review
**Automated part (2026-09-25):** Build clean; eslint shows only the 7 pre-existing errors. Rolled-back API walk-through on budget 18 (P77): leader certify → 403; admin certify → 200; disburse → 201 (leader → 403); minor realign → auto `implemented`; major realign (50%) → `pending_approval`; leader review → 403; admin approve → 200, and the summary's adjusted amounts moved (₱10,917.60 → ₱14,417.60, ₱7,000 → ₱3,500). 0 leaked. **Human review still pending.**

---

## Phase 3: Research

### - [x] T18: Compliance
**Description:** Clone `Compliance.tsx` onto `CompliancePage` per resolved Q1.
**Acceptance criteria:**
- [x] All 5 existing logs still work; leaders can now encode; RIUH "Verify" action on each record
- [x] AI declaration form has an optional `ai_content_pct` (0–100) input; an "Over 20% AI" badge shows from `exceeds_ai_threshold` (server-computed, never recomputed client-side)
- [x] Prototype requirement tracker wired to `compliance/requirements/` (create, submit with document, review → compliant/returned/non_compliant, overdue)
- [x] No "Ethics Committee approval" wording (panel recommendation)
**Dependencies:** T2
**Files:** `src/pages/CompliancePage.tsx`, `src/mocks/compliance.ts`
**Scope:** M
**Result (2026-09-25):** `CompliancePage` has two tabs.
- **Requirements Tracker** is the prototype layout on real `compliance/requirements/`: 6 KPIs, the compliance-rate meter, an Attention list, search/status/project filters, and the table. The Define modal assigns to the project leader or an active team member. The Detail modal has Details, Evidence (the attached project document with a signed View link), and History (built from the real created/submitted/reviewed timestamps). There are Submit (optional current project document) and Review (compliant / returned / non-compliant; remarks required for the last two) modals.
- Overdue comes from the server's `is_overdue`. "Due Soon" (≤7 days) is a client-side display hint only.
- Dropped from the prototype: category, external reference, and waive, because the backend has no such fields or statuses.
- **Integrity Records** (`src/components/compliance/IntegrityRecords.tsx`) holds the 5 logs with add modals. Review References and Similarity Checks are encode roles (leaders now included). Misconduct and COI status are riuh/system_admin. The RIUH Verify button covers 4 logs. The AI form has an optional `ai_content_pct`, and the "Over 20% AI" badge comes from `exceeds_ai_threshold`.
- "Ethics Reviews" was relabeled "Review References". The page title is "Compliance Tracking".
- A shared `ProtoModal` (portal) was added to `proto.tsx`. No mock was needed, so `src/mocks/compliance.ts` wasn't created.

Rolled-back smoke test:
- The leader defines (overdue → listed by `?overdue=true`) and submits. A leader review gets 403. The admin returns it, the leader resubmits, and it ends compliant.
- AI 25% → exceeds=true; 150 → 400.
- Leader verify → 403; admin verify → 200. A leader status edit clears the verification.
- Leader misconduct → 403; leader review reference → 201.
- 0 leaked. Headless-checked with throwaway rows (deleted after).

### - [x] T19: Documents
**Description:** Clone `Documents.tsx` onto `DocumentsPage`.
**Acceptance criteria:**
- [x] Upload (25MB check), current/all versions, download (signed URL), archive all still work
- [x] Access level = real `sensitivity`; review status + review action real; module links mocked
- [x] Per-document sharing with expiry (Q8) mocked + REGISTRY row (backend P14 not built)
**Dependencies:** T2
**Files:** `src/pages/DocumentsPage.tsx`, `src/mocks/documents.ts`
**Scope:** M
**Result (2026-09-25):** `DocumentsPage` is the prototype card grid across every project the user can see (the backend's `visible_documents` already scopes by role + sensitivity).
- Controls: 6 KPIs (Total, Active, Pending Review, Returned, Versioned, Projects), search/type/review-status/project filters, All / By Project / By Type views, and a "Show superseded versions" toggle (drives `current_only`).
- Upload is a 2-step modal: file (25MB check), type, project, study; then stage, access level = real `sensitivity`, defaulting to financial for LIB.
- The detail modal has 4 tabs:
  - Info: review panel with Approve / Return (return needs remarks), for riuh/system_admin via the new `documentApi.reviewDocument`. Download uses a signed URL, "Upload New Version" pre-fills project/type/study, and Archive is manage-only.
  - Version History: real, the same project/type/study.
  - Linked Records: computed from real compliance requirements + monthly/midterm/terminal reports that point to this document (so it isn't mocked).
  - Sharing: mocked, read-only (`src/mocks/documents.ts` + REGISTRY row; P14 not built).
- Dropped from the prototype: title/description/tags/version notes (no backend fields). The Draft KPI is replaced by Pending Review/Returned.

Rolled-back API test: leader sees team docs but not `restricted`; `current_only` returns only v2; leader review → 403; admin return → 200 with remarks; `?review_status=returned` filter works. Archive was only exercised against a fake storage path (it 500s when signing the fake path, test artifact only; everything rolled back, 0 leaked). Headless-checked with throwaway rows (deleted after).

### - [x] T20: Research Outputs
**Description:** Clone `ResearchOutputs.tsx` onto `OutputsPage`.
**Acceptance criteria:**
- [x] Publications + IP real (server-computed incentive shown); Creative Works + SENSE publishers kept as extra tabs
- [x] Outcomes & Impacts real (`outputs/outcomes/`); 6Ps expected outputs + expected-vs-actual real; Technologies/Partnerships detail forms mocked
**Dependencies:** T2
**Files:** `src/pages/OutputsPage.tsx`, `src/mocks/outputs.ts`
**Scope:** M
**Result (2026-09-25):** `OutputsPage` has 4 tabs.
- **Research Outputs** is the prototype family grid across all projects, all real:
  - Publications (server `estimated_incentive` shown) and IP (status select + incentive-claimed toggle for report roles; eligibility from the server).
  - Technologies = 6Ps `products` expected outputs; Partnerships = 6Ps `places_partnerships`. Real records with target/actual; the detail modal edits the manual count or removes it.
  - Outcomes & Impacts = `outputs/outcomes/`.
  - Family KPI buttons, 5 secondary KPIs (incl. the estimated publication incentive total), search/family/status/project filters, and a detail modal (Details / Linked Researchers / Supporting Records).
- **Register Output** (`src/components/outputs/RegisterOutputModal.tsx`) covers all 5 families.
- **6Ps Expected vs Actual**: per-project category cards from `expected-vs-actual/`, a target table with inline manual-count edits (computed categories are read-only), and an add-target form.
- **Creative Works** and **SENSE Publishers** tabs are kept.
- Shared labels live in `src/lib/outputsMeta.ts`. Added API: `createOutcome`, expected-output list/create/update/delete.
- **Deviation:** Technologies/Partnerships detail fields (adopters, partner org, agreement no., signatories) were *not* mocked. They map to real 6Ps records instead, with no invented detail. No `src/mocks/outputs.ts`.
- **Fix:** `PublicationRecord.estimated_incentive` retyped to `number | null`. The SerializerMethodField returns a Decimal, which DRF renders as a JSON number; it was wrongly typed as a string.

Rolled-back API test: leader publication (ISI, IF 2.5) → ₱60,000; IP create → disclosed/not eligible, PATCH registered → 200; expected output create/patch (actual 0→2)/delete 204; expected-vs-actual categories correct (publications counted from records); outcome 201; crc_chair outcome → 403. 0 leaked. Headless-checked with throwaway rows (deleted after).

### - [x] T21: Monitoring & Evaluation
**Description:** Clone `Monitoring.tsx` onto `MonitoringPage`.
**Acceptance criteria:**
- [x] Evaluations tab real; Status, Monthly/Midterm/Terminal, Renewal kept as extra tabs, all actions working
- [x] Indicators = status `indicators` block; evaluation criteria rubric + scores + weighted score real; extension requests (submit/endorse/approve) real; indicator baseline/target series mocked
**Dependencies:** T2
**Files:** `src/pages/MonitoringPage.tsx`, `src/mocks/monitoring.ts`
**Scope:** M
**Result (2026-09-25):** `MonitoringPage` is the prototype's per-project M&E board with a project selector (one board at a time, because the status endpoint is per-project and the remote DB is slow). There's also a "Evaluation Rubric" view.
- **Indicators / Performance Map:** 12+ real indicators built from the status `indicators` block + `outputs/expected-vs-actual/` (one per 6P category with a target). Statuses use the prototype's ratio thresholds.
- **Evaluations** (`src/components/monitoring/Evaluations.tsx`): schedule, and a detail modal with the real rubric scores (0–100 per active criterion, weight shown, panel-only input) + server `weighted_score` + outcome/findings.
- **Rubric** tab: criteria CRUD (add, reweight, activate/deactivate) with a live 100% check.
- **Progress Reports** (monthly/midterm/terminal + certify), **Extensions** (request → endorse → approve/deny, role-gated per step), and **Renewal** (apply, eligibility, decide) live in `src/components/monitoring/Reports.tsx`.
- **Deviation:** the indicator baseline/target time series was *not* mocked (no backend; same choice as T19/T20). Indicators have no detail/"record accomplishment" modal.
- Added API: criteria list/create/update, scores list/save, extension requests list/create/action.

Rolled-back API test:
- Status + indicator keys match the types. Leader creating a criterion → 403.
- Scoring with a 90% rubric → 400 (fix the rubric); 3 criteria at 60/30/10 scored 80/90/70 → weighted 82.0. Outcome passed → `evaluated_at` set.
- Leader extension → pending with `current_end_date` auto-set; a duplicate request → 400; leader endorse → 403; approve before endorse → 400; endorse → approve moves `target_end_date`.
- 0 leaked, and the project end date was restored.
- Headless-checked on real P77 data (8 months without a monthly report → termination recommended; LIB not certified → 0% utilization).

### - [x] T22: Risk Management
**Description:** Clone `RiskManagement.tsx` onto `RisksPage`.
**Acceptance criteria:**
- [x] Risk register real (`risk/register/` + updates): 5×5 matrix, owner, mitigation, status
- [x] Computed 5×5 flags + `recommended_action` kept real (Institution Overview + Project Risk Status)
- [x] Role-banded alert inbox (Q7): computed from real data instead of mocked (see Result)
**Result:** Tabs Risk Register (cards + table, 4 filters) / Heat Map (open risks, category tiles) / Mitigation Plan /
Early-Warning Flags (dashboard + per-project status) / Alert Inbox. Identify (POST) and Update (PATCH L/I/mitigation +
POST update note with optional `new_status`; a re-assessment is appended to the note since `RiskUpdate` has no L/I fields).
Alert inbox is built live from `risk/dashboard` flagged projects + open register risks at medium+ and routed by Q7 bands
(medium → PL, high → RIUH+CRC, critical → VP/DRD), so no mock and no REGISTRY row; there is no read/ack state until
backend P15 `risk/alerts/`. Dropped from the prototype (no backend field): risk title (description is the title),
contingency plan, mitigation status. Smoke-tested (rolled back, 0 leaked): leader create 201 (4×4 = 16 high),
likelihood 6 → 400, PATCH 5×4 → 20 critical, update with `new_status` moves status, note-only keeps it, status endpoint
counts the open risk. Screenshots taken on 3 temporary risks on P77 (deleted after).
**Dependencies:** T2
**Files:** `src/pages/RisksPage.tsx`, `src/mocks/risks.ts`
**Scope:** M

## Checkpoint E: Research
- [ ] Build + lint clean; human review

---

## Phase 4: Insights

### - [x] T23: Reports
**Description:** Clone `Reports.tsx` report catalog onto `ReportsPage`.
**Acceptance criteria:**
- [x] Appendix E/F/G + Project List download real server files (`file_format`, blob error handling unchanged); Generation Log real + role-gated
- [x] Financial/Compliance/Personnel/Outputs module reports download from `reports/<type>/`
- [x] Only catalog entries with no endpoint export client-side (jspdf/xlsx) — both use live data, none mocked
- [x] Custom report builder / scheduled generation mocked + REGISTRY row (Scheduled Reports tab; the filtered builder is the real Project List report)
**Result:** Tabs Report Catalog (10 entries, domain filter, Generate modal with per-report params + format) / Generation
History (real `reports/logs/`, system_admin/riuh/drd/vprei only, "Regenerate" re-runs the logged filters on current data)
/ Submitted Reports (real monthly/midterm/terminal reports across projects, view attached document, export Appendix E/F
preset to that project; submitting stays in Monitoring & Evaluation) / Scheduled Reports (mock). Client-side entries:
Risk Register Export, Evaluation Summary (PDF/XLSX via `exportFiles.ts`, not logged by the server). Dropped from the
prototype: report Preview, row count / file size, 5 catalog entries with no data source (Disbursement Detail, Budget
Forecast, Compliance Audit Trail, Project Performance, DSS Scorecard). Smoke-tested: 4 module types × 4 formats all 200
with the right content type, unknown type 404, leader logs 403; headless download of a real PDF (server) and the risk
register PDF (client). Test log rows deleted.
**Dependencies:** T5 (shared export helper)
**Files:** `src/pages/ReportsPage.tsx`, `src/mocks/reports.ts`, `src/lib/exportFiles.ts`
**Scope:** M

### - [x] T24: Analytics
**Description:** Clone `Analytics.tsx` onto `AnalyticsPage`.
**Acceptance criteria:**
- [x] All existing real charts/tabs (incl. Planning Targets create + comparison, exports) still present in prototype style
**Result:** Prototype filter bar (campus + funding type from real projects, drive the project/budget/forecast dashboards)
and segmented tabs: Overview (KPIs, status donut, funding/campus bars, monthly disbursement trend from real
`financial/disbursements/` with a year picker, output summary, compliance snapshot) / Projects (+ project register
table) / Budget / Budget Forecast (new, `dashboard/forecasting/`) / Compliance / Outputs / REI Thrust / Planning Targets
/ Data Exports. recharts replaced by the prototype's CSS HBar/Donut/TrendBar (`src/components/analytics/ProtoCharts.tsx`).
No mock needed, so no `src/mocks/analytics.ts`. Dropped from the prototype (no data): per-project physical %,
program/agency filters, campus/college weighted ranking, monthly output submissions, funding-source pipeline. "Ethics
Reviews" relabeled "Review References". Fixed a pre-existing bug: an Institution-wide planning target 400'd because
`campus` was omitted (backend needs the key, blank allowed); it now sends `""` (verified 201 in a rolled-back shell test).
**Dependencies:** T2
**Files:** `src/pages/AnalyticsPage.tsx`, `src/mocks/analytics.ts`
**Scope:** M

### - [x] T25: Decision Support
**Description:** Clone `DecisionSupport.tsx` onto `DecisionSupportPage`.
**Acceptance criteria:**
- [x] Criteria, AHP weighting/finalize, recommendation trigger, sensitivity all still work
- [x] Decision records real (`recommendation-runs/<id>/decisions/`, University President can decide); prototype DSS "models" view mocked if kept
**Result:** Prototype layout mapped onto the real AHP/WSM flow, no mock needed. "DSS Models" = AHP runs (+ New creates
one; a draft gets "Set Weights", the Saaty pairwise modal that submits + finalizes; CR > 0.10 blocks Run DSS). "Run DSS"
= recommendation trigger with funding-type/campus filters (dss.manage roles). Rankings: composite × 100 as the DSS score,
cosmetic grade bands from the prototype, rank cards + comparison table + sensitivity panel, score-detail modal with
per-indicator breakdown and a domain radar (domain derived from `metric_key`). Indicators: criteria of the model, weight
bar + CR, Define Indicator → real criterion; formula text matches `decision_support/services.py`. Decision Records: real
list/record/replace per run, Fund/Defer/Decline + indicative amount + reference no. (the backend's fields, replacing the
prototype's approve/terminate/escalate + follow-up); `canDecide` = system_admin/drd/vprei/university_admin
(`DECISION_ROLES`). Decider names resolve via `getUsers()` for system_admin only, else "You"/"User #id". Verified with a
rolled-back APIClient run (project_leader 403 on decide, university_admin 201, replace, unranked project 400) and
headless screenshots on temporary seed data, deleted after (incl. its 9 audit-log rows).
**Dependencies:** T2
**Files:** `src/pages/DecisionSupportPage.tsx`, `src/mocks/decisionSupport.ts`
**Scope:** M

## Checkpoint F: Insights
- [ ] Build + lint clean; human review

---

## Phase 5: Administration + wrap-up

### - [x] T26: User & Access Management
**Description:** Clone `UserManagement.tsx` tabs (Accounts, Profiles, Assignments, Audit) across `UsersListPage` + `PendingUsersPage`.
**Acceptance criteria:**
- [x] Existing user list + approve/reject pending users still work
- [x] Office/position shown; Suspend/Reactivate/Deactivate via `account-status/` (deactivate shows the hand-over-first error); assignments mocked where no endpoint
- [x] Temporary replacement while suspended (Q3) mocked + REGISTRY row (backend P13 not built)
- [x] Scope (campus/college) shown per user and editable via `PATCH admin/users/<id>/scope/` (a blank value clears it). Note in the UI hint: college is stored but not enforced yet
- [x] Extra tab "Roles & Permissions": read-only role × permission matrix from `GET admin/permissions/` (36 codes × 12 roles, grouped by module). No editing (client: future enhancement)
**Result:** `/admin/users` is now User & Access Management with 5 tabs: User Accounts (KPIs, search/role/scope/status
filters, inline role change, Suspend/Reactivate/Deactivate via `account-status/`, deactivate behind a confirm modal and
the hand-over-first 400 shown with the counts, own row locked), Personnel Profiles (office/position/scope cards), Org.
Assignments (grouped by real `scope` campus → college, Scope editor with datalist of project campuses, blank clears,
"college not enforced" hint), Roles & Permissions (read-only matrix, 36 × 12, grouped by module; Perms modal per role),
Access Audit (real audit log filtered to `/api/admin/*`, link to `/admin/audit`). Row click opens the user detail modal;
a suspended account shows the mocked temporary-replacement card (`src/mocks/users.ts`, REGISTRY row). Dropped from the
prototype (no endpoint): Create Account wizard (replaced by a "Pending Registrations (n)" link, the real flow), Reset
Password, Edit Profile, employee ID, last login. `/admin/pending-users` restyled (KPIs, native selects preselected to
the requested role, "Assign & Activate"). `toggleUserActive` removed from `authApi` (superseded by `account-status/`).
eslint 7 → 5 (both admin pages' set-state-in-effect errors gone). Verified with a rolled-back APIClient run (suspend,
reactivate, scope set/clear, deactivate 400 for a project lead with `{"projects": 1}`, deactivate 200, reactivate-after-
deactivate 400; 0 users / 0 audit rows leaked) and headless screenshots. The deactivate UI click was not exercised on
the dev DB (the first eligible row is a real account without responsibilities, so it would really deactivate).
**Dependencies:** T2
**Files:** `src/pages/admin/UsersListPage.tsx`, `src/pages/admin/PendingUsersPage.tsx`, `src/mocks/users.ts`
**Scope:** M

### - [x] T27: Audit Logs
**Description:** Clone `AuditLogs.tsx` onto `AuditLogsPage`.
**Acceptance criteria:**
- [x] Real audit log list with actor/method filters
**Result:** Prototype activity-list layout on the real `admin/audit-logs/`: KPIs computed from the loaded rows (events
today, distinct actors today, failed requests = status ≥ 400, events loaded; the prototype's "Failed Logins"/"System
Alerts" have no source), server-side actor/method filters plus a client-side module filter. Module comes from the path's
first segment and the action label from the method or the action suffix (`/certify/` → Certified, `/login/` → Logged
In, ...), so every label is derived, not stored. "Export Logs" writes the filtered rows to XLSX via `exportXlsx`
(headless download verified: real XLSX). No mock.
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
