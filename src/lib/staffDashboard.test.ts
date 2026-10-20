import { describe, expect, it } from "vitest";
import type { Task } from "../types/personnel";
import { summarizeStaffTasks } from "./staffDashboard";

const task = (over: Partial<Task>): Task =>
  ({ id: 1, status: "pending", estimated_hours: "40.00", logged_hours: "0.00", progress_pct: 0, due_date: "2026-12-31", ...over }) as Task;

describe("summarizeStaffTasks", () => {
  it("counts each task once per status and sums the hours", () => {
    const s = summarizeStaffTasks(
      [
        task({ id: 1, status: "in_progress", logged_hours: "8.00", progress_pct: 20 }),
        task({ id: 2, status: "done", logged_hours: "40.00", progress_pct: 100 }),
        task({ id: 3, status: "pending", due_date: "2026-10-01" }),
        task({ id: 4, status: "for_review" }),
      ],
      "2026-10-20",
    );
    expect([s.total, s.todo, s.inProgress, s.forReview, s.done, s.overdue]).toEqual([4, 1, 1, 1, 1, 1]);
    expect(s.hoursLogged).toBe(48);
    expect(s.plannedHours).toBe(160);
  });

  it("weights the overall % by planned hours", () => {
    const s = summarizeStaffTasks(
      [task({ estimated_hours: "2088.00", progress_pct: 0.4 }), task({ id: 2, estimated_hours: "40.00", status: "done", progress_pct: 100 })],
      "2026-10-20",
    );
    expect(s.overallPct).toBe(2.3);
  });

  it("leaves the overall % empty when no task has planned hours, and counts those tasks", () => {
    const s = summarizeStaffTasks([task({ estimated_hours: null })], "2026-10-20");
    expect(s.overallPct).toBeNull();
    expect(s.withoutPlannedHours).toBe(1);
  });

  it("is all zeros for no tasks", () => {
    expect(summarizeStaffTasks([], "2026-10-20")).toMatchObject({ total: 0, overallPct: null, hoursLogged: 0 });
  });
});
