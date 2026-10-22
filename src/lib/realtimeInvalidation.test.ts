import { describe, expect, it } from "vitest";
import { REALTIME_REFETCH_EVENTS, keysToRefetch } from "./realtimeInvalidation";

describe("keysToRefetch", () => {
  it("refetches the LIB list, summaries, projects and financial data on a LIB step", () => {
    expect(keysToRefetch(["budget.lib.updated"])).toEqual([["budgets"], ["budget-summary"], ["projects"], ["financial"]]);
  });

  it("lists each key once for several events", () => {
    const keys = keysToRefetch(["budget.lib.updated", "financial.realignment.created", "financial.realignment.reviewed"]);
    expect(keys.map((k) => JSON.stringify(k))).toEqual([...new Set(keys.map((k) => JSON.stringify(k)))]);
    expect(keys).toHaveLength(4);
  });

  it("refetches tasks, Work Logs, workload and milestones when a task changes", () => {
    expect(keysToRefetch(["personnel.task.changed"])).toEqual([["tasks"], ["task-updates"], ["workload"], ["milestones"]]);
  });

  it("ignores unmapped events and refetches everything mapped after a reconnect", () => {
    expect(keysToRefetch(["procurement.updated"])).toEqual([]);
    expect(keysToRefetch(["realtime.reconnected"], true)).toEqual(keysToRefetch(REALTIME_REFETCH_EVENTS));
  });
});
