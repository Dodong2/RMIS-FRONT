import { describe, expect, it } from "vitest";
import type { ProcurementDashRow } from "../types/dashboard";
import {
  NO_FILTERS,
  OVERDUE_DAYS,
  analytics,
  campusWorkload,
  dayBuckets,
  exceptions,
  filterRows,
  monthly,
  overview,
  onTrackBy,
  spendingByCategory,
  spendingByProject,
  stageAmounts,
  toCsv,
  topRequestedItems,
} from "./procurementDashboard";

const row = (over: Partial<ProcurementDashRow>): ProcurementDashRow =>
  ({
    id: 1, request_no: "PR-0001", project: 1, project_code: "P-1", campus: "Siniloan", college: "CCS", line_item: 10,
    lib_item: "Office Supplies Expenses", category: "mooe", amount: "1000.00", status: "requested", requested_at: "2026-10-05T02:00:00Z",
    lib_adjusted: "10000.00", lib_uncommitted: "5000.00", available: "6000.00", exceeds_available: false, released: 0,
    processing_days: 1, returned_count: 0, project_leader: "Lea Lim", decided_at: null, ...over,
  }) as ProcurementDashRow;

// Two requests on one 10,000 line item (one released), one on a 5,000 CO item at another campus, one cancelled.
const rows = [
  row({ id: 1, status: "completed", amount: "3000.00", released: "3000.00", processing_days: 5, requested_at: "2026-09-10T02:00:00Z" }),
  row({ id: 2, status: "under_review", amount: "2000.00", processing_days: 2 }),
  row({ id: 3, project: 2, project_code: "P-2", campus: "Santa Cruz", college: "CA", line_item: 20, lib_item: "Office Equipment",
    category: "co", amount: "4000.00", status: "ready_for_release", lib_adjusted: "5000.00", lib_uncommitted: "1000.00",
    processing_days: 9 }),
  row({ id: 4, status: "cancelled", amount: "500.00", processing_days: null }),
];

describe("overview", () => {
  it("counts pending, release queue and open commitments", () => {
    const o = overview([...rows, row({ id: 5, status: "requested", amount: "700" }), row({ id: 6, status: "returned_for_revision" })]);
    expect([o.pending, o.returned, o.forRelease, o.openCount]).toEqual([2, 1, 1, 4]);
    expect(o.forReleaseAmount).toBe(4000);
    // under_review 2000 + ready 4000 + requested 700 + returned 1000; completed and cancelled reserve nothing
    expect(o.activeCommitments).toBe(7700);
  });
});

describe("analytics (client Task 82, Figma Analytics tab)", () => {
  it("computes the seven Figma cards and counts each LIB line item once", () => {
    const a = analytics(rows);
    expect(a.libTotal).toBe(15000); // 10,000 + 5,000, not 10,000 three times
    expect([a.disbursed, a.utilizationPct]).toEqual([3000, 20]); // paid 3,000 / 15,000
    expect(a.pending).toBe(1); // under_review
    // approved = completed + ready_for_release; decided = those two + cancelled
    expect([a.approvedCount, a.decidedCount, a.approvalRatePct]).toEqual([2, 3, 67]);
    expect([a.completed, a.procurementCompletionPct]).toEqual([1, 50]); // 1 completed of 2 approved
    expect([a.paidCount, a.disbursementCompletionPct]).toEqual([1, 50]); // 1 paid of 2 approved
    expect(a.remaining).toBe(6000); // 5,000 + 1,000
    expect(a.avgApprovalDays).toBeNull(); // no decision times recorded
    expect(a.funnel).toEqual({ requested: 9500, approved: 7000, procured: 3000, disbursed: 3000 });
  });

  it("averages submission-to-decision days over decided requests only", () => {
    const a = analytics([
      row({ id: 1, status: "for_procurement", requested_at: "2026-10-01T00:00:00Z", decided_at: "2026-10-04T00:00:00Z" }),
      row({ id: 2, status: "returned_for_revision", requested_at: "2026-10-01T00:00:00Z", decided_at: "2026-10-02T00:00:00Z" }),
      row({ id: 3, status: "under_review" }),
    ]);
    expect(a.avgApprovalDays).toBe(2); // (3 + 1) / 2
    expect([a.approvedCount, a.decidedCount, a.approvalRatePct]).toEqual([1, 2, 50]); // returned = decided, not approved
  });

  it("has no average, percentages or negative balance without data", () => {
    const a = analytics([]);
    expect([a.avgApprovalDays, a.utilizationPct, a.approvalRatePct, a.procurementCompletionPct, a.disbursementCompletionPct]).toEqual([null, 0, 0, 0, 0]);
    expect(analytics([row({ lib_uncommitted: "-200.00" })]).remaining).toBe(0);
  });

  it("gives each request its requested, approved, procured and disbursed amounts", () => {
    expect(stageAmounts(rows[1])).toEqual({ requested: 2000, approved: 0, procured: 0, disbursed: 0 });
    expect(stageAmounts(rows[2])).toEqual({ requested: 4000, approved: 4000, procured: 0, disbursed: 0 });
    expect(stageAmounts(rows[0])).toEqual({ requested: 3000, approved: 3000, procured: 3000, disbursed: 3000 });
  });
});

