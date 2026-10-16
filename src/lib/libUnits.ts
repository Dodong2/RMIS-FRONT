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

/** LIB allocation periods (client meeting 2026-10-14), mirrors budget_lib.models.allocation_periods: Y1..Yn for a project
 * longer than 12 months (years rounded up), Q1-Q4 for a one-year project, null until both dates are set. */
export const allocationPeriods = (start: string, end: string): string[] | null => {
  if (!start || !end || end < start) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const months = (ey - sy) * 12 + em - sm + (ed >= sd ? 1 : 0);
  if (months <= 12) return ["Q1", "Q2", "Q3", "Q4"];
  return Array.from({ length: Math.ceil(months / 12) }, (_, i) => `Y${i + 1}`);
};

/** Total = Qty x Unit Cost, rounded to centavos like the backend. */
export const libLineTotal = (quantity: string | number, unitCost: string | number) =>
  Math.round((Number(quantity) || 0) * (Number(unitCost) || 0) * 100) / 100;
