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
  weighted_score: number | null;
}

export interface EvaluationCriterion {
  id: number;
  name: string;
  description: string;
  weight: number;
  is_active: boolean;
}

export interface EvaluationScore {
  id: number;
  evaluation: number;
  criterion: number;
  score: string;
  remarks: string;
}

export type ExtensionRequestStatus = "pending" | "endorsed" | "approved" | "denied";

export interface ExtensionRequest {
  id: number;
  project: number;
  current_end_date: string;
  requested_end_date: string;
  justification: string;
  status: ExtensionRequestStatus;
  submitted_by: number;
  submitted_at: string;
  endorsed_by: number | null;
  endorsed_at: string | null;
  decided_by: number | null;
  decided_at: string | null;
  remarks: string;
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
  indicators: MonitoringIndicators;
}

export type BudgetOfficeMatchStatus = "matched" | "discrepancy" | "no_rmis_budget" | "unlinked";

export interface MonitoringIndicators {
  monthly_report: { status: EscalationStatus; months_since_last_report: number | null };
  midterm_report_years: number[];
  budget_utilization_pct: number | null;
  budget_utilization_meets_70: boolean;
  deliverables_pct: number | null;
  deliverables_meets_70: boolean;
  terminal_report_submitted: boolean;
  latest_evaluation: { scheduled_date: string; outcome: EvaluationOutcome } | null;
  extension_requests: { status: ExtensionRequestStatus; requested_end_date: string }[];
  realignments_this_year: number;
  procurement_delayed: number;
  similarity_checks: { total: number; over_threshold: number };
  ai_declarations: { total: number; over_threshold: number };
  outputs_6ps: { target: number; expected_output_rows: number };
  forecast_overrun_risk: boolean | null;
  budget_office_status: BudgetOfficeMatchStatus | null;
}
