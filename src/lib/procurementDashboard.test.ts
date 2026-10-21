import { describe, expect, it } from "vitest";
import type { ProcurementDashRow } from "../types/dashboard";
import {
  NO_FILTERS,
  analytics,
  campusWorkload,
  dayBuckets,
  exceptions,
  filterRows,
  monthly,
  overview,
  releasedByCategory,
  releasedByProject,
  toCsv,
} from "./procurementDashboard";

const row = (over: Partial<ProcurementDashRow>): ProcurementDashRow =>
  ({
    id: 1, request_no: "PR-0001", project: 1, project_code: "P-1", campus: "Siniloan", college: "CCS", line_item: 10,
    lib_item: "Office Supplies Expenses", category: "mooe", amount: "1000.00", status: "requested", requested_at: "2026-10-05T02:00:00Z",
    lib_adjusted: "10000.00", lib_uncommitted: "5000.00", available: "6000.00", exceeds_available: false, released: 0,
    processing_days: 1, returned_count: 0, ...over,
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

describe("analytics", () => {
  it("counts each LIB line item once and leaves cancelled requests out", () => {
    const a = analytics(rows);
    expect(a.libTotal).toBe(15000); // 10,000 + 5,000, not 10,000 three times
    expect(a.remaining).toBe(6000); // 5,000 + 1,000
    expect(a.released).toBe(3000);
    expect(a.utilizationPct).toBe(20); // 3,000 / 15,000
    expect(a.pending).toBe(1);
    expect([a.completed, a.completionPct]).toEqual([1, 33]); // 1 of 3 non-cancelled
    expect(a.avgProcessingDays).toBe(5); // completed requests only
    expect(a.funnel).toEqual({ requested: 9000, received: 9000, released: 3000 });
  });

  it("has no average or percentages without data", () => {
    const a = analytics([]);
    expect([a.avgProcessingDays, a.utilizationPct, a.completionPct]).toEqual([null, 0, 0]);
  });

  it("leaves submitted and returned requests out of Received", () => {
    const a = analytics([row({ amount: "100", status: "requested" }), row({ id: 2, amount: "200", status: "returned_for_revision" }), row({ id: 3, amount: "300", status: "order_placed" })]);
    expect(a.funnel).toEqual({ requested: 600, received: 300, released: 0 });
  });
});

describe("breakdowns", () => {
  it("groups released value by project and by class", () => {
    const withMore = [...rows, row({ id: 7, project_code: "P-2", released: "5000.00", status: "completed", category: "co" })];
    expect(releasedByProject(withMore)).toEqual([{ project_code: "P-2", value: 5000 }, { project_code: "P-1", value: 3000 }]);
    expect(releasedByCategory(withMore)).toEqual([{ category: "ps", value: 0 }, { category: "mooe", value: 3000 }, { category: "co", value: 5000 }]);
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

describe("exceptions", () => {
  it("flags over-balance, overdue open and repeatedly returned requests", () => {
    const flagged = exceptions(
      [
        row({ id: 1, exceeds_available: true }),
        row({ id: 2, processing_days: 31 }),
        row({ id: 3, processing_days: 31, status: "completed" }), // closed: not overdue
        row({ id: 4, returned_count: 2 }),
      ],
      30,
    );
    expect(flagged.map((f) => [f.row.id, f.severity])).toEqual([[1, "critical"], [2, "warning"], [4, "warning"]]);
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
