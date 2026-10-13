export interface MonthlyProgressReport {
  id: number;
  project: number;
  period: string;
  narrative: string;
  document: number | null;
  submitted_by: number;
  submitted_at: string;
}

export interface ObjectiveAccomplishment {
  objective: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
}

export interface MidtermReport {
  id: number;
  project: number;
  project_year: number;
  narrative: string;
  expenditure_summary: string;
  /** LSPU-RDO-SF-017: % accomplishment per objective per quarter (null = not reported) */
  objective_accomplishments: ObjectiveAccomplishment[];
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

// R&D Quarterly Progress Reports (client 2026-10-14)
export type QuarterlyReportStatus = "draft" | "submitted" | "under_review" | "returned_for_revision" | "endorsed" | "approved";

export interface QuarterlyAccomplishment {
  objective: string;
  activity: string;
  target: string;
  actual: string;
  cumulative: string;
  target_date: string;
  actual_date: string;
  completion_pct: number;
  variance: string;
  remarks: string;
}

export interface QuarterlyIssue {
  issue: string;
  corrective_action: string;
  recommendation: string;
  responsible: string;
  target_resolution_date: string;
}

export interface QuarterlyFinancialSnapshot {
  original_budget: number;
  approved_adjustments: number;
  adjusted_budget: number;
  quarter_disbursements: number;
  cumulative_disbursements: number;
  remaining_budget: number;
  utilization_pct: number;
  transaction_count: number;
  over_budget: boolean;
}

export interface QuarterlyReportEvent {
  action: "created" | "updated" | "status_transition";
  from_status: string;
  to_status: string;
  remarks: string;
  actor: string;
  at: string;
}

export interface QuarterlyReport {
  id: number;
  project: number;
  year: number;
  quarter: number;
  period: string;
  status: QuarterlyReportStatus;
  version: number;
  is_overdue: boolean;
  project_info: {
    code: string;
    title: string;
    leader: string;
    leader_id: number;
    campus: string;
    college: string;
    funding_agency: string;
    start_date: string | null;
    end_date: string | null;
    objectives: string[];
  };
  accomplishments: QuarterlyAccomplishment[];
  issues: QuarterlyIssue[];
  financial_snapshot: QuarterlyFinancialSnapshot;
  evidence: number[];
  evidence_files: { id: number; file_name: string }[];
  recommendations: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  approved_by: number | null;
  approved_by_name: string;
  approved_at: string | null;
  events: QuarterlyReportEvent[];
  review_history: QuarterlyReportEvent[];
}

export type QuarterlyReportEdit = Partial<Pick<QuarterlyReport, "accomplishments" | "issues" | "evidence" | "recommendations">>;
