export interface MonthlyProgressReport {
  id: number;
  project: number;
  period: string;
  narrative: string;
  document: number | null;
  submitted_by: number;
  submitted_at: string;
}

export interface MidtermReport {
  id: number;
  project: number;
  project_year: number;
  narrative: string;
  expenditure_summary: string;
  document: number | null;
  submitted_by: number;
  submitted_at: string;
}

export interface TerminalReport {
  id: number;
  project: number;
  narrative: string;
  document: number | null;
  submitted_by: number;
  submitted_at: string;
  is_certified: boolean;
  certified_by: number | null;
  certified_at: string | null;
}

export type EvaluationOutcome = "pending" | "passed" | "conditional" | "failed";

export interface ProjectEvaluation {
  id: number;
  project: number;
  project_year: number;
  scheduled_date: string;
  panel_members: string;
  outcome: EvaluationOutcome;
  remarks: string;
  evaluated_by: number | null;
  evaluated_at: string | null;
  created_at: string;
}

export type RenewalStatus = "pending" | "approved" | "denied";

export interface RenewalApplication {
  id: number;
  project: number;
  application_year: number;
  underspend_justification: string;
  status: RenewalStatus;
  decided_by: number | null;
  decided_at: string | null;
  submitted_by: number;
  submitted_at: string;
  renewal_eligible: boolean;
  budget_used_pct: number | null;
  deliverables_pct: number | null;
}

export type EscalationStatus = "unknown" | "on_track" | "notify_dean_riuh" | "terminate_recommended";

export interface ProjectMonitoringStatus {
  project: number;
  escalation_status: EscalationStatus;
  months_since_last_report: number | null;
  budget_used_pct: number | null;
  deliverables_pct: number | null;
  midterm_submitted_years: number[];
  terminal_submitted: boolean;
}
