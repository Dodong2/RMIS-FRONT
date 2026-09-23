export interface ProjectDashboard {
  total_projects: number;
  by_status: Record<string, number>;
  by_funding_type: Record<string, number>;
  by_campus: Record<string, number>;
}

export interface BudgetDashboard {
  project_count: number;
  total_approved: number;
  total_actual: number;
  utilization_pct: number | null;
}

export interface ComplianceDashboard {
  ethics_reviews_by_status: Record<string, number>;
  similarity_checks: {
    total: number;
    within_threshold: number;
    over_threshold: number;
  };
  ai_use_declarations: number;
  coi_disclosures_by_status: Record<string, number>;
  misconduct_cases_by_status: Record<string, number>;
}

export interface OutputDashboard {
  publications_by_type: Record<string, number>;
  ip_records_by_status: Record<string, number>;
  creative_works_count: number;
  total_estimated_publication_incentive: number;
  ip_incentive_eligible_count: number;
}

export interface REIThrustAlignment {
  by_thrust: Record<string, number>;
  unaligned_count: number;
}

export type PlanningMetric =
  | "completed_projects"
  | "publications"
  | "ip_disclosures"
  | "budget_utilization_pct";

export interface PlanningTarget {
  id: number;
  metric: PlanningMetric;
  campus: string;
  target_year: number;
  target_value: string;
  set_by: number;
  created_at: string;
}

export interface PlanningTargetComparison {
  id: number;
  metric: PlanningMetric;
  campus: string;
  target_year: number;
  target_value: number;
  actual_value: number | null;
  pct_of_target: number | null;
}

export interface AppendixEEntry {
  project_year: number;
  narrative: string;
  expenditure_summary: string;
  submitted_by: number;
  submitted_at: string;
}

export interface AppendixFExport {
  narrative: string;
  submitted_by: number;
  submitted_at: string;
  is_certified: boolean;
  certified_by: number | null;
  certified_at: string | null;
}

export interface AppendixGExport {
  campus: string;
  year: number | null;
  completed_projects: number;
  publications: number;
  ip_records: number;
  creative_works: number;
  monthly_reports_submitted: number;
}
