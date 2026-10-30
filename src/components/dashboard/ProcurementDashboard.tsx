import { Bell } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NoActualData } from "../common/NoActualData";
import { SkeletonRows } from "../common/proto";
import { useAuth } from "../../context/AuthContext";
import { PROCUREMENT_EVENTS, useRealtime } from "../../hooks/useRealtime";
import { dashboardApi } from "../../lib/dashboardApi";
import { personName } from "../../lib/roles";
import { STATUS_META } from "../../lib/procurementStatus";
import { INPUT_CLS, INPUT_STYLE } from "../../lib/protoStyles";
import {
  NO_FILTERS,
  PENDING,
  analytics,
  campusWorkload,
  dayBuckets,
  exceptions,
  filterRows,
  isOpen,
  monthly,
  num,
  overview,
  pct,
  releasedByCategory,
  releasedByProject,
  statusCounts,
  toCsv,
  type ProcurementFilters,
} from "../../lib/procurementDashboard";
import type { ProcurementDashEvent, ProcurementDashRow } from "../../types/dashboard";
import type { ProcurementStatus } from "../../types/financial";

type Tab = "overview" | "analytics" | "requests" | "release" | "monitoring" | "audit";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short", year: "numeric" });

const CATEGORY_LABEL = { ps: "PS", mooe: "MOOE", co: "CO" } as const;

function download(filename: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: ProcurementStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap" style={{ background: m.bg, color: m.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function Metric({ label, value, detail, color, bg, border }: { label: string; value: ReactNode; detail: string; color: string; bg: string; border: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ color, background: bg, borderColor: border }}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-semibold opacity-75">{detail}</p>
    </div>
  );
}

