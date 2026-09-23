export type CriterionMetricKey =
  | "output_score"
  | "compliance_score"
  | "budget_utilization_pct"
  | "monitoring_health"
  | "renewal_eligible"
  | "overrun_risk_inverse";

export interface DecisionCriterion {
  id: number;
  name: string;
  metric_key: CriterionMetricKey;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface AHPPairwiseComparison {
  id: number;
  run: number;
  criterion_row: number;
  criterion_col: number;
  value: number;
}

export type AHPRunStatus = "draft" | "finalized";

export interface AHPMatrixRun {
  id: number;
  label: string;
  criteria: number[];
  created_by: number;
  created_at: string;
  status: AHPRunStatus;
  weights: Record<string, number>;
  consistency_ratio: number | null;
  is_consistent: boolean | null;
  comparisons: AHPPairwiseComparison[];
}

export interface ProjectScore {
  id: number;
  run: number;
  project: number;
  raw_scores: Record<string, number>;
  normalized_scores: Record<string, number>;
  composite_score: number;
  rank: number;
}

export interface FundingRecommendationRun {
  id: number;
  ahp_run: number;
  label: string;
  funding_type_filter: string;
  campus_filter: string;
  created_by: number;
  created_at: string;
  scores: ProjectScore[];
}

export interface SensitivityResultRow {
  project: number;
  original_composite: number;
  original_rank: number;
  adjusted_composite: number;
  adjusted_rank: number;
  rank_change: number;
}

export interface SensitivityAnalysisResult {
  criterion_id: number;
  old_weight: number;
  new_weight: number;
  adjusted_weights: Record<string, number>;
  results: SensitivityResultRow[];
}
