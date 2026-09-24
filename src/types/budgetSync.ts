import type { BudgetOfficeMatchStatus } from "./monitoring";

export interface BudgetOfficeImport {
  id: number;
  file_name: string;
  uploaded_by: number;
  uploaded_at: string;
  record_count: number;
}

export type BudgetOfficeMatchMethod = "auto" | "manual" | "";

export interface BudgetOfficeRecord {
  id: number;
  source: number;
  sheet_name: string;
  title: string;
  leader_name: string;
  implementing_unit: string;
  mooe_total: string;
  co_total: string;
  grand_total: string;
  project: number | null;
  match_method: BudgetOfficeMatchMethod;
}

interface SyncTotals {
  mooe_total: number;
  co_total: number;
  grand_total: number;
}

export interface ReconciliationRow {
  record: number;
  sheet_name: string;
  title: string;
  project: number | null;
  match_method: BudgetOfficeMatchMethod;
  budget_office: SyncTotals;
  rmis: (SyncTotals & { budget: number }) | null;
  difference: SyncTotals | null;
  status: BudgetOfficeMatchStatus;
}

export interface Reconciliation {
  import: number;
  summary: Record<BudgetOfficeMatchStatus, number>;
  records: ReconciliationRow[];
}