describe("breakdowns", () => {
  it("groups procured (completed) value by project and by class", () => {
    const withMore = [...rows, row({ id: 7, project_code: "P-2", released: "5000.00", status: "completed", category: "co" })];
    expect(spendingByProject(withMore)).toEqual([{ project_code: "P-1", value: 3000 }, { project_code: "P-2", value: 1000 }]);
    expect(spendingByCategory(withMore)).toEqual([{ category: "ps", value: 0 }, { category: "mooe", value: 3000 }, { category: "co", value: 1000 }]);
  });

  it("buckets processing days and skips rows without any", () => {
    expect(dayBuckets(rows).map((b) => b.count)).toEqual([1, 1, 1, 0]);
    expect(dayBuckets([row({ processing_days: 15 }), row({ processing_days: 40 })]).map((b) => b.count)).toEqual([0, 0, 0, 2]);
  });

  it("groups by month filed, oldest first", () => {
    expect(monthly(rows)).toEqual([{ month: "2026-09", count: 1, amount: 3000 }, { month: "2026-10", count: 3, amount: 6500 }]);
  });

  it("counts open requests per campus", () => {
    expect(campusWorkload(rows)).toEqual([{ campus: "Siniloan", count: 1 }, { campus: "Santa Cruz", count: 1 }]);
  });
});

describe("on track by college and Project Leader (client Task 82)", () => {
  const sample = [
    row({ id: 1, college: "CCS", project_leader: "Ana", status: "under_review", processing_days: OVERDUE_DAYS + 1 }), // overdue
    row({ id: 2, college: "CCS", project_leader: "Ana", status: "completed", processing_days: 20 }), // closed: on track
    row({ id: 3, college: "CA", project_leader: "Ben", status: "order_placed", processing_days: OVERDUE_DAYS }), // not over 12
    row({ id: 4, college: "CA", project_leader: "Ben", status: "cancelled", processing_days: null }), // left out
  ];

  it("ranks colleges by the share of requests not overdue", () => {
    expect(onTrackBy(sample, "college")).toEqual([
      { name: "CA", total: 1, overdue: 0, completed: 0, onTrack: 1, onTrackPct: 100 },
      { name: "CCS", total: 2, overdue: 1, completed: 1, onTrack: 1, onTrackPct: 50 },
    ]);
  });

  it("does the same per Project Leader and names a missing leader", () => {
    expect(onTrackBy([...sample, row({ id: 5, project_leader: "" })], "project_leader").map((g) => [g.name, g.total, g.onTrackPct])).toEqual([
      ["Ben", 1, 100],
      ["No leader", 1, 100],
      ["Ana", 2, 50],
    ]);
  });
});

describe("most requested LIB items (client Task 82)", () => {
  it("counts requests per exact LIB Item within its class and leaves cancelled out", () => {
    const items = topRequestedItems([
      row({ id: 1, project: 1, category: "mooe", lib_item: "Office Supplies Expenses", amount: "1000" }),
      row({ id: 2, project: 2, category: "mooe", lib_item: "Office Supplies Expenses", amount: "500" }),
      row({ id: 3, project: 1, category: "co", lib_item: "Office Supplies Expenses", amount: "200" }),
      row({ id: 4, project: 1, category: "mooe", lib_item: "Office Supplies Expense", amount: "100" }), // similar name, not merged
      row({ id: 5, project: 3, category: "mooe", lib_item: "Office Supplies Expenses", amount: "900", status: "cancelled" }),
    ]);
    expect(items).toEqual([
      { category: "mooe", lib_item: "Office Supplies Expenses", count: 2, amount: 1500, projects: 2 },
      { category: "co", lib_item: "Office Supplies Expenses", count: 1, amount: 200, projects: 1 },
      { category: "mooe", lib_item: "Office Supplies Expense", count: 1, amount: 100, projects: 1 },
    ]);
  });
});

describe("exceptions", () => {
  it("flags over-balance, open over 12 days (Figma) and repeatedly returned requests", () => {
    const flagged = exceptions([
      row({ id: 1, exceeds_available: true }),
      row({ id: 2, processing_days: OVERDUE_DAYS + 1 }),
      row({ id: 3, processing_days: OVERDUE_DAYS }), // exactly 12: not yet overdue
      row({ id: 4, processing_days: 31, status: "completed" }), // closed: not overdue
      row({ id: 5, returned_count: 2 }),
    ]);
    expect(flagged.map((f) => [f.row.id, f.severity])).toEqual([[1, "critical"], [2, "warning"], [5, "warning"]]);
  });
});

describe("filterRows", () => {
  it("filters by campus, project, college, item, status and filing date", () => {
    expect(filterRows(rows, { ...NO_FILTERS, campus: "Santa Cruz" }).map((r) => r.id)).toEqual([3]);
    expect(filterRows(rows, { ...NO_FILTERS, project: "1", status: "completed" }).map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, { ...NO_FILTERS, libItem: "Office Equipment" }).map((r) => r.id)).toEqual([3]);
    expect(filterRows(rows, { ...NO_FILTERS, from: "2026-10-01" }).map((r) => r.id)).toEqual([2, 3, 4]);
    expect(filterRows(rows, { ...NO_FILTERS, to: "2026-09-30" }).map((r) => r.id)).toEqual([1]);
  });
});

it("quotes CSV cells", () => {
  expect(toCsv([["a", 'say "hi"'], [1, "x,y"]])).toBe('"a","say ""hi"""\n"1","x,y"');
});
