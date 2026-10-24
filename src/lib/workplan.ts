import type { Lead, Milestone, MilestoneStatus } from "../types/research";
import type { Task } from "../types/personnel";

export const STATUS_META: Record<MilestoneStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: "Not Started", bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  in_progress: { label: "In Progress", bg: "#e0f2fe", text: "#0369a1", dot: "#0891b2" },
  done: { label: "Done", bg: "#d1fae5", text: "#166534", dot: "#059669" },
  delayed: { label: "Delayed", bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

export const nameOf = (p: Lead | null | undefined) => (p ? p.full_name || p.email : "—");

const DAY = 86400000;

export function daysLate(m: Milestone, now: number) {
  if (m.status === "done") return 0;
  const d = Math.floor((now - new Date(m.target_date).getTime()) / DAY);
  return d > 0 ? d : 0;
}

/** Same day `months` later, kept on the month's last day when it has fewer days (Nov 30 + 3 = Feb 28/29). UTC ms. */
function addMonths(y: number, m: number, d: number, months: number) {
  const last = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  return Date.UTC(y, m + months, Math.min(d, last));
}

/** Activity Gantt header (client 2026-10-24): quarters of the project from its start date, each with its position as a
 * % of the start-end span. Q1-Q4 for a project of up to a year, otherwise Y1 Q1 ... Yn Q4 (project years, not calendar
 * years). Not the LIB's allocationPeriods (lib/libUnits.ts), which counts months its own way. */
export function ganttQuarters(start: string, end: string): { label: string; pct: number }[] {
  if (!start || !end || end <= start) return [];
  const [y, m, d] = start.split("-").map(Number);
  const from = Date.UTC(y, m - 1, d);
  const [ey, em, ed] = end.split("-").map(Number);
  const to = Date.UTC(ey, em - 1, ed);
  const multiYear = to > addMonths(y, m - 1, d, 12);
  const quarters: { label: string; pct: number }[] = [];
  for (let i = 0; addMonths(y, m - 1, d, i * 3) < to; i++) {
    const quarter = `Q${(i % 4) + 1}`;
    quarters.push({
      label: multiYear ? `Y${Math.floor(i / 4) + 1} ${quarter}` : quarter,
      pct: ((addMonths(y, m - 1, d, i * 3) - from) / (to - from)) * 100,
    });
  }
  return quarters;
}

export function activityTaskCompletion(tasks: Pick<Task, "assignee" | "milestone" | "status">[], user: number) {
  const mine = tasks.filter((t) => t.assignee === user && t.milestone !== null);
  const done = mine.filter((t) => t.status === "done").length;
  return { done, total: mine.length, pct: mine.length ? Math.round((done * 100) / mine.length) : 0 };
}
