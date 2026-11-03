import type { AllocationGridGroup } from "../components/registration/LibAllocationGrid";
import type { LineItem, LineItemCategory } from "../types/budget";
import { periodQuarter, periodYear } from "./libUnits";

/** The periods of a saved LIB (Q1..Q4 or Y1Q1..YnQ4), in year then quarter order. */
export function savedPeriods(items: LineItem[]): string[] {
  const periods = [...new Set(items.flatMap((i) => i.allocations.map((a) => a.period)))];
  const order = (p: string) => periodYear(p) * 10 + Number(periodQuarter(p).slice(1));
  return periods.sort((a, b) => order(a) - order(b));
}

/** A saved LIB as the Step 4 table's groups: row index = the item's position in `items`. */
export function savedGroups(items: LineItem[], categories: { key: LineItemCategory; label: string }[]): AllocationGridGroup[] {
  return categories.map(({ key, label }) => {
    const rows = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.category === key)
      .map(({ item, index }) => ({
        index,
        description: item.description,
        total: Number(item.amount),
        allocations: Object.fromEntries(item.allocations.map((a) => [a.period, String(a.amount)])),
      }));
    return { key, label, subtotal: Math.round(rows.reduce((sum, r) => sum + r.total, 0) * 100) / 100, rows };
  });
}
