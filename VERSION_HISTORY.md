# RMIS Version History

**Latest version: 2026.11.05.2044**

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

### 2026.11.05.2044

- **Date and time:** 2026-11-05 20:44 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** Budget Management → Open LIB no longer shows Mark for checking (CRC/CRD), Start Certification or Certify LIB (Finance/Accounting/Budget). These steps are done only in Project Management → Open Review. Put on Hold stays on Open LIB, and the Project Leader's Submit/Resubmit buttons are unchanged.
- **Affected modules:** Budget Management → Open LIB
- **Notes:** Client Tasks 42-B and 43-A. Open Review buttons, the LIB workflow rules, permissions, audit trail and the backend are unchanged.

### 2026.11.03.2354

- **Date and time:** 2026-11-03 23:54 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** Finance/Accounting/Budget → Open Review → Update This LIB now shows the LIB in the same table as Register Approved Project → Step 4: Budget (LIB), in a modal that fills about 95% of the screen width and 92% of its height. Specification, Unit, Qty, Unit Cost and every year/quarter amount are edited in the table. A changed item turns yellow and asks for its reason under the item name. A period-total warning appears next to an item whose periods don't add up. The title, Grand Total, errors and Exit/Save stay visible while the table scrolls.
- **Affected modules:** Project Management → Open Review (Finance/Accounting/Budget)
- **Notes:** Client Task 32. Layout only: the update rules (existing items only, no add or remove, a reason per change, all-or-nothing save, audit history, notifications, Project Leader Attention) and the backend are unchanged. A modal was kept instead of a separate tab.

### 2026.11.03.2346

- **Date and time:** 2026-11-03 23:46 (Asia/Manila)
- **Category:** Bug fix, UI, frontend
- **Summary:** In the new Line Items table, an item that Finance/Accounting/Budget changed is highlighted in yellow again for its Project Leader, as before the table change.
- **Affected modules:** Budget Management (Line Items tab, Project Leader)
- **Notes:** Client Task 33 follow-up. Restores the Task 20 highlight. Step 4 is unchanged.

### 2026.11.03.2342

- **Date and time:** 2026-11-03 23:42 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** Budget Management → open a LIB → Line Items now uses the same table as Register Approved Project → Step 4: Budget (LIB). It groups items under PS, MOOE and CO with Item, Specification, Unit, Qty, Unit Cost and Total, and has the allocation per year and quarter, Allocated / Total, and subtotals. Read-only. Next to each item it shows the period total ≠ Total warning when the saved periods don't add up, the Attention icon for the Project Leader, and the APP, Counterpart and justification notes. A Draft LIB keeps its Remove and Add item actions.
- **Affected modules:** Budget Management (Line Items tab, all roles that open a LIB)
- **Notes:** Client Task 33. Values come from the saved LIB. Calculations, the backend and the other tabs are unchanged. Step 4 itself is unchanged.

### 2026.11.03.2333

- **Date and time:** 2026-11-03 23:33 (Asia/Manila)
- **Category:** Permissions, frontend, backend
- **Summary:** CRC/CRD can now only view projects, the Work Plan and Personnel & Tasks, for auditing. They can no longer edit a registered project or change its status, add or edit Work Plan activities, create, edit, assign or review tasks, or change staff profiles, assignments or personnel changes. The buttons are hidden and the server refuses the actions. CRC/CRD still cannot register projects. The Project Leader → CRC/CRD → Finance/Accounting/Budget review of submitted proposals is unchanged.
- **Affected modules:** Project Management, Work Plan, Personnel & Tasks, Personnel Changes (CRC/CRD role)
- **Notes:** Client Task 41, backend rmis-backend 5a77e8f. Needs migration accounts 0031 (run by Carl). CRC/CRD now sees task changes after a page refresh instead of live.

### 2026.11.03.2305

- **Date and time:** 2026-11-03 23:05 (Asia/Manila)
- **Category:** Feature, UI, frontend
- **Summary:** Register Approved Project → Step 1 → III. Objectives uses the formatting editor (Tiptap) as a numbered list, one item per objective. It supports bold, italic, underline, sub-bullets, spacing and pasting from Word. The Research Proposal Form preview and the project page show the formatting. The SF-017 midterm rows, Quarterly Reports and the PDF still list one objective per item as plain text. Older objectives, saved drafts and Excel uploads open as a numbered list.
- **Affected modules:** Project Registration (Step 1 Objectives, Edit Registration, preview), Project page, Monitoring & Evaluation (SF-017 rows)
- **Notes:** Client Task 29-A, part 2 (backend in 2026.11.03.2257). No migration.

### 2026.11.03.2257

- **Date and time:** 2026-11-03 22:57 (Asia/Manila)
- **Category:** Backend
- **Summary:** The backend can now accept III. Objectives as formatted text (a numbered list) and cleans it like the other formatted proposal sections. Reports and forms that list objectives one by one (SF-017 midterm, Appendix F, Research Proposal Form PDF, Quarterly Reports) read both the new list and the older "1. … 2. …" text. Nothing changes on screen until the frontend editor (Task 29-A2).
- **Affected modules:** Project Registration (Objectives), Monitoring & Evaluation reports, Reports
- **Notes:** Client Task 29-A, part 1, backend rmis-backend bb299fa. No migration. Existing objectives are read exactly as before.

### 2026.11.03.2246

- **Date and time:** 2026-11-03 22:46 (Asia/Manila)
- **Category:** Bug fix, frontend
- **Summary:** The Work Plan project cards now show the current "x/N done" and completion %. The cards used to keep the data loaded when the page first opened, so an activity completed afterwards still showed as 0/15 and 0%. The cards now reload when you return to the project list, and when a task changes while the list is open.
- **Affected modules:** Work Plan (project cards)
- **Notes:** Client Task 40. Uses the same calculation as the project's Work Plan view (completed activities / all activities, rounded, e.g. 1/15 = 7%). No backend change.

### 2026.11.03.2240

- **Date and time:** 2026-11-03 22:40 (Asia/Manila)
- **Category:** Feature, frontend, backend
- **Summary:** On Request Access and One More Step (Google sign-up), College Unit is disabled and not required when the requested role is VP for REI, University Administration or CRC/CRD, and no College Unit is saved for them. RIUH, Finance/Accounting/Budget, Procurement Officer - LIB, Project Leader and Project Staff must still choose one.
- **Affected modules:** User registration
- **Notes:** Client Task 39, backend rmis-backend 1eb5c8c. Project registration's College Unit/Implementing Unit, profile edits and admin edits are unchanged. No migration.

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
