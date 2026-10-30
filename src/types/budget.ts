export type LineItemCategory = "ps" | "mooe" | "co";
/** Client 2026-10-21 LIB workflow: endorsed = Ready for Certification, certifying = In Progress, returned = On Hold. */
export type BudgetStatus = "draft" | "submitted" | "crc_processing" | "for_checking" | "endorsed" | "certifying" | "returned" | "certified";

export type LibAllocation = { period: string; amount: string };

/** System Admin > LIB Items (client 2026-10-20): the items a line item picks from, under a fixed PS/MOOE/CO class. */
export interface LibItem {
  id: number;
  category: LineItemCategory;
  name: string;
  uacs_code: string;
  is_active: boolean;
  created_at: string;
}

export type LibItemInput = Pick<LibItem, "category" | "name" | "uacs_code" | "is_active">;

export interface LineItem {
  id: number;
  budget: number;
  category: LineItemCategory;
  description: string;
  /** Task 12: SF-018 Section X's specific item under the LIB Item, e.g. "PAPER, 80 gsm"; "" when none */
  specification: string;
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
  /** Task 20: Finance/Accounting/Budget changes to this item, oldest first */
  edits: LineItemEdit[];
}

/** Task 20 (2026-10-30): one Update This LIB change. changes = {field: [old, new]}; allocations as period lists. */
export interface LineItemEdit {
  id: number;
  changes: Record<string, [string | LibAllocation[], string | LibAllocation[]]>;
  reason: string;
  edited_by: number;
  edited_by_name: string;
  edited_at: string;
}

/** POST budgets/<id>/finance-edit/: only the changed fields of an existing item, with the reason. */
export interface FinanceEditRow {
  id: number;
  reason: string;
  specification?: string;
  unit?: string;
  quantity?: string;
  unit_cost?: string;
  allocations?: LibAllocation[];
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
  /** Who put an On Hold LIB on hold; null otherwise or for an older return. */
  hold_level: "crc" | "budget" | null;
  reviews: BudgetReview[];
}

export type BudgetStep = "submit" | "for-checking" | "start-certification" | "certify" | "hold" | "resubmit" | "comment";

export type BudgetReviewAction =
  | "submitted"
  | "review_started"
  | "for_checking"
  | "ready"
  | "certification_started"
  | "held_crc"
  | "held_budget"
  | "resubmitted"
  | "certified"
  | "endorsed"
  | "returned"
  | "commented";

export interface BudgetReview {
  id: number;
  action: BudgetReviewAction;
  remarks: string;
  /** The line items as submitted/resubmitted (client Q11); empty for other steps. */
  snapshot: Omit<LineItem, "budget">[];
  acted_by: number;
  acted_by_name: string;
  acted_at: string;
}
