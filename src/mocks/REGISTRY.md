# Mock data registry

Every section that shows prototype mock data (because rmis-backend has no endpoint for it yet) gets one row here.
Mocked sections have no visible badge, so this file is the only record of what is fake.

When rmis-backend adds an endpoint for a row: switch that section to the real API call, delete the mock export if nothing
else uses it, and delete the row. The trigger phrase is "read mo yung changes sa rmis-backend" (see `tasks/plan.md`).

| Page | Section | Mock file / export | Waiting for endpoint |
|---|---|---|---|
| Work Plan (`/work-plan`) | Version History tab (only shown once a project has activities) | `src/mocks/workPlan.ts` / `WORK_PLAN_VERSIONS` | Work-plan versioning (none in rmis-backend; milestones have no revision history) |
| Reports (`/reports`) | Scheduled Reports tab (read-only list, no create/run action) | `src/mocks/reports.ts` / `SCHEDULED_REPORTS` | Scheduled report generation (Alignment doc Module 14; none in rmis-backend) |
| System Settings (`/admin/settings`) | System Information card (read-only) | `src/mocks/settings.ts` / `SYSTEM_INFO` | System settings / config endpoint (none in rmis-backend) |
