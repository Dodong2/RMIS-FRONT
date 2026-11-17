import { describe, expect, it } from "vitest";

import { realignmentClosedReason } from "./realignment";

describe("realignmentClosedReason", () => {
  it("stays open with no end date", () => {
    expect(realignmentClosedReason(null)).toBeNull();
  });

  it("stays open up to the deadline day (end date - 60 days)", () => {
    expect(realignmentClosedReason("2026-12-31", new Date(2026, 10, 1))).toBeNull();
  });

  it("closes the day after the deadline and for ended projects", () => {
    const msg = "Realignment closed: requests must be filed at least 60 days before the target end date (2026-12-31).";
    expect(realignmentClosedReason("2026-12-31", new Date(2026, 10, 2))).toBe(msg);
    expect(realignmentClosedReason("2025-12-31", new Date(2026, 10, 17))).toContain("2025-12-31");
  });
});
