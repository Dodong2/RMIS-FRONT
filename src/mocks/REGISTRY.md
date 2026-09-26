# Mock data registry

Every section that shows prototype mock data (because rmis-backend has no endpoint for it yet) gets one row here.
Mocked sections have no visible badge, so this file is the only record of what is fake.

When rmis-backend adds an endpoint for a row: switch that section to the real API call, delete the mock export if nothing
else uses it, and delete the row. The trigger phrase is "read mo yung changes sa rmis-backend" (see `tasks/plan.md`).

No mocked sections are left.

Removed before the first deploy (2026-09-26) while the client decides whether to build them. They had no backend
endpoint, so each one was mocked data. To bring one back, restore it from commit `1379772` and re-add its row here:

| Page | Removed section | Was mocked from |
|---|---|---|
| Work Plan (`/work-plan`) | Version History tab | `src/mocks/workPlan.ts` / `WORK_PLAN_VERSIONS` |
| Reports (`/reports`) | Scheduled Reports tab | `src/mocks/reports.ts` / `SCHEDULED_REPORTS` |
| System Settings (`/admin/settings`) | System Information card | `src/mocks/settings.ts` / `SYSTEM_INFO` |
