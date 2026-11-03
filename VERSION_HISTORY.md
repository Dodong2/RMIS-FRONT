# RMIS Version History

**Latest version: 2026.11.03.2155**

## How versioning works

- Format: `YEAR.MONTH.DAY.TIME` (24-hour `HHMM`), always in Philippine time (Asia/Manila). Example: `2026.11.02.1138`.
- The one authoritative value is `APP_VERSION` in `src/version.ts`. The login page (bottom left) and the sidebar (under "Research Mgmt. IS") read it, so they always show the same version.
- Every software change gets a new version: features, bug fixes, UI-only and styling changes, frontend and backend changes alike. Backend-only changes (rmis-backend) are recorded here too, because this file and `src/version.ts` are the single version source for the whole system.
- For each change, in the same commit:
  1. Set `APP_VERSION` in `src/version.ts` to the date and time of the change (`TZ=Asia/Manila date +%Y.%m.%d.%H%M`).
  2. Update **Latest version** above.
  3. Add a new entry at the top of **Versions**. Never edit or delete an older entry.
- No version bump for generated files, temporary files, or docs-only changes (handover notes, this file's wording).
- A backend-only change is shown on the site only after the frontend is redeployed with the new version.

## Versions

### 2026.11.03.2155

- **Date and time:** 2026-11-03 21:55 (Asia/Manila)
- **Category:** Feature, UI, frontend
- **Summary:** Software versioning. The version is shown on the login page (bottom left) and in the sidebar (under "Research Mgmt. IS"). This version history was added.
- **Affected modules:** Login and authentication pages, sidebar (all roles)
- **Notes:** Client Task 30. Earlier changes were not versioned.
