import type { PerformanceDashboard } from "../../types/dashboard";
import { SkeletonRows } from "../common/proto";
import { STATUS_LABELS } from "./format";
import { ChartCard, EmptyChart, KpiBox } from "./ProtoCharts";

function PctBar({ pct, color }: { pct: number | null; color: string }) {
  const val = Math.round(pct ?? 0);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, val)}%`, background: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{pct === null ? "—" : `${val}%`}</span>
    </div>
  );
}

export function ProjectsTab({ data }: { data: PerformanceDashboard | null }) {
  if (!data) return <SkeletonRows />;
  const rows = data.projects;
  const byStatus = (status: string) => rows.filter((r) => r.status === status).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Active Projects" value={String(byStatus("active"))} color="#059669" />
        <KpiBox label="Completed" value={String(byStatus("completed"))} color="#0d2a5e" />
        <KpiBox label="Archived" value={String(byStatus("archived"))} color="#64748b" />
        <KpiBox label="Total Projects" value={String(rows.length)} sub="In selected scope" color="#0891b2" />
      </div>

      <ChartCard title="Project Performance Matrix">
        {rows.length === 0 ? (
          <EmptyChart message="No projects match the selected filters." />
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f0f4f8" }}>
                  {["Project Code", "Title", "Program", "Status", "Physical %", "Financial %", "Milestones"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.project} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                    <td className="px-3 py-2.5 text-xs font-mono font-bold whitespace-nowrap" style={{ color: "#0891b2" }}>{p.project_code}</td>
                    <td className="px-3 py-2.5 text-xs max-w-[200px]">
                      <p className="line-clamp-2 font-medium" style={{ color: "#0d2a5e" }} title={p.title}>{p.title}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "#64748b" }}>{p.priority_area || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><PctBar pct={p.physical_pct} color="#059669" /></td>
                    <td className="px-3 py-2.5"><PctBar pct={p.financial_pct} color="#0891b2" /></td>
                    <td className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: "#475569" }}>
                      {p.milestones_done}/{p.milestones_total} done
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
