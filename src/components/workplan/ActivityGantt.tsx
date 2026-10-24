import type { Milestone, Project } from "../../types/research";
import { STATUS_META, daysLate, ganttQuarters, nameOf } from "../../lib/workplan";

export function LatePill({ days }: { days: number }) {
  if (days === 0) return <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#f1f5f9", color: "#64748b" }}>—</span>;
  return (
    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "#fee2e2", color: "#991b1b" }}>
      {days}d late
    </span>
  );
}

function Gantt({ milestones, project, now }: { milestones: Milestone[]; project: Project; now: number }) {
  if (milestones.length === 0) return <p className="text-sm py-4 text-center" style={{ color: "#94a3b8" }}>No activities defined yet.</p>;
  const dates = milestones.flatMap((m) => [m.start_date, m.target_date]).filter(Boolean).sort() as string[];
  const startDate = project.start_date ?? dates[0];
  const endDate = project.target_end_date ?? dates[dates.length - 1];
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const total = Math.max(1, end - start);
  const toPct = (d: string) => Math.max(0, Math.min(100, ((new Date(d).getTime() - start) / total) * 100));
  const todayPct = Math.max(0, Math.min(100, ((now - start) / total) * 100));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="flex text-xs mb-2">
          <div className="shrink-0 font-bold uppercase tracking-wide" style={{ width: "220px", color: "#94a3b8" }}>Activity</div>
          <div className="shrink-0 text-center font-mono" style={{ width: "110px", color: "#94a3b8" }}>Responsible</div>
          <div className="flex-1 relative h-5">
            {/* Client 2026-10-24: every project year's quarters, not Q1-Q4 across the whole period */}
            {ganttQuarters(startDate, endDate).map((q) => (
              <span key={q.label} className="absolute font-semibold whitespace-nowrap" style={{ left: `${q.pct}%`, transform: "translateX(-50%)", color: "#94a3b8" }}>{q.label}</span>
            ))}
            <span className="absolute font-bold" style={{ left: `${todayPct}%`, transform: "translateX(-50%)", color: "#ef4444", top: 0, fontSize: "9px" }}>▼</span>
          </div>
          <div className="shrink-0 text-center font-bold uppercase tracking-wide" style={{ width: "80px", color: "#94a3b8" }}>Variance</div>
        </div>
        {milestones.map((m, i) => {
          const left = toPct(m.start_date ?? m.target_date);
          const width = Math.max(0.5, toPct(m.target_date) - left);
          const sc = STATUS_META[m.status].dot;
          return (
            <div key={m.id} className="flex items-center mb-2">
              <div className="shrink-0 pr-2" style={{ width: "220px" }}>
                <p className="text-xs font-semibold truncate" style={{ color: "#334155" }}>{i + 1}. {m.title}</p>
              </div>
              <div className="shrink-0 text-center px-1 truncate" style={{ width: "110px" }}>
                <p className="text-xs truncate" style={{ color: "#64748b" }}>{nameOf(m.responsible_detail)}</p>
              </div>
              <div className="flex-1 relative" style={{ height: "28px" }}>
                <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${todayPct}%`, background: "#ef4444", opacity: 0.5 }} />
                <div className="absolute rounded" style={{ top: "4px", bottom: "4px", left: `${left}%`, width: `${width}%`, border: `1.5px solid ${sc}`, background: sc + "18" }} />
                {m.status === "done" && (
                  <div className="absolute rounded" style={{ top: "8px", bottom: "8px", left: `${left}%`, width: `${width}%`, background: sc }} />
                )}
              </div>
              <div className="shrink-0 flex justify-center" style={{ width: "80px" }}>
                <LatePill days={daysLate(m, now)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActivityGantt({ milestones, project, now }: { milestones: Milestone[]; project: Project; now: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Activity Gantt Chart</p>
        <div className="flex items-center gap-3 ml-auto text-xs">
          {[
            { color: "rgba(0,0,0,0.15)", label: "Planned (outline)" },
            { color: "#059669", label: "Completed" },
            { color: "#ef4444", label: "Today" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ background: l.color, border: `1.5px solid ${l.color}` }} />
              <span style={{ color: "#94a3b8" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <Gantt milestones={milestones} project={project} now={now} />
      </div>
    </div>
  );
}
