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
- shadcn components live under `@/components/ui/` (the root `@/` folder, not `src/`). Code under `src/` imports `src/` modules with relative paths.
- `src/mocks/<domain>.ts` — prototype mock data for sections that have no backend endpoint yet. Every mocked section gets a row in `src/mocks/REGISTRY.md`.

## Styling (prototype UI clone, decided 2026-09-24, supersedes the 2026-09-22 "design-system pass only" scope)
- Pages copy the markup of `University Research Operations Website/src/components/<Name>.tsx` nearly verbatim: Tailwind classes + inline `style={{...}}` hex colors. Don't convert them to tokens or shadcn. Strip the prototype's comments.
- shadcn is used only for behavior: Dialog, Select, Tooltip, and toasts (`notify`), restyled to match. Buttons, cards, tables, badges, and inputs are the prototype's raw elements.
- Data rule per section: the API returns rows → real data. The API returns nothing → `<NoActualData />` (`src/components/common/NoActualData.tsx`). There's no endpoint → a mock from `src/mocks/` with no visible badge, plus a REGISTRY row.
- Real flow, prototype look: when the prototype's flow contradicts the backend (demo logins, fake workflows), keep the real flow.
- Access control stays on our role codes (`RoleGate`, `*_ROLE_CODES`, nav tiers). `src/lib/protoRole.ts` maps a role to the prototype's 9 roles for cosmetic branching only. Never use it for access.
- Custom `fixed inset-0` overlays (the prototype's hand-rolled modals) must render through `createPortal(..., document.body)`. Page wrappers use `animate-fade-in`, and an element with a transform animation becomes the containing block for `fixed` children, so the overlay would only cover the content area. shadcn `Dialog` already portals.
- The prototype folder is gitignored and eslint-ignored. It's a read-only reference, never import from it.
- Type-check with `npx tsc -b` (fixed 2026-09-25; it used to stop at TS5101 without checking).

## Patterns to follow (already established, keep consistent)
- Every page that needs auth wraps content in `<ProtectedRoute>`; every role-gated section uses `<RoleGate allow={[...]}>` or a local `canRegister`-style boolean derived from `user.role?.code`.
- When fetching data some of which is role-restricted on the backend (e.g. admin-only lookups), never bundle a restricted call into the same `Promise.all` as a call every authenticated user should see — a 403 on the restricted call must not break the page for everyone else. Fetch shared data first, then conditionally fetch restricted data only if the current user's role qualifies.
- Forms: plain `useState` per field, no form library. Keep consistent with existing pages (Login, Register, ProjectsPage) rather than introducing react-hook-form etc.
- No code comments in generated code, per earlier project preference — keep this unless told otherwise.

## Known gaps (don't be surprised, ask before "fixing")
- Milestone writes: closed on the backend in rmis-backend `209dac2` (`projects.manage_milestones`). It now includes program/project/study leaders, scoped to their own projects. ProjectDetailPage mirrors this since T7 (`MILESTONE_ROLE_CODES`); an out-of-scope write surfaces the backend's 400 message as a toast.
- `AdminUser` (has `id`) and `User` (has `pk`) are deliberately different types — the former matches `/api/admin/*` responses, the latter matches dj-rest-auth's `/api/auth/user/`. Don't merge them.

## Session start
Before trusting HANDOVER.md or your own memory as current, run `git log -8 --oneline` and `git status`. If there are commits or uncommitted changes you don't recognize (likely made manually, outside a Claude session), read the diff (`git show <hash>` or `git diff`) to catch up before doing anything else. Don't assume the last thing you remember is still the latest state.