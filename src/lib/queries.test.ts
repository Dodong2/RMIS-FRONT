import { describe, expect, it } from "vitest";
import { STATUS_SYNC, budgetsQuery, documentsQuery, projectsQuery } from "./queries";

describe("status sync fallback (Task 21, 2026-10-30)", () => {
  it("refetches projects and budgets on tab focus and every minute", () => {
    for (const options of [projectsQuery, budgetsQuery(), budgetsQuery(7)]) {
      expect(options.refetchOnWindowFocus).toBe(true);
      expect(options.refetchInterval).toBe(60_000);
    }
    expect(STATUS_SYNC.refetchInterval).toBe(60_000);
  });

  it("leaves other queries on the app defaults", () => {
    const docs = documentsQuery({ project: 1 });
    expect(docs.refetchOnWindowFocus).toBeUndefined();
    expect(docs.refetchInterval).toBeUndefined();
  });
});
