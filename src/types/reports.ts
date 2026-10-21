import type { TaskStatus } from "./personnel";

export type ReportType =
  | "appendix_e"
  | "appendix_f"
  | "appendix_g"
  | "project_list"
  | "financial"
  | "compliance"
  | "personnel"
  | "outputs";
export type ReportFormat = "csv" | "xlsx" | "pdf" | "docx";

/** GET /api/reports/accomplishment/summary/: the same rows as the downloaded Monthly Accomplishment Report. */
export interface AccomplishmentSummary {
  /** Approved by the leader (Done) this month. */
  accomplished: number;
  /** Submitted by the staff, still For Review. */
  awaiting_approval: number;
  /** The staff's Work Log hours this month, every task. */
  total_hours: number;
  rows: {
    id: number;
    project: number;
    project_code: string;
    title: string;
    status: TaskStatus;
    progress_pct: number;
    hours: number;
    due_date: string | null;
    completed_at: string | null;
    notes: string;
  }[];
}

export interface GeneratedReportLog {
  id: number;
  report_type: ReportType;
  format: ReportFormat;
  filters: Record<string, unknown>;
  generated_by: number;
  generated_at: string;
}
