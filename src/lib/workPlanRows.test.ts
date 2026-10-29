import { describe, expect, it } from "vitest";
import { duplicateWorkPlanRows } from "./workPlanRows";

const row = (title: string, start_date: string, target_date: string) => ({ title, start_date, target_date });

describe("duplicateWorkPlanRows (Work Plan import, client 2026-10-29)", () => {
  const table = [row("Logistic preparations", "2026-01-01", "2026-03-31"), row("Reporting", "", "2026-12-15"), row("", "", "")];

  it("flags the same activity and dates, ignoring case, spacing and a trailing dot", () => {
    const incoming = [row("  logistic   PREPARATIONS. ", "2026-01-01", "2026-03-31"), row("Reporting", "", "2026-12-15")];
    expect(duplicateWorkPlanRows(table, incoming)).toEqual(incoming);
  });

  it("lets the same name with other dates, and new activities, through", () => {
    const incoming = [row("Logistic preparations", "2026-04-01", "2026-06-30"), row("Data analysis", "2026-07-01", "2026-09-30")];
    expect(duplicateWorkPlanRows(table, incoming)).toEqual([]);
  });

  it("ignores the blank rows of the table", () => {
    expect(duplicateWorkPlanRows(table, [row("", "", "")])).toEqual([]);
  });
});
