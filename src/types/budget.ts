export type LineItemCategory = "ps" | "mooe" | "co";
export type BudgetStatus = "draft" | "certified";

export interface LineItem {
  id: number;
  budget: number;
  category: LineItemCategory;
  description: string;
  amount: string;
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
}
