import { describe, expect, it } from "vitest";
import { allocatedTotal, allocationPeriods, groupLibRows, libLineTotal } from "./libUnits";

const CATEGORIES = [
  { key: "ps", label: "Personal Services (PS)" },
  { key: "mooe", label: "Maintenance and Other Operating Expenses (MOOE)" },
  { key: "co", label: "Equipment Outlay / Capital Outlay (CO)" },
];
type Row = { category: string; description: string; quantity: string; unit_cost: string; allocations?: Record<string, string> };
const row = (category: string, description: string, quantity: string, unit_cost: string, allocations?: Record<string, string>): Row => ({
  category, description, quantity, unit_cost, allocations,
});
const total = (r: Row) => libLineTotal(r.quantity, r.unit_cost);

describe("groupLibRows (client 2026-10-23: PS / MOOE / CO inside the Allocation per Quarter table)", () => {
  const rows = [
    row("mooe", "Traveling Expenses - Local", "4", "2500"),
    row("ps", "Honoraria", "12", "5000"),
    row("co", "Office Equipment", "1", "45000"),
    row("mooe", "Training Expenses", "1", "10000"),
    row("ps", "", "", ""),
  ];

  it("keeps the PS, MOOE, CO order and each row's index in the LIB", () => {
    const groups = groupLibRows(rows, CATEGORIES, total);
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.index)])).toEqual([["ps", [1, 4]], ["mooe", [0, 3]], ["co", [2]]]);
  });

  it("shows a category with no items and a just-added blank item", () => {
    const groups = groupLibRows([row("ps", "", "", "")], CATEGORIES, total);
    expect(groups.map((g) => g.rows.length)).toEqual([1, 0, 0]);
  });

  it("subtotals each category; the subtotals add up to the grand total", () => {
    const groups = groupLibRows(rows, CATEGORIES, total);
    expect(groups.map((g) => g.subtotal)).toEqual([60000, 20000, 45000]);
    expect(groups.reduce((sum, g) => sum + g.subtotal, 0)).toBe(rows.reduce((sum, r) => sum + total(r), 0));
  });

  it("removing an item leaves the other items and their allocations as they were", () => {
    const split = { Y1Q1: "5000", Y2Q1: "5000" };
    const lib = [row("mooe", "Training Expenses", "1", "10000", split), row("ps", "Honoraria", "1", "1000", { Y1Q1: "1000" })];

    const after = groupLibRows(lib.filter((_, i) => i !== 1), CATEGORIES, total);

    expect(after[1].rows[0].row.allocations).toBe(split);
    expect(after[0].rows).toEqual([]);
  });
});

describe("unchanged LIB math", () => {
  it("Total = Qty x Unit Cost and the split per quarter of each project year", () => {
    expect(libLineTotal("3", "1234.565")).toBe(3703.7);
    expect(allocationPeriods("2026-01-01", "2027-06-30")).toEqual(["Y1Q1", "Y1Q2", "Y1Q3", "Y1Q4", "Y2Q1", "Y2Q2"]);
    expect(allocatedTotal({ Y1Q1: "5000", Y2Q1: "2500.5", Y9Q1: "99" }, ["Y1Q1", "Y2Q1"])).toBe(7500.5);
  });
});
