import type { ProcurementYearBalance } from "../types/financial";

export type ItemTotals = { approved: number; committed: number; paid: number; unpaid: number; available: number };

const KEYS = ["approved", "committed", "paid", "unpaid", "available"] as const;

/** Client Task 48: one LIB item's figures over all its project years, from the backend's year_balance() (never
 * recomputed here). Available = Approved - Committed; Committed already includes Paid, so nothing counts twice. */
export const itemTotals = (years: ProcurementYearBalance[]): ItemTotals =>
  Object.fromEntries(
    KEYS.map((key) => [key, Math.round(years.reduce((sum, y) => sum + (Number(y[key]) || 0), 0) * 100) / 100]),
  ) as ItemTotals;
