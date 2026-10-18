export type LineItemCategory = "ps" | "mooe" | "co";
export type BudgetStatus = "draft" | "endorsed" | "returned" | "certified";

export type LibAllocation = { period: string; amount: string };

export interface LineItem {
  id: number;
  budget: number;
  category: LineItemCategory;
  description: string;
  amount: string;
  unit: string;
  quantity: string | null;
  unit_cost: string | null;
  fiscal_year: number | null;
  funding_source: string;
  is_counterpart: boolean;
  justification: string;
  q1_amount: string | null;
  q2_amount: string | null;
  q3_amount: string | null;
  q4_amount: string | null;
  /** Per-year (Y1..Yn) or per-quarter (Q1-Q4) split of `amount`; empty on older items */
  allocations: LibAllocation[];
  is_app_flagged: boolean;
  created_at: string;
}

export interface LineItemBudget {
  id: number;
  project: number;
  version_number: number;
  is_current: boolean;
  status: BudgetStatus;
  certified_by: number | null;
  certified_at: string | null;
  certified_by_name: string | null;
  endorsed_by: number | null;
  endorsed_at: string | null;
  endorsed_by_name: string | null;
  created_at: string;
  line_items: LineItem[];
  total_amount: string;
  exceeds_dry_cap: boolean;
  reviews: BudgetReview[];
}

export type BudgetReviewAction = "endorsed" | "returned" | "resubmitted" | "certified";

export interface BudgetReview {
  id: number;
  action: BudgetReviewAction;
  remarks: string;
  acted_by: number;
  acted_by_name: string;
  acted_at: string;
}
