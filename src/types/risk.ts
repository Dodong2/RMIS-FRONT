export type RiskLevel = "low" | "medium" | "high" | "critical";

interface ScoredFlag {
  flagged: boolean;
  likelihood: number;
  impact: number;
  score: number;
}

export interface NonSubmissionWarningFlag extends ScoredFlag {
  status: "on_track" | "notify_dean_riuh" | "terminate_recommended" | "unknown";
  months_since_last_report: number | null;
}

export interface BudgetUnderutilizationFlag extends ScoredFlag {
  budget_used_pct: number | null;
  near_renewal: boolean;
}

export interface DeliverableShortfallFlag extends ScoredFlag {
  deliverables_pct: number | null;
  near_renewal: boolean;
}

export interface DeliverableSlippageFlag extends ScoredFlag {
  overdue_count: number;
}

export interface PersonnelChangeFrequencyFlag extends ScoredFlag {
  changes_in_window: number;
  window_months: number;
}

export interface ProcurementDelayFlag extends ScoredFlag {
  delayed_requests: number;
  delay_days: number;
}

export interface ForecastOverrunFlag extends ScoredFlag {
  has_forecast: boolean;
  is_overrun_risk: boolean | null;
}

export interface ProjectRiskFlags {
  non_submission_warning: NonSubmissionWarningFlag;
  budget_underutilization: BudgetUnderutilizationFlag;
  deliverable_shortfall: DeliverableShortfallFlag;
  deliverable_slippage: DeliverableSlippageFlag;
  personnel_change_frequency: PersonnelChangeFrequencyFlag;
  procurement_delay: ProcurementDelayFlag;
  forecast_overrun: ForecastOverrunFlag;
}

export interface ProjectRiskStatus {
  project: number;
  project_code: string;
  risk_score: number;
  risk_level: RiskLevel;
  recommended_action: string;
  flagged_count: number;
  open_register_risks: number;
  flags: ProjectRiskFlags;
  register?: ProjectRisk[];
}

export interface RiskDashboard {
  total_projects: number;
  by_risk_level: Record<RiskLevel, number>;
  flagged_projects: ProjectRiskStatus[];
}

export type RiskCategory =
  | "technical"
  | "financial"
  | "schedule"
  | "personnel"
  | "compliance"
  | "procurement"
  | "other";
export type RiskRegisterStatus = "open" | "mitigating" | "escalated" | "closed";

export interface ProjectRisk {
  id: number;
  project: number;
  description: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  score: number;
  level: RiskLevel;
  owner: number;
  owner_email: string;
  owner_name: string;
  mitigation: string;
  status: RiskRegisterStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface RiskUpdate {
  id: number;
  risk: number;
  note: string;
  new_status: RiskRegisterStatus | "";
  author: number;
  author_email: string;
  author_name: string;
  created_at: string;
}

interface AlertBase {
  project: number;
  project_code: string;
  title: string;
  /** Where clicking the alert goes, e.g. /projects/12 or /work-plan?project=12 */
  link: string;
  type: "warning" | "danger";
  text: string;
}

export interface ProjectRiskAlert extends AlertBase {
  kind: "risk";
  risk_level: RiskLevel;
  risk_score: number;
  top_trigger: string;
  recommended_action: string;
}

/** Overdue, not-done work plan milestone; goes to the project's leader and system_admin (client meeting 2026-10-01). */
export interface MilestoneAlert extends AlertBase {
  kind: "milestone";
  milestone: number;
  days_overdue: number;
}

export type RiskAlert = ProjectRiskAlert | MilestoneAlert;

export interface RiskAlertInbox {
  as_of: string;
  count: number;
  alerts: RiskAlert[];
}
