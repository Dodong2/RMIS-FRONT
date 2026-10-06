/** LIB line item units (client feedback 2026-10-06); mirrors LineItem.UNIT_CHOICES in budget_lib/models.py. */
export const LIB_UNITS = [
  ["unit", "unit"],
  ["month", "month"],
  ["lump_sum", "lump sum"],
  ["pax", "pax"],
  ["lot", "lot"],
  ["set", "set"],
  ["hr", "hr"],
] as const;

export const libUnitLabel = (code: string) => LIB_UNITS.find(([c]) => c === code)?.[1] ?? "";

/** Total = Qty x Unit Cost, rounded to centavos like the backend. */
export const libLineTotal = (quantity: string | number, unitCost: string | number) =>
  Math.round((Number(quantity) || 0) * (Number(unitCost) || 0) * 100) / 100;
