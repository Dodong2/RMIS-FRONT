export type LineItemCategory = "ps" | "mooe" | "co";
export type BudgetStatus = "draft" | "certified";

export interface LineItem {
  id: number;
  budget: number;
  category: LineItemCategory;
  description: string;
  amount: string;
  fiscal_year: number | null;
  funding_source: string;
  is_counterpart: boolean;
  q1_amount: string | null;
  q2_amount: string | null;
  q3_amount: string | null;
  q4_amount: string | null;
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
  created_at: string;
  line_items: LineItem[];
  total_amount: string;
  exceeds_dry_cap: boolean;
}
