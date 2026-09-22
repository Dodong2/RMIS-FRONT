# RMIS Frontend — Current Status

## Module we're on
Module 4: Line-Item Budget Management

## Frontend status (this repo)
- Module 1 (Auth/RBAC pages): done, stable.
- Module 2 (Programs/Projects/Studies/Milestones pages): done, stable.
- Module 3 (Personnel/Roles/Task Coordination pages): done, stable.
- Module 4 (Budget pages): BudgetPage built against budget_lib (project selector, line
  items, add-item form, certify) — untested end-to-end since the backend app
  (rmis-backend commit 7a4061a) hasn't been migrated/run yet on that side.

## Backend endpoints available to consume right now
From rmis-backend's budget_lib (not yet migrated/tested against a running server):
- GET/POST /api/budget/budgets/?project=<id> — list/create line-item budget versions
- GET /api/budget/budgets/<id>/
- POST /api/budget/budgets/<id>/certify/ — finance_budget/system_admin only
- GET/POST /api/budget/line-items/?budget=<id>
- GET/PATCH/DELETE /api/budget/line-items/<id>/

## Design pattern to follow
Same as ProjectsPage/ProjectDetailPage: AppShell + ProtectedRoute + PageHeader
+ EmptyState + TableSkeletonRows + notify toasts, gate write-forms behind a
canManage-style role check computed from useAuth() (here: system_admin,
finance_budget — matches backend's MANAGE_ROLES/CERTIFY_ROLES).

## Last thing done in this repo
Added src/types/budget.ts, src/lib/budgetApi.ts, src/pages/BudgetPage.tsx,
wired /budget route in App.tsx (RoleGate), flipped nav.ts "Budget" item to ready: true.

## Next thing to do in this repo
Once rmis-backend runs `manage.py migrate` and budget_lib is smoke-tested there,
verify BudgetPage against a real project (create budget → add line items →
hit the institutional/dry-research ₱100k cap → certify).
