export type ReportType = "appendix_e" | "appendix_f" | "appendix_g" | "project_list";
export type ReportFormat = "csv" | "xlsx" | "pdf" | "docx";

export interface GeneratedReportLog {
  id: number;
  report_type: ReportType;
  format: ReportFormat;
  filters: Record<string, unknown>;
  generated_by: number;
  generated_at: string;
}
