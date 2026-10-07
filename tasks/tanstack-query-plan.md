# Implementation Plan: TanStack Query for server state

## Overview
Move page data fetching from hand-rolled `useEffect` + `useState` + `let active = true` (78 places) and `reloadKey`
refetch counters (17 files) to TanStack Query, one page at a time, with no visible behavior change. The goals are
fewer duplicate requests (the project list is fetched by 8 files and budgets by 6) and correct refreshes after a save.

## Audit (2026-10-07)
- `@tanstack/react-query` v5 is installed and `QueryClientProvider` is mounted in `src/providers/AppProviders.tsx`
  with default options. No `useQuery`/`useMutation` exists yet.
- Layers: `apiClient.ts` (axios, JWT, refresh-token queue) → `src/lib/<domain>Api.ts` (typed, returns `data`) →
  pages. The API modules stay unchanged and become the `queryFn`s.
- Page states today: `null` = loading (skeleton), `[]` = empty (`<NoActualData />`), failure = `notify.error` toast.
- Most repeated reads: `researchApi.getProjects` (8), `budgetApi.getBudgets` (6), `authApi.getRoles`/`getUsers`/
  `getPendingUsers` (3 each).
- ProjectsPage fetches `getProjectStatus` once per project (N+1). Caching softens it; fixing it is a backend change and
  out of scope.

## Architecture Decisions
- QueryClient defaults keep today's behavior: `retry: false` (no slow, repeated 403/404s), `refetchOnWindowFocus: false`
  (no new requests), and `staleTime: 0`. Every mount still refetches like today, but cached data shows at once. A
  longer `staleTime` is only safe for a key once every page that writes it invalidates it (Phase 3); otherwise a
  project created in one page would be missing from another page's list.
- The cache is cleared on login and logout so one account never sees another account's role-scoped data.
- One file, `src/lib/queries.ts`, holds the query key factory and thin hooks (`useProjects`, `useBudgets`, ...) that
  call the existing `*Api` functions. Split it per domain only if it grows too large.
- Role-restricted reads use `enabled: <role check>`, which keeps the CLAUDE.md rule that a 403 must not break the page.
- `data === undefined` → skeleton, `[]` → `NoActualData`, error → the same `notify.error` text as before.
- Saves use `useMutation` + `invalidateQueries` on the affected keys instead of `reloadKey`.
- Not migrated: the `AuthContext` user, file downloads (report blobs, Excel template) and one-shot form submits
  (login, register, RegisterProject wizard).

## Task List
See `tasks/tanstack-query-todo.md`.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Cached data from the previous account after switching users | High | `queryClient.clear()` on login and logout (T1) |
| TanStack defaults change behavior (retries, focus refetch) | Med | Conservative defaults in T1 |
| Wrong invalidation key leaves a list stale after a save | Med | Key factory in one file; browser check at each checkpoint |
| Large pages (Tasks, Documents) regress | Med | Migrate them last, one page per task |
| No frontend test suite | Med | `tsc -b` + eslint + build per task; Carl browser-tests at each checkpoint |

## Open Questions
- Should the Topbar alerts auto-refresh (`refetchInterval`)? It needs a client decision, so it's optional in Phase 4.
