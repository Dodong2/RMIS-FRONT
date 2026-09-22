# RMIS Frontend (React + Vite + TypeScript + shadcn/ui)

## Stack
Vite + React + TypeScript + react-router-dom + TanStack Query (installed, not yet used everywhere) + shadcn/ui + Tailwind. NOT Next.js — never suggest `next/navigation`, `next/link`, or App Router patterns.

## Run
```
npm run dev
```
Backend API base URL comes from `VITE_API_URL` in `.env.local` (Vite env vars need the `VITE_` prefix and are read via `import.meta.env`, not `process.env`).

## Folder conventions
- `src/pages/` — one file per route. Admin-only pages live in `src/pages/admin/`. Follow this pattern for other role-scoped pages too (e.g. `src/pages/dean/`) as they're built.
- `src/lib/<domain>Api.ts` — one API module per backend app (`authApi.ts`, `researchApi.ts`, ...). Never call `apiClient` directly from a page component.
- `src/types/<domain>.ts` — mirrors the backend serializer fields exactly. If a backend serializer changes, update the matching type file in the same turn.
- shadcn components live under `@/components/ui/` — import from there, don't recreate a Button/Select/etc.

## Patterns to follow (already established, keep consistent)
- Every page that needs auth wraps content in `<ProtectedRoute>`; every role-gated section uses `<RoleGate allow={[...]}>` or a local `canRegister`-style boolean derived from `user.role?.code`.
- When fetching data some of which is role-restricted on the backend (e.g. admin-only lookups), never bundle a restricted call into the same `Promise.all` as a call every authenticated user should see — a 403 on the restricted call must not break the page for everyone else. Fetch shared data first, then conditionally fetch restricted data only if the current user's role qualifies.
- Forms: plain `useState` per field, no form library. Keep consistent with existing pages (Login, Register, ProjectsPage) rather than introducing react-hook-form etc.
- No code comments in generated code, per earlier project preference — keep this unless told otherwise.

## Known gaps (don't be surprised, ask before "fixing")
- Milestone status updates are currently restricted to `system_admin`/`crc_chair` only (matches backend permission). Project/Study leads can't yet update their own milestones — this is a known, not-yet-prioritized gap.
- `AdminUser` (has `id`) and `User` (has `pk`) are deliberately different types — the former matches `/api/admin/*` responses, the latter matches dj-rest-auth's `/api/auth/user/`. Don't merge them.

## Session start
Before trusting HANDOVER.md or your own memory as current, run `git log -8 --oneline` and `git status`. If there are commits or uncommitted changes you don't recognize (likely made manually, outside a Claude session), read the diff (`git show <hash>` or `git diff`) to catch up before doing anything else. Don't assume the last thing you remember is still the latest state.