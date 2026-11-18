# RMIS Version History

**Latest version: 2026.11.18.1707**

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

### 2026.11.18.1707

- **Date and time:** 2026-11-18 17:07 (Asia/Manila)
- **Category:** Security fix
- **Summary:** Backend: a Monthly, Midterm or Terminal progress report can be submitted only for a project in the submitter's scope (Project Leader: projects they lead; Project Staff: projects they're assigned to; RIUH: their campus; System Admin: any), and an attached document must belong to that same project. Otherwise the server refuses it with a message and saves nothing.
- **Affected modules:** Monitoring & Evaluation (Progress Reports API)
- **Notes:** Client Task 83-B, rmis-backend 20e8593. No migration. No change to the page itself.

### 2026.11.18.1658

- **Date and time:** 2026-11-18 16:58 (Asia/Manila)
- **Category:** Bug fix
- **Summary:** Monitoring & Evaluation → Progress Reports: the Submit Monthly Progress, Midterm and Terminal Report forms can now upload the report file directly (PDF, Word or Excel, up to 25MB). The file is saved in the project's Document and Records Management (Monthly as type "Other", Midterm as "Midterm Report", Terminal as "Terminal Report") and attached to the report in one step. Before, the form could only pick a file already uploaded in Document and Records Management, so it looked like uploading was impossible. Picking an existing document still works. A retry after a failed submit reuses the uploaded file. Older reports keep showing their file name after a newer version is uploaded.
- **Affected modules:** Monitoring & Evaluation (Progress Reports: Monthly, Midterm, Terminal)
- **Notes:** Client Task 83-A, frontend only, no backend change, no migration.

### 2026.11.18.1250

- **Date and time:** 2026-11-18 12:50 (Asia/Manila)
- **Category:** Bug fix and access change
- **Summary:** Compliance → Submit Evidence can now upload a supporting document directly (PDF, Word or Excel, up to 25MB); the file is saved in the project's Document and Records Management and attached to the requirement in one step (before, it could only pick a file already uploaded elsewhere). Compliance Tracking (sidebar, page, Analytics Compliance tab, Dashboard compliance figures) is shown only to System Admin, VP for REI and University Administration, and all three can define, submit, review and verify. "Assigned To" lists only those three roles' accounts.
- **Affected modules:** Compliance Tracking (Requirements Tracker, Submit Evidence, Integrity Records), Sidebar, Analytics (Compliance tab), Dashboard (Compliance tile, domain tab, 5a card)
- **Notes:** Client Task 79-B, rmis-backend c666d85 (GET compliance/assignable-users/). Needs the backend of Task 79-A (accounts 0035 migrated) deployed at the same time.

### 2026.11.18.1230

- **Date and time:** 2026-11-18 12:30 (Asia/Manila)
- **Category:** Access change
- **Summary:** Backend: Compliance Tracking (all its records, requirements, reviews, verification and the compliance dashboard figures) is now open only to System Admin, VP for REI and University Administration, and those three can encode, submit, review and verify. RIUH and Project Leader no longer have Compliance. A requirement can only be assigned to one of the three roles.
- **Affected modules:** Compliance Tracking (API), Analytics/Dashboard compliance figures (API)
- **Notes:** Client Task 79-A, rmis-backend 2515e23. Backend only; needs migration accounts 0035. The sidebar and pages follow in Task 79-B.

### 2026.11.18.1211

- **Date and time:** 2026-11-18 12:11 (Asia/Manila)
- **Category:** Bug fix
- **Summary:** Budget Forecasting backtest follows the client's rules: MAE, RMSE and MAPE are computed only with at least 12 months of disbursement history, holding out the latest 3 months in order. A month without a disbursement now counts as ₱0 instead of being skipped. The page says why there are no metrics ("Not backtested: needs at least 12 months … has N"), shows "Backtest failed" with the error when the model fit fails, and shows MAPE "Unavailable" when every holdout month was ₱0.
- **Affected modules:** Budget Forecasting (ARIMA forecast run, MAE/RMSE/MAPE tiles, saved runs list)
- **Notes:** Client Task 78-C, rmis-backend 1180d13. Needs migration forecasting 0002. Old runs keep their figures; they show a note to run a new forecast. Forecast figures of projects with gap months change on the next run (gap months are now 0).

### 2026.11.18.1157

- **Date and time:** 2026-11-18 11:57 (Asia/Manila)
- **Category:** Feature
- **Summary:** Define Decision Indicator (and Edit Weight / Formula) has a Weight (%) — DSS-02 field. The weight is saved into the selected DSS model, the same weights Edit Weights shows; a new indicator is added to that model. The modal shows the model's total after saving; the DSS can run only when the total is exactly 100. Rankings show "Weights changed since this run" when the model's weights differ from the selected run's.
- **Affected modules:** Decision Support System (Define Decision Indicator, Indicators & Weights, model list, Rankings & Scores)
- **Notes:** Client Task 78-A, rmis-backend cd6a7f8 (POST ahp-runs/<id>/indicators/). No migration. Weights are whole % from 1 to 60 (100 when the model has one indicator). Earlier runs keep their own weights.

### 2026.11.18.1146

- **Date and time:** 2026-11-18 11:46 (Asia/Manila)
- **Category:** UI change
- **Summary:** Budget Office Sync is hidden from the sidebar for every role until the client decides how it will be used.
- **Affected modules:** Sidebar (Budget group: Budget Office Sync)
- **Notes:** Client Task 78-B. Sidebar only: the /budget-sync page, its route access and the backend are unchanged, so the direct URL still opens for System Admin, VP for REI, University Administration and Finance. Restore by putting the tiers back in src/lib/nav.ts.

### 2026.11.18.0251

- **Date and time:** 2026-11-18 02:51 (Asia/Manila)
- **Category:** Bug fix
- **Summary:** Custom scoring formulas in Decision Support no longer fail when typed with × ÷ − (they are read as * / -). A symbol that can't be used (e.g. %, =, ^, an apostrophe) is now named in the error instead of the general "not valid arithmetic" message. The formula box shows clickable example formulas and clearer instructions.
- **Affected modules:** Decision Support System (Define Indicator / Edit Formula — Scoring Formula / Method)
- **Notes:** Task 77-A, rmis-backend a3c481d. No migration. Saved formulas are stored with + - * /.

