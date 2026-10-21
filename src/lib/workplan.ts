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

export function activityTaskCompletion(tasks: Pick<Task, "assignee" | "milestone" | "status">[], user: number) {
  const mine = tasks.filter((t) => t.assignee === user && t.milestone !== null);
  const done = mine.filter((t) => t.status === "done").length;
  return { done, total: mine.length, pct: mine.length ? Math.round((done * 100) / mine.length) : 0 };
}
