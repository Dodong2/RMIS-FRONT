import { describe, expect, it } from "vitest";
import { activityTaskCompletion, ganttQuarters } from "./workplan";
import type { TaskStatus } from "../types/personnel";

const task = (assignee: number, status: TaskStatus, milestone: number | null = 1) => ({ assignee, status, milestone });

describe("activityTaskCompletion", () => {
  it("is the share of the person's activity tasks that are done", () => {
    const tasks = [task(7, "done"), task(7, "done"), task(7, "in_progress"), task(8, "done")];
    expect(activityTaskCompletion(tasks, 7)).toEqual({ done: 2, total: 3, pct: 67 });
  });

  it("ignores tasks not under an activity", () => {
    expect(activityTaskCompletion([task(7, "done", null), task(7, "pending")], 7)).toEqual({ done: 0, total: 1, pct: 0 });
  });

  it("is 0 of 0 when nothing is assigned", () => {
    expect(activityTaskCompletion([task(8, "done")], 7)).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe("ganttQuarters", () => {
  const labels = (start: string, end: string) => ganttQuarters(start, end).map((q) => q.label);

  it("is Q1-Q4 for a one-year project", () => {
    expect(labels("2026-01-01", "2026-12-31")).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });

  it("is every project year's quarters for a two-year project (client 2026-10-24, FRN-2026-005)", () => {
    expect(labels("2026-11-01", "2028-11-01")).toEqual(["Y1 Q1", "Y1 Q2", "Y1 Q3", "Y1 Q4", "Y2 Q1", "Y2 Q2", "Y2 Q3", "Y2 Q4"]);
  });

  it("counts project years from the start date, not calendar years", () => {
    const quarters = ganttQuarters("2026-11-01", "2028-11-01");
    expect(quarters[1].pct).toBeCloseTo((Date.UTC(2027, 1, 1) - Date.UTC(2026, 10, 1)) / (Date.UTC(2028, 10, 1) - Date.UTC(2026, 10, 1)) * 100);
    expect(quarters[4].pct).toBeCloseTo((Date.UTC(2027, 10, 1) - Date.UTC(2026, 10, 1)) / (Date.UTC(2028, 10, 1) - Date.UTC(2026, 10, 1)) * 100);
  });

  it("starts at 0% and stays inside the chart", () => {
    const pcts = ganttQuarters("2026-11-01", "2028-11-01").map((q) => q.pct);
    expect(pcts[0]).toBe(0);
    expect(Math.max(...pcts)).toBeLessThan(100);
  });

  it("adds a partial last quarter", () => {
    expect(labels("2026-01-01", "2027-02-15")).toEqual(["Y1 Q1", "Y1 Q2", "Y1 Q3", "Y1 Q4", "Y2 Q1"]);
  });

  it("keeps month-end starts on the month's last day, leap year included", () => {
    expect(ganttQuarters("2027-11-30", "2028-11-29").length).toBe(4);
    expect(ganttQuarters("2027-11-30", "2028-11-29")[1].pct).toBeCloseTo((Date.UTC(2028, 1, 29) - Date.UTC(2027, 10, 30)) / (Date.UTC(2028, 10, 29) - Date.UTC(2027, 10, 30)) * 100);
  });

  it("is empty without a valid range", () => {
    expect(ganttQuarters("", "2026-12-31")).toEqual([]);
    expect(ganttQuarters("2026-12-31", "2026-01-01")).toEqual([]);
  });
});
