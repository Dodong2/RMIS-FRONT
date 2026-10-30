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
  payee: string;
  supporting_document: number | null;
  funding_source: string;
  disbursed_on: string;
  recorded_by: number;
  procurement_request: number | null;
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
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  bor_resolution_number: string;
  batch: string | null;
  created_at: string;
}

export interface BalanceFigures {
  approved: number;
  adjusted: number;
  actual: number;
  available: number;
  utilization_pct: number | null;
}

export interface LineItemBalance extends BalanceFigures {
  line_item: number;
  category: LineItemCategory;
  description: string;
  fiscal_year: number | null;
  funding_source: string;
  is_counterpart: boolean;
}

export interface BudgetSummary {
  budget: number;
  project: number;
  line_items: LineItemBalance[];
  by_category: (BalanceFigures & { category: LineItemCategory })[];
  by_funding_source: (BalanceFigures & { funding_source: string })[];
  totals: BalanceFigures;
}

export type ProcurementStatus =
  | "requested"
  | "under_review"
  | "returned_for_revision"
  | "for_procurement"
  | "procurement_in_progress"
  | "order_placed"
  | "awaiting_delivery"
  | "delivered"
  | "ready_for_release"
  | "completed"
  | "cancelled";

export type ProcurementUpdateStatus = Exclude<ProcurementStatus, "requested" | "under_review" | "cancelled">;

export interface ProcurementQuarterBalance {
  quarter: number;
  allocation: number | string;
  committed: number | string;
  remaining: number | string;
}

export interface ProcurementYearBalance {
  year: number;
  approved: number | string;
  committed: number | string;
  paid: number | string;
  unpaid: number | string;
  available: number | string;
  quarters: ProcurementQuarterBalance[];
}

export interface ProcurementBalance {
  line_item: number;
  years: ProcurementYearBalance[];
}

export interface InsufficientBudget {
  code: "insufficient_budget";
  detail: string;
  requested: number | string;
  year: number | string;
  approved: number | string;
  committed: number | string;
  paid: number | string;
  unpaid: number | string;
  available: number | string;
}

export interface ProcurementRequest {
  id: number;
  project: number;
  line_item: number;
  description: string;
  amount: string;
  project_year: number | null;
  fiscal_year: number | null;
  quarter: 1 | 2 | 3 | 4 | null;
  routed_to: string;
  status: ProcurementStatus;
  remarks: string;
  requested_by: number;
  requested_by_name: string;
  requested_at: string;
  received_by: number | null;
  received_by_name: string | null;
  received_by_role: string | null;
  received_at: string | null;
  completed_at: string | null;
  updated_by: number | null;
}
