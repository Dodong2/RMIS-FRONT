import { describe, expect, it } from "vitest";
import type { LineItem } from "../types/budget";
import { savedGroups, savedPeriods } from "./libGrid";

const item = (id: number, category: "ps" | "mooe" | "co", amount: string, allocations: [string, string][]) =>
  ({ id, category, description: `Item ${id}`, amount, allocations: allocations.map(([period, a]) => ({ period, amount: a })) }) as unknown as LineItem;

describe("saved LIB as the Step 4 table (client Task 33)", () => {
  const items = [
    item(1, "mooe", "1000.00", [["Y2Q1", "400.00"], ["Y1Q2", "600.00"]]),
    item(2, "ps", "500.00", [["Y1Q1", "500.00"]]),
    item(3, "mooe", "250.50", []),
  ];

  it("lists every period once, year then quarter", () => {
    expect(savedPeriods(items)).toEqual(["Y1Q1", "Y1Q2", "Y2Q1"]);
    expect(savedPeriods([item(4, "co", "1", [["Q3", "1"], ["Q1", "0"]])])).toEqual(["Q1", "Q3"]);
  });

  it("groups the items by category with their saved totals and allocations", () => {
    const groups = savedGroups(items, [{ key: "ps", label: "PS" }, { key: "mooe", label: "MOOE" }, { key: "co", label: "CO" }]);
    expect(groups.map((g) => [g.key, g.subtotal, g.rows.map((r) => r.index)])).toEqual([["ps", 500, [1]], ["mooe", 1250.5, [0, 2]], ["co", 0, []]]);
    expect(groups[1].rows[0]).toEqual({ index: 0, description: "Item 1", total: 1000, allocations: { Y2Q1: "400.00", Y1Q2: "600.00" } });
  });
});
