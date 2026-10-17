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

/** LIB allocation periods, mirrors budget_lib.models.allocation_periods: the quarters the project covers from its start date
 * (client 2026-10-14 + yearly.png 2026-10-17). Q1..Qk for 12 months or less, Y1Q1..YnQm for a longer project; null until
 * both dates are set. */
export const allocationPeriods = (start: string, end: string): string[] | null => {
  if (!start || !end || end < start) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const months = (ey - sy) * 12 + em - sm + (ed >= sd ? 1 : 0);
  const quarters = Math.ceil(months / 3);
  if (months <= 12) return Array.from({ length: quarters }, (_, i) => `Q${i + 1}`);
  return Array.from({ length: quarters }, (_, i) => `Y${Math.floor(i / 4) + 1}Q${(i % 4) + 1}`);
};

/** Project year of a period: Y2Q3 -> 2, Q3 -> 1. */
export const periodYear = (p: string) => (p[0] === "Y" ? Number(p.slice(1, p.indexOf("Q"))) : 1);

/** Quarter part of a period: Y2Q3 -> "Q3". */
export const periodQuarter = (p: string) => p.slice(p.indexOf("Q"));

/** Y2Q3 -> "Y2 Q3", Q3 -> "Q3". */
export const periodLabel = (p: string) => (p[0] === "Y" ? `Y${periodYear(p)} ${periodQuarter(p)}` : p);

/** Sum of an item's split over the given periods, rounded to centavos. */
export const allocatedTotal = (allocations: Record<string, string> | undefined, periods: string[]) =>
  Math.round(periods.reduce((sum, p) => sum + (Number(allocations?.[p]) || 0), 0) * 100) / 100;

/** Total = Qty x Unit Cost, rounded to centavos like the backend. */
export const libLineTotal = (quantity: string | number, unitCost: string | number) =>
  Math.round((Number(quantity) || 0) * (Number(unitCost) || 0) * 100) / 100;
