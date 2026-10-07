# TanStack Query migration: tasks

Per-task verification: `npx tsc -b`, eslint on touched files, `npm run build`. Carl browser-tests at each checkpoint.

## Phase 1: Foundation

### T1: Safe QueryClient defaults + clear cache on login/logout (S)
- [x] `retry: false`, `refetchOnWindowFocus: false`, short `staleTime`
- [x] `queryClient.clear()` on login, Google login and logout
- [x] No change in the network tab, since nothing uses queries yet
Files: `src/providers/AppProviders.tsx`, `src/context/AuthContext.tsx`. Depends on: none.
**Result:** `staleTime` was 30s, then set back to the default 0 in T3 (see plan: a stale list after a save in an
unmigrated page). `tsc -b` and build are clean. The 3 eslint errors in `AuthContext.tsx` (set-state-in-effect,
no-empty, only-export-components) were already there before T1 and are left alone.

### T2: Query key factory + shared read hooks (S)
- [x] `src/lib/queries.ts` with `queryKeys` and `useProjects`, `useBudgets`, `useRoles`, `useUsers`
- [x] Hooks only wrap the existing `*Api` functions; no page changes
Files: `src/lib/queries.ts`. Depends on: T1.
**Result:** v5 `queryOptions` objects (`projectsQuery`, `budgetsQuery(project)`, ...) shared by hooks, `useQueries` and
invalidation. `queryKeys.budgets()` = `["budgets"]`, so invalidating it also refreshes every per-project budget
list. Hooks take `{ enabled }` for role-gated reads.

### T3: Pilot: ProjectsPage (S)
- [x] `useProjects` + `useQueries` for the per-project statuses
- [x] Same skeleton, empty state and error toast as before
- [x] Coming back to the page shows the cached list and statuses at once, then refetches in the background
Files: `src/pages/ProjectsPage.tsx`. Depends on: T2.
**Result:** milestones, assignments and monitoring status also moved to `queries.ts`. Status `undefined` = loading
("…"), `null` = failed ("—"), same as before. The error toast fires from an effect on `isError`.

### Checkpoint A
- [ ] Build + lint clean
- [ ] Carl: log out, then log in as another role, and confirm no stale data; Projects page behaves the same

## Phase 2: Shared reads

### T4: getProjects consumers, batch 1 (M)
- [x] ~4 pages switch to `useProjects`, with the same states and toasts
Depends on: T3.
**Result:** TasksPage (project list), StaffPage, PersonnelChangesPage and DecisionSupportPage. Only the projects call
moved; each page's other calls stay in their effect. Skeletons wait for both, and a projects failure shows the page's
same toast (two identical toasts if both calls fail). PersonnelChanges invalidates `projects` after a save, because an
approved lead change alters `lead_detail`.

### T5: getProjects/getBudgets consumers, batch 2 (M)
- [x] DashboardPage, BudgetPage, ProcurementPage, DisbursementsPage (projects + budgets). The last three use `reloadKey`,
  so their budget refresh must invalidate `budgets`.
Depends on: T4.
**Result:** a `reload()` on Budget, Disbursements and Procurement invalidates `projects` + `budgets()` (and still bumps
`reloadKey` for the page's own records), so a save refreshes the same data as before. Budget and Disbursements keep
`projects === null` until everything has loaded. Each page fires one error toast, the same text as before. Dashboard
merges the two queries into `data` (`undefined` loading, `null` failed, same as `settle`).


### T6: Roles and users (S)
- [x] RegisterPage, GoogleChooseRolePage and admin pages use `useRoles`/`useUsers`; role-gated reads use `enabled`
Depends on: T2.
**Result:** RegisterPage, GoogleChooseRolePage, SettingsPage, AuditLogsPage (actor filter) and DecisionSupportPage
(users, `enabled` for system_admin only). Same loading states and toast text. UsersListPage, PendingUsersPage and the
Dashboard Accounts card are left for Phase 3, because they change the users/pending lists locally after each action.

### Checkpoint B
- [ ] Build + lint clean; Carl browser check of the touched pages

## Phase 3: Mutations (replace `reloadKey`), one page per task

### T7: Budget + Disbursements (M) ✅
**Result:** neither page has `reloadKey`/`onChanged` now. The LIB detail reads `useBudgets(project)` + `budgetSummaryQuery`.
Its `run()` is a `useMutation`, so `busy` = `isPending`. The Disbursements board reads budgets, `financialRecordsQuery(budget)`
(disbursements + realignments), the summary and current documents. Realignment review is a `useMutation`. A save
invalidates `financial`, `budgets`, `budget-summary` and `projects`, so the outer lists refresh too. Record/Realign
modals keep their own submit code and call the same invalidation through `onSaved`. Keys: the all-records list is
`["financial","all"]`, separate from a per-budget `["financial",id]`.
### T8: Documents (M) ✅
**Result:** no `reloadKey` now. The list reads `documentsQuery({current_only})`, `useProjects` and active assignments (for
names). Approve/return/archive (`act`), share grant and revoke are `useMutation`. Uploads and detail changes
invalidate the `["documents"]` prefix, which also refreshes the Disbursements board's documents. Sharing keeps the
403 → "forbidden" message. Toggling "Show superseded" still shows the skeleton, as before (new key, no placeholder).
The Versions/Linked tabs keep their lazy per-modal effects.
### T9: Staff + Personnel Changes (M) ✅
**Result:** neither page has `reloadKey` now. Staff reads staff profiles, all assignments, collaboration (keeps the old list
while switching "cross only", as before) and `users-by-role` (managers only) from queries. Personnel Changes reads
changes, programs, active assignments and role candidates (keeps the old list while switching type, as before). Create,
level, assign, clearance and complete are `useMutation`. Local in-place updates (end assignment, change level, edit
department, clearance) now use `setQueryData`. Completing a change invalidates assignments + projects, since the
leader or staff changed. Study lookups on project pick stay one-shot calls.
### T10: Tasks (M/L, most complex, last)
For each task:
- [ ] Saves use `useMutation` + `invalidateQueries`; `reloadKey` is removed from the page
- [ ] Success/error toasts unchanged; the list refreshes after create/update

### Checkpoint C
- [ ] Create → list refresh works on every migrated page; Carl sign-off

## Phase 4 (optional)
- [ ] Remaining pages, migrated only when they're touched for other work
- [ ] Topbar alerts `refetchInterval`, if the client wants it