function Card({ title, sub, aside, children }: { title: string; sub?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-black" style={{ color: "#0d2a5e" }}>{title}</p>
          {sub && <p className="text-xs" style={{ color: "#64748b" }}>{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function HBar({ label, value, display, max, color = "#0891b2" }: { label: string; value: number; display: string; max: number; color?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs">
        <span className="font-semibold truncate" style={{ color: "#334155" }}>{label}</span>
        <span className="font-mono font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{display}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "#f1f5f9" }}>
        <div className="h-full rounded-full" style={{ width: `${pct(value, max)}%`, background: color }} />
      </div>
    </div>
  );
}

const linkBtn = "text-xs font-bold hover:underline";
const exportBtn = "rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50";

function RequestTable({ rows, empty }: { rows: ProcurementDashRow[]; empty?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left">
          <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <tr>
              {["Request", "Project & item", "Campus", "Amount", "LIB balance", "Updated", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50" style={{ borderTop: "1px solid #f1f5f9" }}>
                <td className="px-4 py-4 align-top">
                  <p className="font-mono text-xs font-bold" style={{ color: "#0d2a5e" }}>{r.request_no}</p>
                  <p className="mt-1 text-[10px]" style={{ color: "#64748b" }}>{when(r.requested_at)}</p>
                </td>
                <td className="max-w-xs px-4 py-4 align-top">
                  <p className="truncate text-xs font-bold" style={{ color: "#1e293b" }}>{r.description}</p>
                  <p className="mt-1 truncate text-[10px]" style={{ color: "#64748b" }}>
                    {r.project_code} · {CATEGORY_LABEL[r.category]} {r.lib_item} · {r.requester}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: "#e0f2fe", color: "#0369a1" }}>{r.campus || "—"}</span>
                </td>
                <td className="px-4 py-4 align-top font-mono text-xs font-bold" style={{ color: "#1e293b" }}>{peso(num(r.amount))}</td>
                <td className="px-4 py-4 align-top">
                  <p className="font-mono text-xs font-bold" style={{ color: "#047857" }}>{peso(num(r.available))}</p>
                  {isOpen(r) && (
                    <p className="mt-1 text-[10px] font-semibold" style={{ color: r.exceeds_available ? "#dc2626" : "#64748b" }}>
                      {r.exceeds_available ? "Exceeds available" : "Within balance"}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 align-top text-xs" style={{ color: "#64748b" }}>{when(r.updated_at)}</td>
                <td className="px-4 py-4 align-top"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-4 text-right align-top">
                  <Link to={`/procurement?request=${r.id}`} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "#e2e8f0", color: "#0d2a5e" }}>
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="py-12 text-center text-sm" style={{ color: "#94a3b8" }}>{empty ?? "No requests match the current scope and filters."}</div>}
    </div>
  );
}

function requestCsv(rows: ProcurementDashRow[]) {
  return [
    ["Request Number", "Project", "Campus", "College", "Class", "LIB Item", "Description", "Requester", "Requested Amount", "Released Amount", "Available LIB", "Status", "Filed", "Processing Days"],
    ...rows.map((r) => [
      r.request_no, r.project_code, r.campus, r.college, CATEGORY_LABEL[r.category], r.lib_item, r.description, r.requester,
      num(r.amount), num(r.released), num(r.available), r.status_label, when(r.requested_at), r.processing_days ?? "",
    ]),
  ];
}

function OverviewTab({ rows, setTab }: { rows: ProcurementDashRow[]; setTab: (t: Tab) => void }) {
  const o = overview(rows);
  const queue = rows.filter((r) => PENDING.includes(r.status)).sort((a, b) => a.requested_at.localeCompare(b.requested_at)).slice(0, 3);
  const workload = campusWorkload(rows);
  const maxLoad = Math.max(1, ...workload.map((w) => w.count));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Pending requests" value={o.pending} detail="Receive or review" color="#b45309" bg="#fffbeb" border="#fde68a" />
        <Metric label="Returned for revision" value={o.returned} detail="Waiting for the Project Leader" color="#c2410c" bg="#fff7ed" border="#fed7aa" />
        <Metric label="Ready for release" value={o.forRelease} detail={peso(o.forReleaseAmount)} color="#6d28d9" bg="#f5f3ff" border="#ddd6fe" />
        <Metric label="Active commitments" value={peso(o.activeCommitments)} detail={`${o.openCount} open requests`} color="#0e7490" bg="#ecfeff" border="#a5f3fc" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-black" style={{ color: "#0d2a5e" }}>Priority review queue</p>
              <p className="text-xs" style={{ color: "#64748b" }}>Oldest pending requests in your scope</p>
            </div>
            <button onClick={() => setTab("requests")} className={linkBtn} style={{ color: "#0891b2" }}>View all requests</button>
          </div>
          <RequestTable rows={queue} empty="No pending requests." />
        </div>
        <Card title="Campus workload" sub="Open requests per campus">
          <div className="space-y-4">
            {workload.map((w) => <HBar key={w.campus} label={w.campus} value={w.count} display={String(w.count)} max={maxLoad} />)}
            {!workload.length && <p className="text-xs" style={{ color: "#94a3b8" }}>No open requests.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function AnalyticsTab({ rows, delayDays, campus }: { rows: ProcurementDashRow[]; delayDays: number; campus: string }) {
  const [f, setF] = useState<ProcurementFilters>(NO_FILTERS);
  const set = (k: keyof ProcurementFilters) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const scoped = filterRows(rows, { ...f, campus });
  const a = analytics(scoped);
  const months = monthly(scoped);
  const maxMonth = Math.max(1, ...months.map((m) => m.count));
  const byProject = releasedByProject(scoped);
  const counts = statusCounts(scoped);
  const buckets = dayBuckets(scoped);
  const flags = exceptions(scoped, delayDays);
  const options = (pick: (r: ProcurementDashRow) => string) => [...new Set(rows.map(pick).filter(Boolean))].sort();
  const projects = [...new Map(rows.map((r) => [String(r.project), r.project_code])).entries()].sort((x, y) => x[1].localeCompare(y[1]));
  const sel = `${INPUT_CLS} !py-2 text-xs`;

  return (
    <div className="space-y-5">
      <Card
        title="Procurement analytics"
        sub="LIB use and processing within the active campus scope"
        aside={<button onClick={() => setF(NO_FILTERS)} className={linkBtn} style={{ color: "#0891b2" }}>Reset filters</button>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <select aria-label="Project" value={f.project} onChange={set("project")} className={sel} style={INPUT_STYLE}>
            <option value="">All projects</option>
            {projects.map(([id, code]) => <option key={id} value={id}>{code}</option>)}
          </select>
          <select aria-label="College" value={f.college} onChange={set("college")} className={sel} style={INPUT_STYLE}>
            <option value="">All colleges</option>
            {options((r) => r.college).map((c) => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="LIB item" value={f.libItem} onChange={set("libItem")} className={sel} style={INPUT_STYLE}>
            <option value="">All LIB items</option>
            {options((r) => r.lib_item).map((c) => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="Status" value={f.status} onChange={set("status")} className={sel} style={INPUT_STYLE}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_META) as ProcurementStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <label className="text-[10px] font-bold uppercase" style={{ color: "#64748b" }}>
            From
            <input type="date" value={f.from} onChange={set("from")} className={sel} style={INPUT_STYLE} />
          </label>
          <label className="text-[10px] font-bold uppercase" style={{ color: "#64748b" }}>
            To
            <input type="date" value={f.to} onChange={set("to")} className={sel} style={INPUT_STYLE} />
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Approved LIB utilization" value={`${a.utilizationPct}%`} detail={`${peso(a.released)} released of ${peso(a.libTotal)}`} color="#0e7490" bg="#ecfeff" border="#a5f3fc" />
        <Metric label="Pending requests" value={a.pending} detail="Receive or review" color="#b45309" bg="#fffbeb" border="#fde68a" />
        <Metric label="Avg processing time" value={a.avgProcessingDays === null ? "—" : `${a.avgProcessingDays}d`} detail="Filed to completed" color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
        <Metric label="Procurement completion" value={`${a.completionPct}%`} detail={`${a.completed} completed`} color="#6d28d9" bg="#f5f3ff" border="#ddd6fe" />
        <Metric label="Released amount" value={peso(a.released)} detail="Posted as disbursements" color="#0f766e" bg="#f0fdfa" border="#99f6e4" />
        <Metric label="Remaining LIB balance" value={peso(a.remaining)} detail="Uncommitted on these items" color="#0d2a5e" bg="#f8fafc" border="#e2e8f0" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Monthly procurement requests" sub="Request count by month filed (hover for value)">
          <div className="flex h-44 items-end gap-3">
            {months.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>{m.count}</p>
                <div className="w-full max-w-12 rounded-t-lg" style={{ height: `${Math.max(8, (m.count / maxMonth) * 120)}px`, background: "#0891b2" }} title={`${peso(m.amount)} requested`} />
                <p className="text-[10px] font-semibold" style={{ color: "#64748b" }}>{monthLabel(m.month)}</p>
              </div>
            ))}
            {!months.length && <p className="text-xs" style={{ color: "#94a3b8" }}>No requests in range.</p>}
          </div>
        </Card>
        <Card title="Requested to released amounts" sub="Value through the procurement lifecycle (cancelled excluded)">
          <div className="space-y-4">
            <HBar label="Requested" value={a.funnel.requested} display={peso(a.funnel.requested)} max={a.funnel.requested} color="#0d2a5e" />
            <HBar label="Received by Procurement" value={a.funnel.received} display={peso(a.funnel.received)} max={a.funnel.requested} color="#0891b2" />
            <HBar label="Released (Completed)" value={a.funnel.released} display={peso(a.funnel.released)} max={a.funnel.requested} color="#10b981" />
          </div>
        </Card>
        <Card title="Released by project and LIB class" sub="Top projects by released value">
          <div className="space-y-3">
            {byProject.map((p) => <HBar key={p.project_code} label={p.project_code} value={p.value} display={peso(p.value)} max={byProject[0].value} color="#8b5cf6" />)}
            {!byProject.length && <p className="text-xs" style={{ color: "#94a3b8" }}>Nothing released yet.</p>}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {releasedByCategory(scoped).map((c) => (
              <div key={c.category} className="rounded-xl p-3 text-center" style={{ background: "#f8fafc" }}>
                <p className="text-[10px] font-bold" style={{ color: "#64748b" }}>{CATEGORY_LABEL[c.category]}</p>
                <p className="mt-1 font-mono text-xs font-black" style={{ color: "#0d2a5e" }}>{peso(c.value)}</p>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-5">
          <Card title="Request status distribution" sub="Current status of each request">
            <div className="mb-4 flex h-3 overflow-hidden rounded-full" style={{ background: "#f1f5f9" }}>
              {[...counts.entries()].map(([s, n]) => (
                <div key={s} style={{ width: `${pct(n, scoped.length)}%`, background: STATUS_META[s].dot }} title={`${STATUS_META[s].label}: ${n}`} />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...counts.entries()].map(([s, n]) => (
                <div key={s} className="flex items-center justify-between"><StatusBadge status={s} /><span className="font-mono text-xs font-bold" style={{ color: "#475569" }}>{n}</span></div>
              ))}
            </div>
          </Card>
          <Card title="Procurement processing time" sub="Days from filing to completion, or to today while open">
            <div className="space-y-3">
              {buckets.map((b) => (
                <HBar key={b.label} label={b.label} value={b.count} display={String(b.count)} max={scoped.length} color={b.low >= 15 ? "#ef4444" : "#3b82f6"} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Transaction-level analytics"
        sub={`${scoped.length} requests match the active filters`}
        aside={
          <button disabled={!scoped.length} onClick={() => download(`procurement-analytics-${campus || "all"}.csv`, requestCsv(scoped))} className={exportBtn} style={{ background: "#0d2a5e", color: "white" }}>
            Export analytics
          </button>
        }
      >
        <RequestTable rows={scoped} />
      </Card>

      <div className="rounded-2xl p-5" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
        <p className="font-black" style={{ color: "#7f1d1d" }}>Exception monitoring</p>
        <p className="mb-4 text-xs" style={{ color: "#b91c1c" }}>Over-balance, open over {delayDays} days, or returned two or more times</p>
        <div className="space-y-2">
          {flags.map((x, i) => (
            <div key={`${x.row.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3" style={{ background: "white" }}>
              <div>
                <p className="font-mono text-xs font-bold" style={{ color: "#0d2a5e" }}>{x.row.request_no} · {x.row.project_code}</p>
                <p className="text-xs" style={{ color: "#475569" }}>{x.row.description}</p>
              </div>
              <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={x.severity === "critical" ? { background: "#fee2e2", color: "#b91c1c" } : { background: "#fef3c7", color: "#b45309" }}>
                {x.label}
              </span>
            </div>
          ))}
          {!flags.length && <p className="text-xs" style={{ color: "#991b1b" }}>No exceptions.</p>}
        </div>
      </div>
    </div>
  );
}

function RequestsTab({ rows, title, campus }: { rows: ProcurementDashRow[]; title: string; campus: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const q = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!q || [r.request_no, r.project_code, r.project_title, r.lib_item, r.description, r.requester].some((v) => v.toLowerCase().includes(q))),
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto font-black" style={{ color: "#0d2a5e" }}>{title}</p>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search request, project, item..." className={`${INPUT_CLS} !w-64 !py-2 text-xs`} style={INPUT_STYLE} />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${INPUT_CLS} !w-48 !py-2 text-xs`} style={INPUT_STYLE}>
          <option value="">All statuses</option>
          {[...new Set(rows.map((r) => r.status))].map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <button disabled={!shown.length} onClick={() => download(`procurement-requests-${campus || "all"}.csv`, requestCsv(shown))} className={exportBtn} style={{ background: "#0d2a5e", color: "white" }}>
          Export CSV
        </button>
      </div>
      <RequestTable rows={shown} />
    </div>
  );
}

function MonitoringTab({ rows }: { rows: ProcurementDashRow[] }) {
  const counts = statusCounts(rows);
  const open = rows.filter(isOpen);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Lifecycle distribution" sub="Requests in each status">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(STATUS_META) as ProcurementStatus[]).map((s) => (
            <div key={s} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "#f8fafc" }}>
              <StatusBadge status={s} />
              <span className="font-mono text-sm font-black" style={{ color: "#0d2a5e" }}>{counts.get(s) ?? 0}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Budget exposure" sub="Open request amount against what its LIB line item still has">
        <div className="space-y-3">
          {open.map((r) => {
            const ratio = Math.min(100, pct(num(r.amount), Math.max(num(r.available), 1)));
            return (
              <div key={r.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-mono font-bold" style={{ color: "#0d2a5e" }}>{r.request_no} · {r.lib_item}</span>
                  <span className="font-bold" style={{ color: r.exceeds_available ? "#dc2626" : "#047857" }}>{ratio}% of available</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "#f1f5f9" }}>
                  <div className="h-full rounded-full" style={{ width: `${ratio}%`, background: r.exceeds_available ? "#ef4444" : "#0891b2" }} />
                </div>
              </div>
            );
          })}
          {!open.length && <p className="text-xs" style={{ color: "#94a3b8" }}>No open requests.</p>}
        </div>
      </Card>
    </div>
  );
}

function AuditTab({ events, campus }: { events: ProcurementDashEvent[]; campus: string }) {
  return (
    <Card
      title="Transaction audit trail"
      sub="Every status change with the account that made it"
      aside={
        <button
          disabled={!events.length}
          onClick={() =>
            download(`procurement-audit-${campus || "all"}.csv`, [
              ["Request", "Previous", "New", "Actor", "Role", "Date", "Remarks"],
              ...events.map((e) => [e.request_no, e.from_label || "—", e.to_label, e.actor, e.actor_role, when(e.created_at), e.remarks]),
            ])
          }
          className={exportBtn}
          style={{ background: "#0d2a5e", color: "white" }}
        >
          Export visible log
        </button>
      }
    >
      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="grid gap-2 rounded-xl px-4 py-3 md:grid-cols-[150px_1fr_160px]" style={{ background: "#f8fafc" }}>
            <div>
              <p className="font-mono text-xs font-bold" style={{ color: "#0d2a5e" }}>{e.request_no}</p>
              <p className="text-[10px]" style={{ color: "#64748b" }}>{when(e.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: "#1e293b" }}>{e.from_label ? `${e.from_label} → ${e.to_label}` : `Filed as ${e.to_label}`}</p>
              {e.remarks && <p className="text-xs" style={{ color: "#64748b" }}>{e.remarks}</p>}
            </div>
            <div className="md:text-right">
              <p className="text-xs font-semibold" style={{ color: "#334155" }}>{e.actor}</p>
              <p className="text-[10px]" style={{ color: "#64748b" }}>{e.actor_role} · {e.campus || "—"}</p>
            </div>
          </div>
        ))}
        {!events.length && <p className="text-xs" style={{ color: "#94a3b8" }}>No status changes recorded yet.</p>}
      </div>
    </Card>
  );
}

export function ProcurementDashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["dashboard-procurement"], queryFn: dashboardApi.getProcurementDashboard });
  useRealtime(PROCUREMENT_EVENTS, () => q.refetch());
  const [tab, setTab] = useState<Tab>("overview");
  const [campus, setCampus] = useState("");
  const [bellOpen, setBellOpen] = useState(false);

  const all = useMemo(() => q.data?.requests ?? [], [q.data]);
  const campuses = useMemo(() => [...new Set(all.map((r) => r.campus).filter(Boolean))].sort(), [all]);
  const rows = useMemo(() => (campus ? all.filter((r) => r.campus === campus) : all), [all, campus]);
  const events = useMemo(() => (q.data?.events ?? []).filter((e) => !campus || e.campus === campus), [q.data, campus]);
  const delayDays = q.data?.delay_days ?? 30;

  if (q.isPending) return <SkeletonRows rows={5} />;
  if (q.isError) return <NoActualData message="Could not load the procurement dashboard." hint="Check your connection and refresh." />;

  const pending = rows.filter((r) => PENDING.includes(r.status)).length;
  const returned = rows.filter((r) => r.status === "returned_for_revision").length;
  const release = rows.filter((r) => ["ready_for_release", "completed"].includes(r.status));
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "analytics", label: "Analytics", count: exceptions(rows, delayDays).length },
    { id: "requests", label: "Requests", count: pending },
    { id: "release", label: "Release", count: rows.filter((r) => r.status === "ready_for_release").length },
    { id: "monitoring", label: "Monitoring" },
    { id: "audit", label: "Audit trail" },
  ];
  const go = (t: Tab) => {
    setTab(t);
    setBellOpen(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 rounded-2xl p-5 text-white shadow-lg md:flex-row md:items-center md:justify-between" style={{ background: "linear-gradient(90deg, #071a3e, #0d2a5e, #1e3a7a)" }}>
        <div>
          <span className="mb-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ background: "rgba(8,145,178,0.2)", color: "#cffafe" }}>
            Procurement operations
          </span>
          <p className="text-xl font-black tracking-tight">Procurement, Release & Monitoring</p>
          <p className="mt-1 text-sm" style={{ color: "#bfdbfe" }}>
            {campus || (campuses.length > 1 ? `${campuses.length} campuses` : campuses[0] ?? "All campuses")} · Signed in as {user ? personName(user) : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campuses.length > 1 && (
            <select aria-label="Campus scope" value={campus} onChange={(e) => setCampus(e.target.value)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-white outline-none" style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)" }}>
              <option value="" className="text-slate-800">All campuses</option>
              {campuses.map((c) => <option key={c} value={c} className="text-slate-800">{c}</option>)}
            </select>
          )}
          <div className="relative">
            <button onClick={() => setBellOpen((o) => !o)} className="relative rounded-xl border p-2.5 text-white" style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)" }} aria-label="Open action center">
              <Bell size={18} aria-hidden="true" />
              {pending + returned > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black" style={{ background: "#0891b2" }}>{pending + returned}</span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-2xl border bg-white shadow-2xl" style={{ borderColor: "#e2e8f0", color: "#1e293b" }}>
                <div className="border-b px-4 py-3" style={{ borderColor: "#f1f5f9" }}>
                  <p className="text-sm font-bold">Action center</p>
                  <p className="text-xs" style={{ color: "#64748b" }}>In your current campus scope</p>
                </div>
                <div className="space-y-1 p-2">
                  <button onClick={() => go("requests")} className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-slate-50">
                    <span className="text-xs font-semibold">Requests to receive or review</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "#fef3c7", color: "#b45309" }}>{pending}</span>
                  </button>
                  <button onClick={() => go("requests")} className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-slate-50">
                    <span className="text-xs font-semibold">Returned, waiting for the leader</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "#ffedd5", color: "#c2410c" }}>{returned}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white p-1.5" style={{ borderColor: "#e2e8f0" }}>
        <div className="flex min-w-max gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors"
              style={tab === t.id ? { background: "#0d2a5e", color: "white" } : { color: "#475569" }}
            >
              {t.label}
              {!!t.count && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={tab === t.id ? { background: "rgba(255,255,255,0.2)" } : { background: "#f1f5f9" }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!all.length ? (
        <NoActualData message="No procurement requests yet" hint="Requests filed by Project Leaders against a certified LIB will appear here." />
      ) : (
        <>
          {tab === "overview" && <OverviewTab rows={rows} setTab={setTab} />}
          {tab === "analytics" && <AnalyticsTab rows={all} delayDays={delayDays} campus={campus} />}
          {tab === "requests" && <RequestsTab rows={rows} title="All requests" campus={campus} />}
          {tab === "release" && <RequestsTab rows={release} title="Ready for release and completed" campus={campus} />}
          {tab === "monitoring" && <MonitoringTab rows={rows} />}
          {tab === "audit" && <AuditTab events={events} campus={campus} />}
        </>
      )}
    </div>
  );
}
