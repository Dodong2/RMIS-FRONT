import { describe, expect, it } from "vitest";
import { itemTotals } from "./procurementBalance";
import type { ProcurementYearBalance } from "../types/financial";

const year = (y: number, approved: string, committed: string, paid: string): ProcurementYearBalance => ({
  year: y, approved, committed, paid,
  unpaid: String(Number(committed) - Number(paid)),
  available: String(Number(approved) - Number(committed)),
  quarters: [],
});

describe("itemTotals (client Task 48)", () => {
  it("adds the backend's figures of every project year", () => {
    expect(itemTotals([year(1, "100000.00", "30000.00", "0"), year(2, "100000.00", "20000.00", "20000.00")])).toEqual({
      approved: 200000, committed: 50000, paid: 20000, unpaid: 30000, available: 150000,
    });
  });

  it("a payment moves Unpaid to Paid without lowering Available again", () => {
    const filed = itemTotals([year(1, "100000.00", "30000.00", "0")]);
    const paid = itemTotals([year(1, "100000.00", "30000.00", "30000.00")]);
    expect([filed.available, paid.available]).toEqual([70000, 70000]);
    expect([filed.unpaid, paid.unpaid, paid.paid]).toEqual([30000, 0, 30000]);
  });

  it("keeps centavos exact", () => {
    expect(itemTotals([year(1, "0.10", "0", "0"), year(2, "0.20", "0", "0")]).available).toBe(0.3);
  });

  it("an item with no years has nothing available", () => {
    expect(itemTotals([]).available).toBe(0);
  });
});
