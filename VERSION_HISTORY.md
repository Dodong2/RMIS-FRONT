# RMIS Version History

**Latest version: 2026.11.03.2235**

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

### 2026.11.03.2235

- **Date and time:** 2026-11-03 22:35 (Asia/Manila)
- **Category:** Feature, frontend, backend
- **Summary:** In Register Approved Project, the 6Ps "Particulars" and the Target Beneficiaries "Description" are now optional. A row can be saved, submitted or kept in a draft without them, through Manual Entry, Edit Registration and Upload via Excel. The 6P Item, Quantity, beneficiary Group and Total are still required. A 6P row without Particulars used to be dropped silently; it is now saved.
- **Affected modules:** Project Registration (6Ps and Target Beneficiaries)
- **Notes:** Client Task 29-B, backend rmis-backend e950487. No migration. Existing records are unchanged.

### 2026.11.03.2222

- **Date and time:** 2026-11-03 22:22 (Asia/Manila)
- **Category:** Backend, template format
- **Summary:** The Work Plan Excel template (Register Approved Project → Step 3 → Download Work Plan Excel Template) now formats Start Date and End Date as YYYY-MM-DD (e.g. 2026-11-02). Its header says so too.
- **Affected modules:** Project Registration (Step 3 Work Plan template)
- **Notes:** Client Task 29-C, backend rmis-backend 2907b72. The upload still accepts the same dates as before. The full registration template and the LIB template are unchanged.

### 2026.11.03.2218

- **Date and time:** 2026-11-03 22:18 (Asia/Manila)
- **Category:** UI, frontend, feature removal
- **Summary:** Removed "+ Prepare New LIB" from Budget Management, and the "+ Prepare LIB" button shown on a project with no LIB, which opened the same old LIB wizard. A project without a LIB now says the LIB is prepared in Register Approved Project → Step 4: Budget (LIB).
- **Affected modules:** Budget Management (Project Leader)
- **Notes:** Client Task 31. Existing LIBs, Update This LIB, realignment and the other roles are unchanged. The backend create endpoint was not changed.

### 2026.11.03.2214

- **Date and time:** 2026-11-03 22:14 (Asia/Manila)
- **Category:** UI, frontend, bug fix
- **Summary:** New Procurement Request: when a LIB item is selected, the item's Specification from the registered LIB is shown under "Link to LIB Item". If the LIB has none, the modal says "No specification in the LIB".
- **Affected modules:** Procurement (New Procurement Request, Project Leader)
- **Notes:** Client Task 37. Display only. The specification comes from the saved LIB line item, whether entered by Manual Entry or Upload via Excel. Budget checks and the request payload are unchanged.

### 2026.11.03.2210

- **Date and time:** 2026-11-03 22:10 (Asia/Manila)
- **Category:** Feature, UI, frontend
- **Summary:** The Procurement Requests table has a new Payment Status column, shown to the Procurement Officer - LIB and the System Admin. It reads Paid once Finance/Accounting/Budget has confirmed the payment, and Awaiting Payment otherwise, whether or not the request is Completed. It is separate from the procurement Status column and is read-only.
- **Affected modules:** Procurement (Procurement Requests)
- **Notes:** Client Task 36. Reads the existing payment_status from the API (Task 23); no backend change. Updates through the existing procurement real-time event when Finance marks a request paid.

### 2026.11.03.2206

- **Date and time:** 2026-11-03 22:06 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** The role options on Request Access and on One More Step (Google sign-up) now appear in the client's order: VP for REI, University Administration, CRC/CRD, RIUH, Finance/Accounting/Budget, Procurement Officer - LIB, Project Leader/Program Leader/Study Leader, Project Staff. System Admin still can't be requested.
- **Affected modules:** User registration (Request Access, Google sign-up)
- **Notes:** Client Task 35. Display order only. Role codes, labels, permissions and approval are unchanged.

### 2026.11.03.2201

- **Date and time:** 2026-11-03 22:01 (Asia/Manila)
- **Category:** Backend, monitoring
- **Summary:** Every e-mail that Brevo accepts is now written to the backend logs with the recipient, subject and Brevo messageId. Failures are still logged as errors. The hourly scheduled-reminder job logs the time it started, followed by its existing sent/failed counts.
- **Affected modules:** E-mail notifications (task assignment, registration, LIB, procurement, reminders), scheduled reminders
- **Notes:** Client Task 34, backend rmis-backend faea3ff. "Accepted by Brevo" does not mean delivered. Use the messageId to look the e-mail up in Brevo's Transactional logs.

### 2026.11.03.2155

- **Date and time:** 2026-11-03 21:55 (Asia/Manila)
- **Category:** Feature, UI, frontend
- **Summary:** Software versioning. The version is shown on the login page (bottom left) and in the sidebar (under "Research Mgmt. IS"). This version history was added.
- **Affected modules:** Login and authentication pages, sidebar (all roles)
- **Notes:** Client Task 30. Earlier changes were not versioned.
