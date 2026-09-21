# RMIS Frontend — Current Status

## Module we're on
Module 3: Personnel, Roles, and Task Coordination

## Frontend status (this repo)
- Module 1 (Auth/RBAC pages): done, stable.
- Module 2 (Programs/Projects/Studies/Milestones pages): done, stable.
- Module 3 pages: [update — e.g. "not started, waiting on backend endpoints"]

## Backend endpoints available to consume right now
[Paste or summarize from rmis-backend's HANDOVER.md each time you start a
frontend session for a new module. Example:
- GET/POST /api/personnel/staff-levels/
- GET/POST /api/personnel/tasks/?assignee=<id>]

## Design pattern to follow
Same as ProjectsPage/ProjectDetailPage: AppShell + ProtectedRoute + PageHeader
+ FormAlert + EmptyState + TableSkeletonRows, gate write-forms behind a
canRegister-style role check computed from useAuth().

## Last thing done in this repo
[One line]

## Next thing to do in this repo
[One line]