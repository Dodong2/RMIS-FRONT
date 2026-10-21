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

export function analytics(rows: ProcurementDashRow[]) {
  const items = perLineItem(rows);
  const libTotal = sum(items, (r) => num(r.lib_adjusted));
  const released = sum(rows, (r) => num(r.released));
  const live = rows.filter((r) => r.status !== "cancelled");
  const completed = rows.filter((r) => r.status === "completed");
  const timed = completed.filter((r) => r.processing_days !== null);
  return {
    libTotal,
    released,
    utilizationPct: pct(released, libTotal),
    pending: rows.filter((r) => PENDING.includes(r.status)).length,
    avgProcessingDays: timed.length ? Math.round(sum(timed, (r) => r.processing_days ?? 0) / timed.length) : null,
    completed: completed.length,
    completionPct: pct(completed.length, live.length),
    remaining: sum(items, (r) => num(r.lib_uncommitted)),
    funnel: {
      requested: sum(live, (r) => num(r.amount)),
      // Received by the Procurement Office and not sent back to the leader
      received: sum(live.filter((r) => !["requested", "returned_for_revision"].includes(r.status)), (r) => num(r.amount)),
      released,
    },
  };
}

export function releasedByProject(rows: ProcurementDashRow[], top = 5) {
  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r.project_code, (totals.get(r.project_code) ?? 0) + num(r.released)));
  return [...totals.entries()]
    .map(([project_code, value]) => ({ project_code, value }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

export function releasedByCategory(rows: ProcurementDashRow[]) {
  return (["ps", "mooe", "co"] as const).map((category) => ({
    category,
    value: sum(rows.filter((r) => r.category === category), (r) => num(r.released)),
  }));
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

export function exceptions(rows: ProcurementDashRow[], delayDays: number): ProcurementException[] {
  return rows.flatMap((row) => {
    const flags: ProcurementException[] = [];
    if (row.exceeds_available) flags.push({ row, label: "Exceeds available LIB balance", severity: "critical" });
    if (isOpen(row) && (row.processing_days ?? 0) > delayDays) flags.push({ row, label: `Open over ${delayDays} days`, severity: "warning" });
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
