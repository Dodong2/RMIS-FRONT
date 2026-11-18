import type { ProcurementDashRow } from "../types/dashboard";
import type { ProcurementStatus } from "../types/financial";

// Procurement Officer - LIB dashboard figures (Figma ProcurementOfficerDashboard, 2026-10-22), computed from the rows of
// GET /api/dashboard/procurement/ so the page's filters stay client-side. Money arrives as decimal strings.

export const CLOSED: ProcurementStatus[] = ["completed", "cancelled"];
export const PENDING: ProcurementStatus[] = ["requested", "under_review"];

export const num = (v: string | number | null | undefined) => Number(v ?? 0) || 0;
export const isOpen = (r: ProcurementDashRow) => !CLOSED.includes(r.status);
export const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const sum = (rows: ProcurementDashRow[], f: (r: ProcurementDashRow) => number) => rows.reduce((a, r) => a + f(r), 0);

/** Calendar date (YYYY-MM-DD) of a timestamp in the viewer's timezone. */
export const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface ProcurementFilters {
  campus: string;
  project: string;
  college: string;
  libItem: string;
  status: string;
  from: string;
  to: string;
}

export const NO_FILTERS: ProcurementFilters = { campus: "", project: "", college: "", libItem: "", status: "", from: "", to: "" };

export function filterRows(rows: ProcurementDashRow[], f: ProcurementFilters) {
  return rows.filter((r) => {
    const day = localDay(r.requested_at);
    return (
      (!f.campus || r.campus === f.campus) &&
      (!f.project || String(r.project) === f.project) &&
      (!f.college || r.college === f.college) &&
      (!f.libItem || r.lib_item === f.libItem) &&
      (!f.status || r.status === f.status) &&
      (!f.from || day >= f.from) &&
      (!f.to || day <= f.to)
    );
  });
}

/** Overview tiles. Pending = waiting for the Procurement Office (submitted, or received and under review). */
export function overview(rows: ProcurementDashRow[]) {
  const open = rows.filter(isOpen);
  const forRelease = rows.filter((r) => r.status === "ready_for_release");
  return {
    pending: rows.filter((r) => PENDING.includes(r.status)).length,
    returned: rows.filter((r) => r.status === "returned_for_revision").length,
    forRelease: forRelease.length,
    forReleaseAmount: sum(forRelease, (r) => num(r.amount)),
    activeCommitments: sum(open, (r) => num(r.amount)),
    openCount: open.length,
  };
}

/** Each LIB line item once (several requests can share one), for LIB totals. */
function perLineItem(rows: ProcurementDashRow[]) {
  const items = new Map<number, ProcurementDashRow>();
  rows.forEach((r) => items.has(r.line_item) || items.set(r.line_item, r));
  return [...items.values()];
}

// Client Task 82 (2026-11-18): Procurement Analytics = the Figma Analytics tab (ProcurementOfficerDashboard.tsx on
// university-rmis.figma.site) on real requests. Figma "Under Review" = Submitted or Under Review here; "approved" = the
// Procurement Office accepted it (For Procurement onward); "procured" = Completed; "disbursed" = paid by Finance.
export const APPROVED: ProcurementStatus[] = [
  "for_procurement", "procurement_in_progress", "order_placed", "awaiting_delivery", "delivered", "ready_for_release", "completed",
];
/** Figma's "Overdue processing" rule: still open after 12 days. */
export const OVERDUE_DAYS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isApproved = (r: ProcurementDashRow) => APPROVED.includes(r.status);
export const isPaid = (r: ProcurementDashRow) => num(r.released) > 0;
export const isOverdue = (r: ProcurementDashRow) => isOpen(r) && (r.processing_days ?? 0) > OVERDUE_DAYS;

export function analytics(rows: ProcurementDashRow[]) {
  const items = perLineItem(rows);
  const libTotal = sum(items, (r) => num(r.lib_adjusted));
  const approved = rows.filter(isApproved);
  const decided = rows.filter((r) => !PENDING.includes(r.status));
  const timed = rows.filter((r) => r.decided_at);
  const disbursed = sum(rows, (r) => num(r.released));
  return {
    libTotal,
    disbursed,
    utilizationPct: pct(disbursed, libTotal),
    pending: rows.filter((r) => PENDING.includes(r.status)).length,
    approvedCount: approved.length,
    decidedCount: decided.length,
    approvalRatePct: pct(approved.length, decided.length),
    avgApprovalDays: timed.length
      ? Math.round(sum(timed, (r) => (Date.parse(r.decided_at as string) - Date.parse(r.requested_at)) / DAY_MS) / timed.length)
      : null,
    completed: rows.filter((r) => r.status === "completed").length,
    procurementCompletionPct: pct(rows.filter((r) => r.status === "completed").length, approved.length),
    paidCount: rows.filter(isPaid).length,
    disbursementCompletionPct: pct(rows.filter(isPaid).length, approved.length),
    remaining: sum(items, (r) => Math.max(0, num(r.lib_uncommitted))),
    funnel: {
      requested: sum(rows, (r) => num(r.amount)),
      approved: sum(approved, (r) => num(r.amount)),
      procured: sum(rows.filter((r) => r.status === "completed"), (r) => num(r.amount)),
      disbursed,
    },
  };
}

