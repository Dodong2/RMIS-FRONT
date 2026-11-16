import { describe, expect, it } from "vitest";
import { FOR_APPROVAL_STATUSES, showsLifecycle, summaryGroup } from "./projectStatus";
import type { RecordStatus, ReviewStatus } from "../types/research";

const p = (review_status: ReviewStatus, status: RecordStatus = "active") => ({ status, review_status });

describe("summaryGroup (Task 62)", () => {
  it("puts exactly the four client statuses under For Approval", () => {
    expect([...FOR_APPROVAL_STATUSES].sort()).toEqual(["for_budget_review", "pending_budget_review", "pending_research_review", "returned_budget"]);
    for (const s of FOR_APPROVAL_STATUSES) expect(summaryGroup(p(s))).toBe("for_approval");
  });

  it("is Ongoing only when Finance certified the LIB", () => {
    expect(summaryGroup(p("reviews_completed"))).toBe("active");
    expect(showsLifecycle(p("reviews_completed"))).toBe(true);
    expect(showsLifecycle(p("for_budget_review"))).toBe(false);
  });

  it("counts Draft, Submitted and Returned - CRC/CRD in no group", () => {
    for (const s of ["draft", "submitted", "returned_research"] as const) {
      expect(summaryGroup(p(s))).toBeNull();
      expect(showsLifecycle(p(s))).toBe(false);
    }
  });

  it("keeps Completed and Closed from the project status", () => {
    expect(summaryGroup(p("reviews_completed", "completed"))).toBe("completed");
    expect(summaryGroup(p("reviews_completed", "archived"))).toBe("archived");
  });

  it("counts each project once (15 For Budget Review + 3 Active like the current data)", () => {
    const list = [...Array(15).fill(p("for_budget_review")), ...Array(3).fill(p("reviews_completed"))];
    const counts = list.reduce<Record<string, number>>((a, x) => ({ ...a, [String(summaryGroup(x))]: (a[String(summaryGroup(x))] ?? 0) + 1 }), {});
    expect(counts).toEqual({ for_approval: 15, active: 3 });
  });
});
