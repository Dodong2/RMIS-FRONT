import type { LineItemCategory } from "./budget";

export type RealignmentTier = "minor" | "major" | "bor";
export type RealignmentStatus =
  | "implemented"
  | "pending_approval"
  | "approved"
  | "pending_bor"
  | "bor_approved"
  | "rejected";

export interface Disbursement {
  id: number;
  line_item: number;
  amount: string;
  reference_number: string;
  description: string;
  disbursed_on: string;
  recorded_by: number;
  created_at: string;
}

export interface BudgetRealignment {
  id: number;
  from_line_item: number;
  to_line_item: number | null;
  new_item_category: LineItemCategory | "";
  new_item_description: string;
  amount: string;
  tier: RealignmentTier;
  status: RealignmentStatus;
  justification: string;
  requested_by: number;
  reviewed_by: number | null;
  reviewed_at: string | null;
  bor_resolution_number: string;
  created_at: string;
}

export interface LineItemBalance {
  line_item: number;
  category: LineItemCategory;
  description: string;
  approved: string;
  adjusted: string;
  actual: string;
  available: string;
}

export interface BudgetSummary {
  budget: number;
  project: number;
  line_items: LineItemBalance[];
  totals: {
    approved: string;
    adjusted: string;
    actual: string;
    available: string;
  };
}
