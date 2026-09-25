export interface ScheduledReport {
  id: string;
  reportName: string;
  frequency: "Monthly" | "Quarterly" | "Semestral" | "Annual";
  format: "PDF" | "Excel";
  scope: string;
  recipients: string;
  nextRun: string;
  lastRun: string | null;
  active: boolean;
}

export const SCHEDULED_REPORTS: ScheduledReport[] = [
  { id: "sch1", reportName: "Appendix G — R&D Accomplishment Report", frequency: "Annual", format: "PDF", scope: "All campuses", recipients: "VP-REI, DRD", nextRun: "2027-01-05", lastRun: "2026-01-05", active: true },
  { id: "sch2", reportName: "Financial / Procurement Report", frequency: "Quarterly", format: "Excel", scope: "Institutional funding", recipients: "Budget Office, DRD", nextRun: "2026-10-01", lastRun: "2026-07-01", active: true },
  { id: "sch3", reportName: "Compliance Report", frequency: "Monthly", format: "PDF", scope: "All campuses", recipients: "RIUH", nextRun: "2026-10-01", lastRun: "2026-09-01", active: true },
  { id: "sch4", reportName: "Risk Register Export", frequency: "Monthly", format: "Excel", scope: "All projects", recipients: "RIUH, CRC Chairperson", nextRun: "2026-10-01", lastRun: "2026-09-01", active: false },
  { id: "sch5", reportName: "Research Outputs (6Ps) Report", frequency: "Semestral", format: "PDF", scope: "All campuses", recipients: "VP-REI", nextRun: "2027-01-15", lastRun: "2026-07-15", active: true },
];
