# Mock data registry

Every section that shows prototype mock data (because rmis-backend has no endpoint for it yet) gets one row here.
Mocked sections have no visible badge, so this file is the only record of what is fake.

When rmis-backend adds an endpoint for a row: switch that section to the real API call, delete the mock export if nothing
else uses it, and delete the row. The trigger phrase is "read mo yung changes sa rmis-backend" (see `tasks/plan.md`).

| Page | Section | Mock file / export | Waiting for endpoint |
|---|---|---|---|
| All pages (Topbar) | Notification bell dropdown | `src/mocks/notifications.ts` / `NOTIFICATIONS` | `GET /api/risk/alerts/` (rmis-backend P15, role-banded alert inbox, Q7) |
| Work Plan (`/work-plan`) | Version History tab (only shown once a project has activities) | `src/mocks/workPlan.ts` / `WORK_PLAN_VERSIONS` | Work-plan versioning (none in rmis-backend; milestones have no revision history) |
| Documents (`/documents`) | Document detail → Sharing tab (read-only list, no share action) | `src/mocks/documents.ts` / `DOCUMENT_SHARES` | Per-document sharing with expiry (rmis-backend P14, client Q8) |
| Reports (`/reports`) | Scheduled Reports tab (read-only list, no create/run action) | `src/mocks/reports.ts` / `SCHEDULED_REPORTS` | Scheduled report generation (Alignment doc Module 14; none in rmis-backend) |
| User & Access Management (`/admin/users`) | User detail → Temporary Replacement card (read-only, shown only for a suspended account) | `src/mocks/users.ts` / `TEMPORARY_REPLACEMENTS` | Temporary replacement while suspended (rmis-backend P13, client Q3) |
| System Settings (`/admin/settings`) | System Information card (read-only) | `src/mocks/settings.ts` / `SYSTEM_INFO` | System settings / config endpoint (none in rmis-backend) |
