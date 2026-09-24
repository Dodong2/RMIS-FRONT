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

export type ProcurementStatus = "requested" | "processing" | "released" | "cancelled";

export interface ProcurementRequest {
  id: number;
  project: number;
  line_item: number;
  description: string;
  amount: string;
  fiscal_year: number;
  quarter: 1 | 2 | 3 | 4;
  routed_to: string;
  status: ProcurementStatus;
  remarks: string;
  requested_by: number;
  requested_at: string;
  processing_at: string | null;
  released_at: string | null;
  updated_by: number | null;
}
