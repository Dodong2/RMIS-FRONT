import { describe, expect, it } from "vitest";
import { activityTaskCompletion } from "./workplan";
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
