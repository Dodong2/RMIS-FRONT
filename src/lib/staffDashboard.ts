import type { Task } from "../types/personnel";

export interface StaffTaskSummary {
  total: number;
  todo: number;
  inProgress: number;
  forReview: number;
  blocked: number;
  done: number;
  overdue: number;
  hoursLogged: number;
  plannedHours: number;
  /** Planned-hours-weighted % of the tasks that have planned hours (done tasks count fully); null when none have any. */
  overallPct: number | null;
  withoutPlannedHours: number;
}

/** One row per task (a task has exactly one assignee), so nothing is counted twice. */
export function summarizeStaffTasks(tasks: Task[], today: string): StaffTaskSummary {
  const count = (status: Task["status"]) => tasks.filter((t) => t.status === status).length;
  const planned = tasks.filter((t) => Number(t.estimated_hours ?? 0) > 0);
  const plannedHours = planned.reduce((s, t) => s + Number(t.estimated_hours), 0);
  const doneHours = planned.reduce((s, t) => s + (Number(t.estimated_hours) * t.progress_pct) / 100, 0);
  return {
    total: tasks.length,
    todo: count("pending"),
    inProgress: count("in_progress"),
    forReview: count("for_review"),
    blocked: count("blocked"),
    done: count("done"),
    overdue: tasks.filter((t) => t.status !== "done" && !!t.due_date && t.due_date < today).length,
    hoursLogged: tasks.reduce((s, t) => s + Number(t.logged_hours ?? 0), 0),
    plannedHours,
    overallPct: plannedHours ? Math.round((doneHours / plannedHours) * 1000) / 10 : null,
    withoutPlannedHours: tasks.filter((t) => t.status !== "done" && !(Number(t.estimated_hours ?? 0) > 0)).length,
  };
}
