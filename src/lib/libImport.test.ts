import { describe, expect, it } from "vitest";
import { libRowsFromImport, libTableHasEntries } from "./libImport";

describe("LIB Excel import (Task 12)", () => {
  it("maps each imported column to the same LIB row field and each amount to its period", () => {
    const rows = libRowsFromImport([
      {
        category: "co", description: "Office Equipment", specification: "Printer with Scanner (3 in 1)", unit: "unit", quantity: "2",
        unit_cost: "15000", amount: "30000.00",
        allocations: [{ period: "Y1Q1", amount: "0.00" }, { period: "Y1Q2", amount: "30000.00" }, { period: "Y2Q1", amount: "0.00" }],
      },
    ]);
    expect(rows).toEqual([{
      category: "co", description: "Office Equipment", specification: "Printer with Scanner (3 in 1)", unit: "unit", quantity: "2",
      unit_cost: "15000", allocations: { Y1Q1: "0.00", Y1Q2: "30000.00", Y2Q1: "0.00" },
    }]);
  });

  it("asks before replacing only when the table has something typed", () => {
    const blank = { description: "", quantity: "", unit_cost: "" };
    expect(libTableHasEntries([])).toBe(false);
    expect(libTableHasEntries([blank, { ...blank, specification: " " }])).toBe(false);
    expect(libTableHasEntries([blank, { ...blank, unit_cost: "100" }])).toBe(true);
    expect(libTableHasEntries([{ ...blank, description: "Training Expenses" }])).toBe(true);
  });
});