### 2026.11.18.0151

- **Date and time:** 2026-11-18 01:51 (Asia/Manila)
- **Category:** Access change
- **Summary:** The Decision Support System menu item and page are for System Admin, VP for REI, University Administration and CRC/CRD only (Finance loses it, CRC/CRD gains it). Typing /decision-support as another role shows the no-access page. The Analytics "Decision Support" tab and the Dashboard "Funding Allocation Decision" (5d) card are shown to the same four roles only. The Analytics Decision Support tab now shows the weights saved with the run instead of the model's current weights.
- **Affected modules:** Sidebar, Decision Support System, Analytics (Decision Support tab), Dashboard (Objective Dashboards 5d)
- **Notes:** Task 76-F. Matches backend dss.view (Task 76-D, accounts 0034). No migration of its own.

### 2026.11.18.0145

- **Date and time:** 2026-11-18 01:45 (Asia/Manila)
- **Category:** Feature
- **Summary:** Decision Support System follows the Figma DSS screens. Define Indicator (DSS-01) keeps "Measured From" and has an EDIT checkbox beside "Scoring Formula / Method": unchecked shows and uses the standard formula, checked lets you type a custom formula (with clickable variables and the server's error if it is invalid). Each indicator card has "Edit Formula". "Edit Weights — DSS-02" opens the Assign Weights panel (sliders 1-60%, "Sum: X / 100 ✓", Save only at 100). AHP pairwise comparison stays as an option for models without weights. Rankings use the weights saved with each run, and runs made before 2026-11-18 are labelled "Old relative scale".
- **Affected modules:** Decision Support System (Indicators & Weights, model panel, Rankings & Scores, score detail)
- **Notes:** Task 76-E. Needs backend 22123cc..ecdff89 and migrations decision_support 0003-0005 + accounts 0034. Standard formula descriptions now show the 0-100 scale from Task 76-A.

### 2026.11.18.0137

- **Date and time:** 2026-11-18 01:37 (Asia/Manila)
- **Category:** Access change (backend)
- **Summary:** Only System Admin, VP for REI, University Administration and CRC/CRD can read Decision Support System data (indicators, models, runs, scores, sensitivity, decisions, and the Funding Allocation Decision dashboard). Every other role now gets "no permission" from these. Who can define indicators, edit formulas and weights, run the DSS (System Admin, VP for REI) and record decisions (plus University Administration) is unchanged, so CRC/CRD can view only.
- **Affected modules:** Decision Support System; Analytics (Decision Support tab) and Dashboard (Funding Allocation Decision card) for roles outside the four
- **Notes:** Task 76-D, rmis-backend. Needs migration accounts 0034 (Carl runs it, then `python scripts/permission_parity.py` must show 0 differences). Until Task 76-F hides them, Finance still sees the DSS menu item and RIUH/Finance still see the Analytics Decision Support tab, which will show an error.

### 2026.11.18.0133

- **Date and time:** 2026-11-18 01:33 (Asia/Manila)
- **Category:** Feature (backend)
- **Summary:** Decision Support models can get their weights directly (Edit Weights — DSS-02): a whole percent per indicator, each from 1% to 60%, adding up to exactly 100% (a one-indicator model is 100%). Saving makes the model ready to run, with no consistency ratio needed. Models weighted with AHP pairwise comparison still need a consistency ratio of 0.10 or less. Runs made earlier keep the weights they used.
- **Affected modules:** Decision Support System (models, Run DSS)
- **Notes:** Task 76-C, rmis-backend. Needs migration decision_support 0005 (Carl runs it). The Edit Weights panel comes in Task 76-E. Only System Admin and VP for REI can edit weights.

### 2026.11.18.0128

- **Date and time:** 2026-11-18 01:28 (Asia/Manila)
- **Category:** Feature (backend)
- **Summary:** Decision Support indicators can now use a custom scoring formula instead of the standard one. The formula is plain arithmetic (numbers, + - * /, parentheses, min, max) over `score` (the indicator's standard 0-100 score) and the raw values of the seven standard metrics; the result is kept between 0 and 100. Invalid formulas are refused with a message. When Edit is off, the standard formula is used, and a saved custom formula is kept but ignored.
- **Affected modules:** Decision Support System (Define Indicator, Run DSS)
- **Notes:** Task 76-B, rmis-backend (formula.py, PATCH criteria/<id>/). Needs migration decision_support 0004 (Carl runs it). The Edit checkbox in the Define Indicator modal comes in Task 76-E. Dividing by zero counts as 0.

### 2026.11.18.0124

- **Date and time:** 2026-11-18 01:24 (Asia/Manila)
- **Category:** Bug fix (backend)
- **Summary:** Decision Support scores no longer come out as 100 for everyone. Each indicator is now scored on a fixed 0-100 scale from its standard formula (e.g. 0% budget utilization = 0, no ethics review = 50) instead of being compared against the other projects in the run, where a tie gave every project 100. Each new run remembers the weights and formulas it used.
- **Affected modules:** Decision Support System (Run DSS, Rankings & Scores, Sensitivity Analysis)
- **Notes:** Task 76-A, rmis-backend 22123cc. Needs migration decision_support 0003 (Carl runs it). Runs made before this are kept as they were and labelled as using the old relative scale; run the DSS again to get the new scores. Output Volume is scored against the highest output count in the run.

### 2026.11.17.2340

- **Date and time:** 2026-11-17 23:40 (Asia/Manila)
- **Category:** Revert
- **Summary:** Reverted 2026.11.17.2327 (Task 74) at the client's request ("huwag muna galawin realignment"). Request Realignment is clickable again for projects past the 60-day deadline; the server still refuses those requests, and the toast shows its reason (Task 73, kept).
- **Affected modules:** Budget Management (LIB Realignment tab), Procurement, Realignment & Financial Monitoring (project header and Adjustments tab)
- **Notes:** Task 75. Code returns to how it was before Task 74. Backend unchanged. No migration.

### 2026.11.17.2327

- **Date and time:** 2026-11-17 23:27 (Asia/Manila)
- **Category:** UI change
- **Summary:** The Request Realignment button is disabled once a project is past its realignment deadline (60 days before the target end date), with the note "Realignment closed: requests must be filed at least 60 days before the target end date (date)." Past realignments and Finance approvals stay visible.
- **Affected modules:** Budget Management (LIB Realignment tab), Procurement, Realignment & Financial Monitoring (project header and Adjustments tab)
- **Notes:** Task 74. Same rule the server already enforced (unchanged). A project with no target end date stays open. No migration.

### 2026.11.17.2314

- **Date and time:** 2026-11-17 23:14 (Asia/Manila)
- **Category:** Bug fix
- **Summary:** Error toasts now show the server's real reason when a request sends several rows at once (e.g. Request Realignment). Before, the toast only said "Could not submit the realignment." and hid the reason, such as "Realignment requests must be submitted at least 60 days before the project's target end date."
- **Affected modules:** Budget Realignment (Request Realignment), every page that shows a server error toast
- **Notes:** Task 73. Only the error-message reader changed; messages that already showed are unchanged. The realignment rules (incl. the 60-day rule) are unchanged. No migration.

### 2026.11.17.2221

- **Date and time:** 2026-11-17 22:21 (Asia/Manila)
- **Category:** UI change
- **Summary:** Budget Forecast: Average Burn Rate, Linear Trend, Moving Average and % Completion now show their projections as soon as the method is clicked, and update right away when the horizon, anchor or contingency slider moves. The Run Forecast button is shown for ARIMA only ("Run ARIMA Forecast"), since only ARIMA runs on the server and is saved.
- **Affected modules:** Budget Forecasting (Forecast Parameters, Projections & Chart)
- **Notes:** Task 72. The quick-method formulas, the ARIMA run and Saved Forecasts are unchanged. The "Configure parameters and click Run Forecast" message is gone; a project without disbursements still shows "No disbursements recorded". No migration.

### 2026.11.17.2210

- **Date and time:** 2026-11-17 22:10 (Asia/Manila)
- **Category:** UI fix
- **Summary:** Budget Forecast → Saved Forecasts: the project title no longer runs past the card. Each saved run now shows the NTP on top and the full title under it, wrapping inside the card, and "Projected at horizon" stays visible on the right.
- **Affected modules:** Budget Forecasting (Saved Forecasts tab)
- **Notes:** Task 71. Display only; the forecast figures, Load button and backend are unchanged. No migration.

### 2026.11.17.1719

- **Date and time:** 2026-11-17 17:19 (Asia/Manila)
- **Category:** Backend, access fix
- **Summary:** CRC/CRD, Finance/Accounting/Budget, RIUH and Procurement now see only the documents of projects on their own campus (and college, when their account is limited to one), following the campus scope the client set on 2026-10-27. Before, CRC/CRD could open every campus's NTP, Approve Proposal and Research Proposal Form on the Document and Records Management page.
- **Affected modules:** Document and Records Management, Project Review (Supporting Document History)
- **Notes:** Task 70. Current data: CRC/CRD Los Baños 54 → 3 documents, CRC/CRD Siniloan 54 → 51; every other account unchanged. An account without a campus, System Admin, VP for REI, University Administration, Project Leaders and staff are unchanged; a document explicitly shared with a user still opens. No migration.

### 2026.11.17.1714

- **Date and time:** 2026-11-17 17:14 (Asia/Manila)
- **Category:** Backend, performance fix
- **Summary:** The Budget Summary (Approved, Adjusted, Actual, Available per LIB item) loads much faster. It used to ask the database three separate questions for every line item; now it reads the whole LIB in one go. Measured on the shared database: a 17-item LIB 3.7 s → 0.27 s (51 → 3 queries); all 18 LIBs together 33.9 s → 5.3 s.
- **Affected modules:** Budget Management (Budget Summary), Financial Monitoring (Disbursement Ledger, Budget Utilization), Analytics (Budget Forecast "Adjusted Budget")
- **Notes:** Task 68-A2. The figures are unchanged: all 18 LIB summaries were compared byte for byte before and after, and a test with approved, implemented, pending and rejected realignments checks every figure against the old calculation. Spending and realignment checks still read fresh figures under their locks. No migration.

### 2026.11.17.1700

- **Date and time:** 2026-11-17 17:00 (Asia/Manila)
- **Category:** Backend, faster response
- **Summary:** Filing, receiving, returning and completing a procurement request no longer waits for the notification e-mails to be sent. The e-mails go out in the background right after the step is saved, so the success message appears sooner. Measured with a simulated 0.8 s e-mail service: File Request 0.88 s → 0.13 s of waiting, Completed (2 e-mails) 1.68 s → 0.10 s.
- **Affected modules:** Procurement (e-mail notifications)
- **Notes:** Task 68-D. Same e-mails, same recipients, still sent once and only after the step is saved. Known limit: an e-mail still being sent when the server restarts (a deploy) can be lost. No frontend change, no migration.

### 2026.11.17.1651

- **Date and time:** 2026-11-17 16:51 (Asia/Manila)
- **Category:** Backend, access fix
- **Summary:** Finance/Accounting/Budget now sees a project's supporting documents (NTP, Approve Proposal, MOA and other files) in the Supporting Document History of Open Review / View Information, with a working View button, like CRC/CRD. Only for projects on their campus whose LIB has reached them (Ready for Certification, Certifying, Certified), the same projects they can review. The same files also show on their Document and Records Management page.
- **Affected modules:** Budget Management (Project Review modal), Document and Records Management
- **Notes:** Task 69. The Research Proposal Form stays hidden from Finance (client 2026-10-09). No change for Procurement, CRC/CRD or other roles. No frontend change (CRC/CRD and Finance share the same component), no migration.

### 2026.11.17.1642

- **Date and time:** 2026-11-17 16:42 (Asia/Manila)
- **Category:** Frontend, UI fix
- **Summary:** Choosing another project on Budget Forecast now clears the previous project's figures at once. The Current Budget Status shows "…" and the history shows its loading box until the new project's data arrives, and Saved Forecasts starts empty. Before, the old project's budget, utilization and saved runs stayed on screen while the new project loaded. A forecast run that finishes after you switched projects no longer lands in the other project's list.
- **Affected modules:** Analytics (Budget Forecast)
- **Notes:** Task 68-C. Display only: the same data is loaded, the ARIMA calculation and access are unchanged. No backend change, no migration.

### 2026.11.17.1638

- **Date and time:** 2026-11-17 16:38 (Asia/Manila)
- **Category:** Frontend, faster updates
- **Summary:** After File Request, Mark Received, a status change, Resubmit or Confirm Payment, the list now shows the saved request right away, using what the server returned. Before, the screen waited for every list on the page to reload (including all LIBs and projects) before showing the change. A paid request now leaves Awaiting Payment as soon as the server confirms the payment.
- **Affected modules:** Procurement (Procurement Requests, Pending Procurement Requests), Budget Management (Procurement Payments)
- **Notes:** Task 68-B. Nothing is shown before the server confirms the save: a rejected step changes nothing on screen. The lists, KPIs and delayed flags still reload right after to confirm. A procurement action no longer reloads the LIB and project lists (it does not change them). No backend change, no migration.

### 2026.11.17.1620

- **Date and time:** 2026-11-17 16:20 (Asia/Manila)
- **Category:** Backend, performance fix
- **Summary:** The lists that refresh after every procurement and LIB action load much faster. The server used to look up the requester, the reviewers, each line item's edits and each project's current LIB one row at a time (up to 260 database round trips for the LIB list). Now each list reads them in a few queries. Measured on the shared database: LIB list 23.1 s → 1.2 s, procurement requests 5.0 s → 0.4 s, projects 4.8 s → 0.75 s, APP-flagged line items 3.4 s → 0.45 s (Procurement Officer account).
- **Affected modules:** Procurement, Budget Management (LIB list, line items), Project Management (project list), Budget Forecast (saved runs), and every dashboard that reads these lists
- **Notes:** Task 68-A. Responses are unchanged: the same 40 role/endpoint responses were compared byte for byte before and after. No change to any calculation, permission or workflow. The Budget Summary (per line item Approved/Adjusted/Actual/Available) is still slow (~4 s) and is left for a separate task. No migration.

### 2026.11.16.2104

- **Date and time:** 2026-11-16 21:04 (Asia/Manila)
- **Category:** Frontend, UI fix
- **Summary:** The Project dropdown in New Procurement Request and on Budget Forecast is now a searchable list that stays inside its box and scrolls. Each project shows the NTP on top and the title under it in smaller text, and the list can be searched by NTP or title. Before, the long titles stretched the dropdown past the modal.
- **Affected modules:** Procurement (New Procurement Request), Analytics (Budget Forecast)
- **Notes:** Task 67. Display only: the same projects are listed and choosing one resets the same fields as before. The Budget Forecast run badge still reads "Title — NTP". No backend change, no migration.

### 2026.11.16.1155

- **Date and time:** 2026-11-16 11:55 (Asia/Manila)
- **Category:** Frontend, Closure progress display
- **Summary:** On a project's Closure tab, Deliverables now reads "x/N milestones done · avg Y%", so progress on tasks shows even before a milestone is fully done (before, it showed 0% until whole milestones were Done). When no terminal report exists yet, the Terminal Report card says where to submit it (Monitoring & Evaluation → Terminal Report).
- **Affected modules:** Project Management (project detail, Closure tab)
- **Notes:** Task 65-D. Display only. The backend deliverables % used by renewal eligibility, Risk and DSS is unchanged, and so are the terminal report workflow and the Overview Physical Progress. No backend change, no migration.

### 2026.11.16.1151

- **Date and time:** 2026-11-16 11:51 (Asia/Manila)
- **Category:** Backend and frontend, project History tab
- **Summary:** A project's History tab now shows the process it actually went through, newest first: registration, submission by the Project Leader, CRC/CRD Mark for checking (forwarded to Finance/Accounting/Budget), returns for revision by CRC/CRD or Finance with their remarks, resubmissions, Finance review start, comments, certification (project Active), LIB line-item updates, and Ongoing/Completed/Closed changes. Each entry shows who did it, their role and the date and time; the latest is highlighted. Every role that can open the project sees the same history.
- **Affected modules:** Project Management (project detail, History tab)
- **Notes:** Task 65-C. Backend 179c31b (new GET /api/projects/<id>/history/). Built only from saved records; steps from before these records existed are not shown. No migration.

### 2026.11.16.1143

- **Date and time:** 2026-11-16 11:43 (Asia/Manila)
- **Category:** Frontend, UI removal (Project Management, project detail)
- **Summary:** In a project's Registration Info tab, Approval Information now shows only the NTP (Project Code); NTP Date, TOE Signed, Proposal Submitted/Reviewed/Approved, Reviewing / Approving Body and the endorser cards (Dean, RDS Director, Campus Director, VPRDE, President) were removed. In the Impact tab, the Anticipated Outcomes and Long-term Impacts cards were removed. Target Beneficiaries, SDGs and the other Impact cards stay.
- **Affected modules:** Project Management (project detail: Registration Info, Impact); all roles that can open a project
- **Notes:** Task 65-A/B (client remove.png, remove1.png). UI only; the saved data and database fields are kept. No backend change, no migration.

### 2026.11.16.1136

- **Date and time:** 2026-11-16 11:36 (Asia/Manila)
- **Category:** Frontend, Budget Forecast page and access
- **Summary:** The Budget Forecast project dropdown now sits at the top of the page at full width and shows each project as **Project Title — NTP**. It lists only Active projects (LIB certified by Finance/Accounting/Budget) of any funding type that the user may forecast, taken from the backend. Saved runs show the project title and NTP. Budget Forecasting is now in the sidebar and opens for the Project Leader, RIUH, CRC/CRD, Finance/Accounting/Budget and System Admin; VP for REI and University Administration no longer have it.
- **Affected modules:** Budget Forecast, Sidebar, Dashboard objective card link
- **Notes:** Tasks 64-A and 66-B. Needs backend 6ec057f and accounts 0033 migrated. The ARIMA and quick-projection calculations are unchanged. No migration in this commit.

### 2026.11.16.1125

- **Date and time:** 2026-11-16 11:25 (Asia/Manila)
- **Category:** Backend, access and data rules (Budget Forecast / ARIMA)
- **Summary:** Budget Forecast (ARIMA) now works only on Active projects (the current LIB is certified by Finance/Accounting/Budget), of any funding type, so Core-Funded projects are no longer refused. It is for the Project Leader, RIUH, CRC/CRD and Finance/Accounting/Budget (and System Admin), each within their own projects or campus. VP for REI no longer has it. Saved forecasts of a project that is not Active are not shown, and asking for one by its id is refused.
- **Affected modules:** Budget Forecast (API), User roles (forecast permission)
- **Notes:** Task 66-A. Backend 6ec057f with new GET /api/forecasting/projects/ for the project dropdown. Needs accounts 0033 migrated (data only). The ARIMA calculation is unchanged. The page itself is updated in Task 66-B.

### 2026.11.16.1119

- **Date and time:** 2026-11-16 11:19 (Asia/Manila)
- **Category:** Backend and frontend, analytics (Analytics Overview)
- **Summary:** "Budget Allocation by Funding Agency" is now **Budget Allocation by Funding Type**. The bars show the current LIB totals per project Funding Type (Institutional, Core-Funded, Externally-Funded, and any added in Funding Types), using the names from the Funding Types admin list. Before, it grouped by a LIB funding source that the LIB form no longer fills, so everything showed as "Unspecified". The overall budget total is unchanged.
- **Affected modules:** Analytics (Overview tab), Dashboard API (performance)
- **Notes:** Task 64-D. Backend 011a7bb (performance key budget_by_funding_agency renamed to budget_by_funding_type). No migration. Quarterly Reports' Funding Agency is not affected.

### 2026.11.16.1114

- **Date and time:** 2026-11-16 11:14 (Asia/Manila)
- **Category:** Frontend, table column (Financial Monitoring)
- **Summary:** The Disbursement Ledger and Budget Utilization tabs have a **Specification** column showing the saved LIB item's Specification, like the Procurement table. An item without a Specification shows "—". No Description column was added.
- **Affected modules:** Procurement, Realignment & Financial Monitoring (Disbursement Ledger, Budget Utilization)
- **Notes:** Task 64-C. Display only; totals, filters, sorting and the API are unchanged. No backend change, no migration.

### 2026.11.16.1109

- **Date and time:** 2026-11-16 11:09 (Asia/Manila)
- **Category:** Frontend, navigation (Finance/Accounting/Budget sidebar)
- **Summary:** Budget Office Sync is hidden from the Finance/Accounting/Budget sidebar for now, because how it should work is not decided yet. System Admin, VP for REI and University Administration still see it. The page, its data and the API are unchanged, and the page still opens by its direct link for the same roles as before.
- **Affected modules:** Sidebar (Finance/Accounting/Budget), Budget Office Sync
- **Notes:** Task 64-B. Navigation only; no permission, route, backend or data change, no migration.

### 2026.11.16.1102

- **Date and time:** 2026-11-16 11:02 (Asia/Manila)
- **Category:** Frontend, status display (Dashboard, Project Management)
- **Summary:** A project now shows **Ongoing** only after Finance/Accounting/Budget certified its LIB (review status Active). The Dashboard Projects tab and the Project Management list have a new **For Approval** summary (For Budget Review, Ongoing Review - CRC/CRD, Ongoing Review - Budget, Returned Review - Budget) next to Ongoing, Completed and Closed. Projects not yet certified show their review status instead of Ongoing. Draft, Submitted and Returned for Revision - CRC/CRD stay in the list but are counted in no summary. The Dashboard "N ongoing" figure follows the same rule.
- **Affected modules:** Dashboard (Projects tab, Total Projects card, campus drill-down project rows), Project Management (summary filter, project cards); all roles
- **Notes:** Task 62. Display only: no project status, data, permission or API change; no backend change, no migration. Analytics "Active Projects", the Risk dashboard and the per-campus counts on the Dashboard drill-down still use the project status (follow-up).

### 2026.11.16.1054

- **Date and time:** 2026-11-16 10:54 (Asia/Manila)
- **Category:** Frontend, UI text (Budget Management, Project Review)
- **Summary:** On the Finance/Accounting/Budget Project Review cards, a project whose LIB is already certified now shows **View Information** instead of **Open Review**. The button opens the same read-only review view as before. Projects not yet certified still show Open Review.
- **Affected modules:** Budget Management (Finance/Accounting/Budget)
- **Notes:** Task 63. Label only; no change to certification, statuses, permissions or the API. No backend change, no migration.

### 2026.11.13.2132

- **Date and time:** 2026-11-13 21:32 (Asia/Manila)
- **Category:** Frontend, UI responsiveness (Budget Management, Open LIB)
- **Summary:** Put on Hold, Resubmit and Submit on the Open LIB view now use the LIB the backend returns right away, so the status and the action buttons change together with the success toast instead of after the lists reload. The lists still reload in the background. If the backend refuses the step, nothing changes.
- **Affected modules:** Budget Management (Open LIB for CRC/CRD, Finance/Accounting/Budget, Project Leader)
- **Notes:** Task 60, follow-up of Task 59 (same fix as Open Review). No backend change, no migration.

### 2026.11.13.2124

- **Date and time:** 2026-11-13 21:24 (Asia/Manila)
- **Category:** Frontend, UI responsiveness (Open Review)
- **Summary:** After a review step succeeds (Mark for checking, Return for Revision, Certify, Submit/Resubmit, comment), the LIB the backend returns goes straight into the page data, so the action buttons disappear or change together with the success toast instead of staying clickable until the project and LIB lists finish reloading. The lists still reload in the background. If the backend refuses the step, nothing changes and the buttons stay.
- **Affected modules:** Project Management (Open Review for CRC/CRD, Finance/Accounting/Budget, Project Leader)
- **Notes:** Client complaint 2026-11-13 (Task 59). No backend change, no migration. The backend already locks the LIB row and rejects a repeated step with an error, so double clicks never saved twice.

### 2026.11.12.2035

- **Date and time:** 2026-11-12 20:35 (Asia/Manila)
- **Category:** Backend, rule change (Upload via Excel)
- **Summary:** Upload via Excel now accepts the RMIS E-mail OR the Staff ID for the Project Leader (Project sheet) and for each Project Team row. Either one finds the account and fills the name and gender (for the leader, a blank Gender/Contact No.). When both are filled they must be the same account; an e-mail or Staff ID with no RMIS account is still an error. A Project Team row with neither (for example a Role only) is no longer read, so it is not counted as a member and gives no error. Replaces the 2026.11.06 rule that both were required.
- **Affected modules:** Project Registration (Upload via Excel review, Step 2 Proponents & Team), Excel template hints
- **Notes:** Client Task 57. Backend rmis-backend 5d4fdfe; no frontend code change, no migration.

### 2026.11.12.1836

- **Date and time:** 2026-11-12 18:36 (Asia/Manila)
- **Category:** Frontend, code cleanup (access control)
- **Summary:** The Personnel Changes page's list of roles that may fill in and sign off the property clearance (PAR) now matches the backend: System Admin and RIUH only. Procurement Officer - LIB was still in that list, but since 2026.11.10.1702 that role cannot open the page and the backend already refuses its clearance, so nothing changes for any user.
- **Affected modules:** Personnel Changes (property clearance)
- **Notes:** Client Task 54 follow-up (our Task 55). No backend change, no migration.

### 2026.11.10.1702

- **Date and time:** 2026-11-10 17:02 (Asia/Manila)
- **Category:** Frontend, access control (sidebar and pages)
- **Summary:** The Personnel Coordination group in the sidebar now follows the client's role list. System Admin, VP for REI, University Administration, CRC/CRD and RIUH see Personnel Coordination, Leader Load and Personnel Changes. The Project Leader sees only Leader Load. Finance/Accounting/Budget, Procurement Officer - LIB and Project Staff see none of them. Opening one of these pages by its address without access shows an empty page (the existing behavior for any page a role may not open), not the page's data.
- **Affected modules:** Personnel Coordination, Leader Load, Personnel Changes (sidebar, page access)
- **Notes:** Client Task 54 (client document "Task 51"), part B. Works together with 2026.11.10.1657 (backend permissions, migration accounts 0032). Leader Load itself is unchanged. Not committed per Carl.

### 2026.11.10.1657

- **Date and time:** 2026-11-10 16:57 (Asia/Manila)
- **Category:** Backend, access control (permissions)
- **Summary:** Personnel Coordination and Personnel Changes data can now be read only by System Admin, VP for REI, University Administration, CRC/CRD and RIUH; any other role gets "not allowed" from the API. Leader Load is now also open to VP for REI and University Administration (still System Admin, CRC/CRD, RIUH and Project Leader). Procurement Officer - LIB can no longer acknowledge property clearance (PAR) on a Personnel Change; System Admin and RIUH do it. Adding or changing staff levels, assignments and personnel changes stays with System Admin and RIUH; the others only view.
- **Affected modules:** Personnel Coordination, Leader Load, Personnel Changes (backend permissions)
- **Notes:** Client Task 54 (client document "Task 51"), part A, backend-only (rmis-backend, not committed per Carl). Needs migration accounts 0032 on the shared DB before it takes effect. The sidebar/page changes come in part B. Assignment lists used by Tasks, Work Plan, Project details and other pages are unchanged.

### 2026.11.07.1709

- **Date and time:** 2026-11-07 17:09 (Asia/Manila)
- **Category:** Backend, bug fix (Excel import)
- **Summary:** Register Approved Project → Manual Entry → Step 4 Budget (LIB) → Import from Excel now accepts a Budget Requirements row that gives only its Total (no Unit, Qty, Unit Cost): it comes in as Qty 1 × Unit Cost = Total, the same as Upload via Excel. Unit may be blank. A row with a blank Particulars comes in as a red row without an Item, to be picked in the table before submitting. Each row's periods must still add up to its Total, and the Grand Total vs Total Project Cost check is unchanged.
- **Affected modules:** Project Registration (Step 4 Budget (LIB) import)
- **Notes:** Client Task 52, backend-only change (rmis-backend 7a2ee65). Found with the Vetiver LIB (58 row errors before). A LIB template from before Task 50 (sheet "LIB") still needs Item, Unit, Qty and Unit Cost. No migration.

### 2026.11.07.1624

- **Date and time:** 2026-11-07 16:24 (Asia/Manila)
- **Category:** Backend, bug fix (Excel import)
- **Summary:** Register Approved Project → Manual Entry → Step 4 Budget (LIB) → Import from Excel no longer refuses a Budget Requirements sheet that has fewer Y/Q columns than the project's periods (e.g. a 01/01/2025–01/31/2028 project needs Y4 Q1 but the sheet stops at Y3 Q4). A period without its column is read as 0.00, the same as Upload via Excel. Each row's filled periods must still add up to its Total, and an amount in a column outside the project's dates is still refused.
- **Affected modules:** Project Registration (Step 4 Budget (LIB) import)
- **Notes:** Client Task 51, backend-only change (rmis-backend a8961a9). A LIB template from before Task 50 (sheet "LIB") still needs every period column. No migration.

### 2026.11.07.1520

- **Date and time:** 2026-11-07 15:20 (Asia/Manila)
- **Category:** Backend, Excel template change
- **Summary:** Register Approved Project → Manual Entry → Step 4 Budget (LIB) → Download LIB Template now gives the same layout as the Budget Requirements sheet of the Upload via Excel template: sheet "Budget Requirements", header in row 1 (Fiscal Year · Category · Particulars · Specification (optional) · Unit · Qty · Unit Cost · Total · Y1 Q1 … Y3 Q4), the same Legend sheet and the same Lists dropdowns (Category, Particulars, Unit). A one-year project fills Y1 Q1–Q4; the other Y/Q columns stay blank. A project longer than three years also gets Y4+ columns. Import from Excel on Step 4 reads this layout, a whole Upload via Excel workbook, and a LIB template filled before this change. Budget Management's Download LIB (Finance) uses the same layout.
- **Affected modules:** Project Registration (Step 4 Budget (LIB) template and import), Budget Management (Download LIB)
- **Notes:** Client Task 50, backend-only change (rmis-backend). "Particulars" now means the LIB Item in both Excel files (it was the PS/MOOE/CO class in the old LIB template; that is now "Category"). The Step 4 screen labels are unchanged. The Fiscal Year column is read but Step 4 still saves the Start Date's year. No migration.

### 2026.11.07.0044

- **Date and time:** 2026-11-07 00:44 (Asia/Manila)
- **Category:** UI, frontend, logic change
- **Summary:** Upload via Excel review only: a LIB row with an amount but no Item no longer stops registering. It is outlined in amber, listed as an optional note ("won't be saved or counted in the Grand Total"), and left out of the saved LIB. So the client's case works: cost ₱709,000 vs LIB Grand Total ₱409,000 is a mismatch (blocking); changing the Total Project/Study Cost to ₱409,000 clears it and the proposal can be submitted when nothing required is missing. Step 1 now shows under the Total Project/Study Cost "LIB Grand Total · Difference · Match/Mismatch" (cost outlined red on a mismatch). Each step's list is split into "Fix these in this step before registering" (red) and "Optional, won't stop registering" (amber); the banner shows "N issues to fix · M optional notes".
- **Affected modules:** Project Registration (Upload via Excel review, Steps 1 and 4)
- **Notes:** Client Task 49. Manual Entry is unchanged (a row without an Item still blocks there). The cost and the LIB are never changed automatically; the totals must still be equal (also enforced by the backend since 2026.11.06.2240).

### 2026.11.06.2327

- **Date and time:** 2026-11-06 23:27 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** Procurement requests table (Procurement Officer - LIB dashboard; the same table on the Project Leader's and Finance's Procurement page): the Routing column is gone and a Particulars column is next to Project / Item. Columns: Ref, Project / Item, Particulars, Description, Amount, Year / Q, Status (Payment Status for Finance), Action. Project / Item now shows the project code and title; Particulars shows the LIB Item the request is charged to, with its Specification in small text below; "—" when the item can't be found. The routing itself is unchanged (still saved, and still shown as "Routed to" in New Procurement Request).
- **Affected modules:** Procurement (requests table)
- **Notes:** Client Task 48-C (Carl's Q1 = a: Particulars = the LIB Item name). Frontend only; no API change.

### 2026.11.06.2322

- **Date and time:** 2026-11-06 23:22 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** Procurement → New Procurement Request → Link to LIB Item is now a searchable list instead of a plain dropdown. Each item shows its name, LIB amount and "Available ₱X" (or "No available balance", greyed out and not selectable). Highlighting an item (mouse or arrow keys) shows beside it (below it on a phone) its Specification ("No specification provided" when the LIB has none) and its Approved, Committed (unpaid), Paid and Available to request, all from the backend. The chosen item keeps the same details under the field. The amounts are read again every time the modal opens, so a request or payment made elsewhere shows the next time. Search covers the item name and the Specification.
- **Affected modules:** Procurement (Project Leader's New Procurement Request)
- **Notes:** Client Task 48-B, using procurement-balance/?budget= from 2026.11.06.2314. Available drops when a request is filed (reserved) and doesn't drop again when it is paid; the year's own check and the "Insufficient available budget" modal are unchanged.

### 2026.11.06.2314

- **Date and time:** 2026-11-06 23:14 (Asia/Manila)
- **Category:** Backend, API
- **Summary:** New `GET /api/financial/procurement-balance/?budget=<id>`: the procurement figures (Approved, Committed, Paid, Unpaid, Available per project year and quarter) of every item of one LIB in one call, for the Project Leader's New Procurement Request → Link to LIB Item. Same calculation and scope as the existing per-item `?line_item=` (unchanged). The shared calculation now reads its rows in a few queries when all items are asked for: the real Optimizing LIB (29 items) went from about 17 s to about 0.5 s.
- **Affected modules:** Procurement (backend financial_monitoring)
- **Notes:** Client Task 48-A, backend-only (rmis-backend). No visible change until 48-B. Available already drops when a request is filed (it is reserved) and doesn't drop again when it is paid; Completed isn't Paid.

### 2026.11.06.2257

- **Date and time:** 2026-11-06 22:57 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** Register Approved Project → Upload via Excel: a progress bar under the upload box, like Supporting Documents. While the file is sent it shows "Uploading <file>… N%" (the browser's real transfer %); at 100% it shows "Checking <file>…" with a full bar until the server has read the workbook, and only then the review opens. If the upload or the reading fails, the bar turns red with "<file> could not be read. Choose the file again." plus the existing toast and error table. The file box stays disabled while a file is being uploaded or checked.
- **Affected modules:** Project Registration (Upload via Excel)
- **Notes:** Client Task 47-C. No % is shown for the server's reading (it has none), and none when the browser doesn't know the file size.

### 2026.11.06.2252

- **Date and time:** 2026-11-06 22:52 (Asia/Manila)
- **Category:** UI, frontend, bug fix
- **Summary:** Register Approved Project, Step 4 Budget (LIB), in Manual Entry and in the Upload via Excel review: the Grand Total and the PS/MOOE/CO subtotals count only the rows that will be saved (rows with an Item). A row with an amount but no Item is outlined in red, a note gives how many rows and how much isn't counted, and it is listed as missing on Step 4, so Next, Save as a Draft, Submit this proposal and Upload & Register Project stay blocked until the Item is chosen or the row is removed. The Excel review banner shows "Total Project/Study Cost · LIB Grand Total · Difference · Match/Mismatch", recomputed on every edit of Step 1 or Step 4. The mismatch note now says to adjust the line items or the Total Project/Study Cost in Step 1 (Edit Registration keeps its Realignment note).
- **Affected modules:** Project Registration (Manual Entry and Upload via Excel review, Step 4)
- **Notes:** Client Task 47-B, with the backend check from 2026.11.06.2240. Before, rows without an Item were counted in the Grand Total but not saved, so the totals looked equal and the project became a Draft whose submit failed.

### 2026.11.06.2240

- **Date and time:** 2026-11-06 22:40 (Asia/Manila)
- **Category:** Backend, bug fix
- **Summary:** Registering a project (Manual Entry, or Register from the Upload via Excel review) is now refused, as a Draft too, when the LIB Grand Total isn't equal to the Total Project/Study Cost, or when there are no LIB line items. Nothing is saved and the message is "The LIB Grand Total (…) must equal the Total Project/Study Cost (…)". Before, the project was saved as a Draft and only the submit to CRC/CRD failed, which left a Draft whose cost and LIB could no longer be edited.
- **Affected modules:** Project Registration (backend POST projects/)
- **Notes:** Client Task 47-A, backend-only (rmis-backend). Amounts are compared as decimals (centavos). The old direct Excel import (not used by the UI since 2026.11.06.1634) isn't checked.

### 2026.11.06.1634

- **Date and time:** 2026-11-06 16:34 (Asia/Manila)
- **Category:** UI, frontend
- **Summary:** Register Approved Project → Upload via Excel: choosing the filled workbook opens it straight in the Manual Entry steps as a review (the separate "View as SF-018" and "Review & edit before registering" buttons are gone). Missing required fields are outlined from the start, the workbook's invalid values are listed in their step, a step with a problem shows a red "!" circle, and the "N issues found · nothing was saved" count drops as each one is fixed. "Upload & Register Project" asks "Are you sure you want to register this project?" (Cancel / Submit), or lists every remaining problem by step and field, with a link to each step, and registers nothing. Registering uses the same request and checks as Manual Entry. A Co-Project Leader can now be picked from Project Leader or Project Staff accounts.
- **Affected modules:** Project Registration (Upload via Excel review; the Co-Project Leader list also in Manual Entry and Edit Registration)
- **Notes:** Client Task 45-C, using the backend review mode from 2026.11.06.1611.

### 2026.11.06.1618

- **Date and time:** 2026-11-06 16:18 (Asia/Manila)
- **Category:** Backend, maintenance command
- **Summary:** The fresh-start cleanup command (`cleanup_fresh_start`) now also empties the Event Logs Budget, together with the test data they describe, like the request audit log. Before this fix the command refused to run because the new table wasn't classified.
- **Affected modules:** Maintenance only (rmis-backend, no migration); nothing changes for users
- **Notes:** Client Task 46 follow-up (Carl's decision: CLEAR).

### 2026.11.06.1611

- **Date and time:** 2026-11-06 16:11 (Asia/Manila)
- **Category:** Backend, validation
- **Summary:** Upload via Excel has a review mode that reads the whole workbook without saving it and lists every issue, leaving values that are no longer valid blank instead of replacing them, so the next frontend task can show the review step by step. The Project Leader's Staff ID and each Project Team row's RMIS E-mail and Staff ID are now required. A Co-Project Leader account must be a Project Leader or Project Staff account, and a project has only one Co-Project Leader (Manual Entry and Edit Registration too).
- **Affected modules:** Project Registration (Upload via Excel, Manual Entry, Edit Registration team rows); rmis-backend `0ddeea5`, no migration
- **Notes:** Client Task 45-B. The screen doesn't use the review mode yet (Task 45-C). Older templates without Staff IDs are refused with a clear message.

### 2026.11.06.1559

- **Date and time:** 2026-11-06 15:59 (Asia/Manila)
- **Category:** Backend, Excel template
- **Summary:** The Register Approved Project → Upload via Excel template has dropdowns for single-choice fields (Funding Type, Gender, Campus, College Unit, New or Continuing, Basic or Applied, Wet or Dry, RDE Thrust, RDE Priority Area, Team Role, 6Ps Item, Budget Category, Particulars, Unit). The options come from the current System Admin data at every download and are listed on a protected Lists sheet, together with the valid values of the typed multi-value fields (Sector, Typology, SDGs, Cooperating Agencies). The Project Team sheet no longer has Name and Gender: every row names an RMIS account (E-mail and Staff ID), and the name and gender come from that account.
- **Affected modules:** Project Registration → Upload via Excel (rmis-backend `9ba5794`, no migration)
- **Notes:** Client Task 45-A. Older templates still import, and their Name/Gender columns are ignored. Team members without an RMIS account are added in Edit Registration. Manual Entry is unchanged.

### 2026.11.06.1549

- **Date and time:** 2026-11-06 15:49 (Asia/Manila)
- **Category:** Backend
- **Summary:** Event Logs Budget now also records procurement requests (created, received, returned for revision, status updates, completed, resubmitted, payment confirmed), realignments (requested, approved, rejected), disbursements, and the LIB saved during project registration (Manual Entry, the LIB step and Upload via Excel).
- **Affected modules:** Procurement, Realignment, Disbursements, Project Registration; backend only (rmis-backend `ecb8885`, no migration)
- **Notes:** Client Task 46-B. Still database-only, with no screen. Same logged roles as 2026.11.06.1539.

### 2026.11.06.1539

- **Date and time:** 2026-11-06 15:39 (Asia/Manila)
- **Category:** Backend, database
- **Summary:** New Event Logs Budget, a confidential database-only record of who did which LIB action on which project (created, line item added/edited/removed, submitted, resubmitted, marked for checking, certification started, certified, put on hold, review comment, Finance line-item update with reason). It keeps the actor's name, e-mail, Staff ID and role, the project's NTP/code and title, old and new values, remarks, amount, and the date and time.
- **Affected modules:** Budget (LIB) workflow, backend only (rmis-backend `82059aa`, migration budget_lib 0015)
- **Notes:** Client Task 46-A. No screen shows these logs. Logged roles: Project Leader, Procurement Officer - LIB, Finance/Accounting/Budget and System Admin. Procurement, realignment and disbursement events follow in Task 46-B.

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
