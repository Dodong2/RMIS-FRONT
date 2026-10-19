import { describe, expect, it } from "vitest";
import { plannedHoursLabel, workingDays } from "./taskHours";

describe("workingDays", () => {
  it("counts Mon-Fri, both ends included", () => {
    expect(workingDays("2026-10-19", "2026-10-23")).toBe(5);
    expect(workingDays("2026-10-23", "2026-10-26")).toBe(2);
    expect(workingDays("2026-10-19", "2026-10-19")).toBe(1);
    expect(workingDays("2026-10-19", "2026-10-30")).toBe(10);
  });

  it("is 0 for a weekend-only, backwards or incomplete range", () => {
    expect(workingDays("2026-10-24", "2026-10-25")).toBe(0);
    expect(workingDays("2026-10-23", "2026-10-19")).toBe(0);
    expect(workingDays("", "2026-10-19")).toBe(0);
  });
});

describe("plannedHoursLabel", () => {
  it("shows the planned hours or why there are none", () => {
    expect(plannedHoursLabel("2026-10-19", "2026-10-23")).toBe("Planned: 5 working days × 8h = 40h");
    expect(plannedHoursLabel("2026-10-24", "2026-10-25")).toContain("at least one working day");
    expect(plannedHoursLabel("2026-10-23", "2026-10-19")).toContain("can't be before");
  });
});
