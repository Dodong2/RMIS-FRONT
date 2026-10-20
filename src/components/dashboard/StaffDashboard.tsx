import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NoActualData } from "../common/NoActualData";
import { dashboardApi } from "../../lib/dashboardApi";
import { tasksQuery, useProjects } from "../../lib/queries";
import { summarizeStaffTasks } from "../../lib/staffDashboard";
import type { Task, TaskStatus } from "../../types/personnel";

const STATUS: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "To Do", bg: "#f1f5f9", text: "#475569" },
  in_progress: { label: "In Progress", bg: "#e0f2fe", text: "#0369a1" },
  for_review: { label: "For Review", bg: "#faf5ff", text: "#6b21a8" },
  done: { label: "Completed", bg: "#d1fae5", text: "#166534" },
  blocked: { label: "Blocked", bg: "#fee2e2", text: "#991b1b" },
};

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Tile({ label, value, color, bg }: { label: string; value: number | string; color: string; bg: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="text-3xl font-black mt-1 font-mono" style={{ color }}>{value}</p>
      <div className="h-1 rounded-full mt-2" style={{ background: bg }} />
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "#059669" : "#0891b2" }} />
    </div>
  );
}

export function StaffDashboard() {
  const tasksQ = useQuery(tasksQuery());
  const projects = useProjects().data;
  const budget = useQuery({ queryKey: ["dashboard-budget", "staff"], queryFn: () => dashboardApi.getBudgetDashboard() }).data;
  const [today] = useState(() => localDate(new Date()));
  const tasks = useMemo<Task[]>(() => tasksQ.data ?? [], [tasksQ.data]);
  const s = useMemo(() => summarizeStaffTasks(tasks, today), [tasks, today]);
  const codeOf = (id: number) => projects?.find((p) => p.id === id)?.project_code ?? `Project ${id}`;
  const ordered = [...tasks].sort(
    (a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );

  if (tasksQ.isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "#f1f5f9" }} />
        ))}
      </div>
    );
  }
  if (tasksQ.isError) return <NoActualData message="Could not load your tasks." hint="Check your connection and refresh." />;
  if (!tasks.length) return <NoActualData message="No assigned tasks" hint="No tasks have been assigned to you yet." />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Tile label="Assigned Tasks" value={s.total} color="#0d2a5e" bg="#e0eaf7" />
        <Tile label="To Do" value={s.todo} color="#475569" bg="#f1f5f9" />
        <Tile label="In Progress" value={s.inProgress} color="#0369a1" bg="#e0f2fe" />
        <Tile label="For Review" value={s.forReview} color="#6b21a8" bg="#faf5ff" />
        <Tile label="Completed" value={s.done} color="#166534" bg="#d1fae5" />
        <Tile label="Overdue" value={s.overdue} color="#dc2626" bg="#fee2e2" />
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>Overall Progress</p>
            <p className="text-3xl font-black font-mono mt-1" style={{ color: "#0d2a5e" }}>{s.overallPct === null ? "—" : `${s.overallPct}%`}</p>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#475569" }}>
            {s.hoursLogged}h logged{s.plannedHours ? ` / ${s.plannedHours}h planned` : ""}
          </p>
        </div>
        <Bar pct={s.overallPct ?? 0} />
        <p className="text-xs" style={{ color: "#94a3b8" }}>
          Weighted by each task's planned hours; a completed task counts in full.
          {s.blocked > 0 && ` ${s.blocked} blocked.`}
          {s.withoutPlannedHours > 0 && ` ${s.withoutPlannedHours} open task${s.withoutPlannedHours === 1 ? " has" : "s have"} no planned hours yet.`}
        </p>
      </div>

      {!!budget?.project_count && (
        <div className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>My Projects' Budget</p>
            <p className="text-sm font-semibold mt-1" style={{ color: "#475569" }}>
              {peso(budget.total_actual)} used of {peso(budget.total_approved)} approved · {budget.project_count} project{budget.project_count === 1 ? "" : "s"}
            </p>
          </div>
          <p className="text-2xl font-black font-mono" style={{ color: "#0891b2" }}>
            {budget.utilization_pct === null ? "—" : `${Math.round(budget.utilization_pct)}%`}
          </p>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "#f1f5f9", background: "#f8fafc" }}>
          <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>My Tasks</p>
          <Link to="/tasks" className="text-xs font-bold" style={{ color: "#0891b2" }}>Open Personnel &amp; Tasks</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
                <th className="px-5 py-2.5">Task</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-5 py-2.5 w-48">% Completed</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((t) => {
                const meta = STATUS[t.status];
                const late = t.status !== "done" && !!t.due_date && t.due_date < today;
                return (
                  <tr key={t.id} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                    <td className="px-5 py-3">
                      <Link to={`/tasks?project=${t.project}&task=${t.id}`} className="font-semibold hover:underline" style={{ color: "#0d2a5e" }}>
                        {t.title}
                      </Link>
                      <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>{codeOf(t.project)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: meta.bg, color: meta.text }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono whitespace-nowrap" style={{ color: late ? "#dc2626" : "#64748b" }}>
                      {t.due_date ?? "—"}{late && " · overdue"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><Bar pct={t.progress_pct} /></div>
                        <span className="text-xs font-mono font-bold w-12 text-right" style={{ color: "#0d2a5e" }}>{t.progress_pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
