# TanStack Query migration: tasks

Per-task verification: `npx tsc -b`, eslint on touched files, `npm run build`. Carl browser-tests at each checkpoint.

## Phase 1: Foundation

### T1: Safe QueryClient defaults + clear cache on login/logout (S)
- [x] `retry: false`, `refetchOnWindowFocus: false`, short `staleTime`
- [x] `queryClient.clear()` on login, Google login and logout
- [x] No change in the network tab, since nothing uses queries yet
Files: `src/providers/AppProviders.tsx`, `src/context/AuthContext.tsx`. Depends on: none.
**Result:** `staleTime` 30s. `tsc -b` and build are clean. The 3 eslint errors in `AuthContext.tsx` (set-state-in-effect,
no-empty, only-export-components) were already there before T1 and are left alone.

### T2: Query key factory + shared read hooks (S)
- [ ] `src/lib/queries.ts` with `queryKeys` and `useProjects`, `useBudgets`, `useRoles`, `useUsers`
- [ ] Hooks only wrap the existing `*Api` functions; no page changes
Files: `src/lib/queries.ts`. Depends on: T1.

### T3: Pilot: ProjectsPage (S)
- [ ] `useProjects` + `useQueries` for the per-project statuses
- [ ] Same skeleton, empty state and error toast as before
- [ ] Coming back to the page uses the cache, with no full reload of every status
Files: `src/pages/ProjectsPage.tsx`. Depends on: T2.

### Checkpoint A
- [ ] Build + lint clean
- [ ] Carl: log out, then log in as another role, and confirm no stale data; Projects page behaves the same

## Phase 2: Shared reads

### T4: getProjects/getBudgets consumers, batch 1 (M)
- [ ] ~4 pages switch to `useProjects`/`useBudgets`, with the same states and toasts
Depends on: T3.

### T5: getProjects/getBudgets consumers, batch 2 (M)
- [ ] The remaining consumers
Depends on: T4.

### T6: Roles and users (S)
- [ ] RegisterPage, GoogleChooseRolePage and admin pages use `useRoles`/`useUsers`; role-gated reads use `enabled`
Depends on: T2.

### Checkpoint B
- [ ] Build + lint clean; Carl browser check of the touched pages

## Phase 3: Mutations (replace `reloadKey`), one page per task

### T7: Budget + Disbursements (M)
### T8: Documents (M)
### T9: Staff + Personnel Changes (M)
### T10: Tasks (M/L, most complex, last)
For each task:
- [ ] Saves use `useMutation` + `invalidateQueries`; `reloadKey` is removed from the page
- [ ] Success/error toasts unchanged; the list refreshes after create/update

### Checkpoint C
- [ ] Create → list refresh works on every migrated page; Carl sign-off

## Phase 4 (optional)
- [ ] Remaining pages, migrated only when they're touched for other work
- [ ] Topbar alerts `refetchInterval`, if the client wants it