/** Per request, the amounts of the Figma transaction table. */
export function stageAmounts(r: ProcurementDashRow) {
  const amount = num(r.amount);
  return {
    requested: amount,
    approved: isApproved(r) ? amount : 0,
    procured: r.status === "completed" ? amount : 0,
    disbursed: num(r.released),
  };
}

const procured = (r: ProcurementDashRow) => (r.status === "completed" ? num(r.amount) : 0);

/** Figma "Spending by project and LIB category": procured (Completed) value, top projects. */
export function spendingByProject(rows: ProcurementDashRow[], top = 5) {
  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r.project_code, (totals.get(r.project_code) ?? 0) + procured(r)));
  return [...totals.entries()]
    .map(([project_code, value]) => ({ project_code, value }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

export function spendingByCategory(rows: ProcurementDashRow[]) {
  return (["ps", "mooe", "co"] as const).map((category) => ({
    category,
    value: sum(rows.filter((r) => r.category === category), procured),
  }));
}

/** Client: "sinong college or PL ang on track sa request". On track = not overdue (Figma's 12-day rule); cancelled
 * requests are left out. Highest on-track share first. */
export function onTrackBy(rows: ProcurementDashRow[], key: "college" | "project_leader") {
  const groups = new Map<string, { total: number; overdue: number; completed: number }>();
  rows.filter((r) => r.status !== "cancelled").forEach((r) => {
    const name = r[key] || (key === "college" ? "No college" : "No leader");
    const g = groups.get(name) ?? { total: 0, overdue: 0, completed: 0 };
    g.total += 1;
    if (isOverdue(r)) g.overdue += 1;
    if (r.status === "completed") g.completed += 1;
    groups.set(name, g);
  });
  return [...groups.entries()]
    .map(([name, g]) => ({ name, ...g, onTrack: g.total - g.overdue, onTrackPct: pct(g.total - g.overdue, g.total) }))
    .sort((a, b) => b.onTrackPct - a.onTrackPct || b.total - a.total || a.name.localeCompare(b.name));
}

/** Client: "anong items ang laging nirerequest". Grouped by the exact LIB Item of the line item within its class
 * (no merging of similar names); cancelled requests left out. */
export function topRequestedItems(rows: ProcurementDashRow[], top = 10) {
  const groups = new Map<string, { category: ProcurementDashRow["category"]; lib_item: string; count: number; amount: number; projects: Set<number> }>();
  rows.filter((r) => r.status !== "cancelled").forEach((r) => {
    const k = `${r.category}|${r.lib_item}`;
    const g = groups.get(k) ?? { category: r.category, lib_item: r.lib_item, count: 0, amount: 0, projects: new Set<number>() };
    g.count += 1;
    g.amount += num(r.amount);
    g.projects.add(r.project);
    groups.set(k, g);
  });
  return [...groups.values()]
    .map(({ projects, ...g }) => ({ ...g, projects: projects.size }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount || a.lib_item.localeCompare(b.lib_item))
    .slice(0, top);
}

export function statusCounts(rows: ProcurementDashRow[]) {
  const counts = new Map<ProcurementStatus, number>();
  rows.forEach((r) => counts.set(r.status, (counts.get(r.status) ?? 0) + 1));
  return counts;
}

/** Monthly request volume and value by the month filed, oldest first. */
export function monthly(rows: ProcurementDashRow[]) {
  const months = new Map<string, { count: number; amount: number }>();
  rows.forEach((r) => {
    const m = localDay(r.requested_at).slice(0, 7);
    const cur = months.get(m) ?? { count: 0, amount: 0 };
    months.set(m, { count: cur.count + 1, amount: cur.amount + num(r.amount) });
  });
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
}

export const DAY_BUCKETS = [
  { label: "0–3 days", low: 0, high: 3 },
  { label: "4–7 days", low: 4, high: 7 },
  { label: "8–14 days", low: 8, high: 14 },
  { label: "15+ days", low: 15, high: Infinity },
];

/** Days from filing to completion (or to today while open); cancelled requests have none. */
export function dayBuckets(rows: ProcurementDashRow[]) {
  return DAY_BUCKETS.map((b) => ({
    ...b,
    count: rows.filter((r) => r.processing_days !== null && r.processing_days >= b.low && r.processing_days <= b.high).length,
  }));
}

export interface ProcurementException {
  row: ProcurementDashRow;
  label: string;
  severity: "critical" | "warning";
}

/** Figma "Exception monitoring" (its "missing supporting records" flag has no RMIS data, so it isn't shown). */
export function exceptions(rows: ProcurementDashRow[]): ProcurementException[] {
  return rows.flatMap((row) => {
    const flags: ProcurementException[] = [];
    if (row.exceeds_available) flags.push({ row, label: "Exceeds available LIB balance", severity: "critical" });
    if (isOverdue(row)) flags.push({ row, label: `Overdue processing (${row.processing_days} days)`, severity: "warning" });
    if (row.returned_count >= 2) flags.push({ row, label: `Returned for revision ${row.returned_count} times`, severity: "warning" });
    return flags;
  });
}

/** Open requests per campus, for the Campus workload bars. */
export function campusWorkload(rows: ProcurementDashRow[]) {
  const counts = new Map<string, number>();
  rows.filter(isOpen).forEach((r) => {
    const campus = r.campus || "No campus";
    counts.set(campus, (counts.get(campus) ?? 0) + 1);
  });
  return [...counts.entries()].map(([campus, count]) => ({ campus, count })).sort((a, b) => b.count - a.count);
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}
