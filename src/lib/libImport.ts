import type { LibImportRow } from "../types/research";

type LibTableRow = { description: string; specification?: string; quantity: string; unit_cost: string };

/** Task 12: rows of an imported LIB workbook as Step 4's LIB rows (allocations keyed by period). */
export const libRowsFromImport = (rows: LibImportRow[]) =>
  rows.map((r) => ({
    category: r.category,
    description: r.description,
    specification: r.specification,
    unit: r.unit,
    quantity: r.quantity,
    unit_cost: r.unit_cost,
    allocations: Object.fromEntries(r.allocations.map((a) => [a.period, a.amount])),
  }));

/** Whether the LIB table has anything typed in it, so an import must ask before replacing it. */
export const libTableHasEntries = (rows: LibTableRow[]) =>
  rows.some((r) => [r.description, r.specification ?? "", r.quantity, r.unit_cost].some((v) => v.trim() !== ""));
