export type RiskLevel = "low" | "medium" | "high";

export interface NonSubmissionWarningFlag {
  flagged: boolean;
  status: "on_track" | "notify_dean_riuh" | "terminate_recommended" | "unknown";
  months_since_last_report: number | null;
}

export interface BudgetUnderutilizationFlag {
  flagged: boolean;
  budget_used_pct: number | null;
}

export interface DeliverableSlippageFlag {
  flagged: boolean;
  overdue_count: number;
  deliverables_pct: number | null;
}

export interface PersonnelChangeFrequencyFlag {
  flagged: boolean;
  changes_in_window: number;
  window_months: number;
}

export interface ForecastOverrunFlag {
  flagged: boolean;
  has_forecast: boolean;
  is_overrun_risk: boolean | null;
}

export interface ProjectRiskFlags {
  non_submission_warning: NonSubmissionWarningFlag;
  budget_underutilization: BudgetUnderutilizationFlag;
  deliverable_slippage: DeliverableSlippageFlag;
  personnel_change_frequency: PersonnelChangeFrequencyFlag;
  forecast_overrun: ForecastOverrunFlag;
}

export interface ProjectRiskStatus {
  project: number;
  project_code: string;
  risk_level: RiskLevel;
  flagged_count: number;
  flags: ProjectRiskFlags;
}

export interface RiskDashboard {
  total_projects: number;
  by_risk_level: Record<RiskLevel, number>;
  flagged_projects: ProjectRiskStatus[];
}
