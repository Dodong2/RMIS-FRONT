import { useState } from "react";
import type { PortfolioDashboard } from "../../types/dashboard";
import { SkeletonRows } from "../common/proto";
import { ChartCard, EmptyChart, HBar } from "./ProtoCharts";

const PRIORITY_COLORS = ["#0d2a5e", "#9f1239", "#065f46", "#f59e0b", "#f472b6", "#0891b2", "#7c3aed", "#ea580c", "#64748b"];

const SDG_COLORS: Record<number, string> = {
  1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B", 8: "#A21942",
  9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B",
  16: "#00689D", 17: "#19486A",
};

const STATUS_META: [string, string, string][] = [
  ["active", "Active", "#059669"],
  ["completed", "Completed", "#0d2a5e"],
  ["archived", "Archived", "#94a3b8"],
];

const COLLEGES_PER_PAGE = 6;

function Meta({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 mb-3 text-xs font-bold" style={{ color: "#64748b" }}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

export function PortfolioTab({ data }: { data: PortfolioDashboard | null }) {
  const [page, setPage] = useState(0);
  if (!data) return <SkeletonRows />;

  const total = data.total_projects;
  const areas = Object.entries(data.by_priority_area).sort((a, b) => b[1] - a[1]);
  const areaMax = Math.max(0, ...areas.map(([, n]) => n));
  const sdgs = Object.entries(data.by_sdg)
    .map(([num, count]) => ({ num: Number(num), count }))
    .sort((a, b) => b.count - a.count || a.num - b.num);
  const sdgMax = Math.max(0, ...sdgs.map((s) => s.count));
  const sdgAllocations = sdgs.reduce((sum, s) => sum + s.count, 0);
  const colleges = data.by_college;
  const collegeMax = Math.max(1, ...colleges.map((c) => c.total));
  const collegeProjects = colleges.reduce((sum, c) => sum + c.total, 0);
  const pages = Math.max(1, Math.ceil(colleges.length / COLLEGES_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const pageColleges = colleges.slice(current * COLLEGES_PER_PAGE, (current + 1) * COLLEGES_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Projects by Research Priority Area">
          <Meta left="Compare thematic priorities across registered projects." right={`${areas.length} focus areas · ${total} projects`} />
          {areas.length === 0 ? (
            <EmptyChart message="No projects registered yet." />
          ) : (
            <>
              {areas.map(([label, n], i) => (
                <HBar key={label} label={label} val={n} max={areaMax} color={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} valLabel={String(n)} />
              ))}
              <p className="text-xs mt-3" style={{ color: "#334155" }}>
                <strong>{areas[0][0]}</strong> is the dominant priority area, with <strong>{areas[0][1]} project(s)</strong>.
              </p>
            </>
          )}
        </ChartCard>

        <ChartCard title="Projects by SDG Alignment">
          <Meta left="See which Sustainable Development Goals current projects address." right={`${sdgs.length} SDGs · ${sdgAllocations} project allocations`} />
          {sdgs.length === 0 ? (
            <EmptyChart message="No SDGs tagged on projects yet." />
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto pr-1">
                {sdgs.map((s) => (
                  <HBar key={s.num} label={`SDG ${s.num}`} val={s.count} max={sdgMax} color={SDG_COLORS[s.num] ?? "#64748b"} valLabel={String(s.count)} />
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: "#334155" }}>
                The top SDGs addressed by current projects are <strong>{sdgs.slice(0, 5).map((s) => `SDG ${s.num}`).join(", ")}</strong>.
              </p>
            </>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Projects by College">
        <Meta left="Compare college-level project totals, broken down by status. Unit: Number of Projects" right={`${colleges.length} colleges · ${collegeProjects} projects`} />
        {colleges.length === 0 ? (
          <EmptyChart message="No college recorded on projects yet." />
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-4 mb-3 text-[10px] font-bold" style={{ color: "#475569" }}>
              {STATUS_META.map(([key, label, color]) => (
                <span key={key} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-3 h-56 border-b border-l px-2" style={{ borderColor: "#cbd5e1", minWidth: `${colleges.length * 56}px` }}>
                {colleges.map((c) => (
                  <div key={`${c.campus}:${c.college}`} className="flex-1 min-w-[40px] h-full flex flex-col-reverse" title={`${c.college} (${c.campus || "No campus"}): ${c.total}`}>
                    {STATUS_META.map(([key, label, color]) =>
                      c.by_status[key] ? (
                        <div key={key} title={`${label}: ${c.by_status[key]}`} style={{ height: `${(c.by_status[key] / collegeMax) * 100}%`, background: color }} />
                      ) : null,
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 px-2 mt-1" style={{ minWidth: `${colleges.length * 56}px` }}>
                {colleges.map((c) => (
                  <div key={`${c.campus}:${c.college}`} className="flex-1 min-w-[40px] text-center">
                    <p className="text-[10px] font-bold truncate" style={{ color: "#334155" }}>{c.code}</p>
                    <p className="text-[9px] truncate" style={{ color: "#94a3b8" }}>{c.campus}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard
        title="Project Count by College"
        aside={
          colleges.length > COLLEGES_PER_PAGE ? (
            <div className="flex items-center gap-2 text-xs font-bold">
              <button disabled={current === 0} onClick={() => setPage(current - 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40" style={{ borderColor: "#e2e8f0", color: "#9f1239" }}>Prev</button>
              <span style={{ color: "#64748b" }}>{current + 1}/{pages}</span>
              <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40" style={{ borderColor: "#9f1239", color: "#9f1239" }}>Next</button>
            </div>
          ) : undefined
        }
      >
        <p className="text-xs font-bold mb-3" style={{ color: "#64748b" }}>
          Project totals per college, by campus.
          {colleges.length > 0 && ` Showing ${current * COLLEGES_PER_PAGE + 1}–${current * COLLEGES_PER_PAGE + pageColleges.length} of ${colleges.length}.`}
        </p>
        {colleges.length === 0 ? (
          <EmptyChart message="No college recorded on projects yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pageColleges.map((c) => (
              <div key={`${c.campus}:${c.college}`} className="rounded-xl p-3 border-t-2" style={{ background: "#f8fafc", borderColor: "#9f1239" }}>
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-black" style={{ color: "#0d2a5e" }}>{c.code}</p>
                  <p className="text-[10px]" style={{ color: "#94a3b8" }}>{c.total} project{c.total === 1 ? "" : "s"}</p>
                </div>
                <p className="text-xs mb-3" style={{ color: "#64748b" }}>{c.title}</p>
                <div className="flex justify-between items-end gap-2">
                  <div>
                    <p className="text-2xl font-black" style={{ color: "#0d2a5e" }}>{c.total}</p>
                    <p className="text-[10px] font-bold uppercase" style={{ color: "#94a3b8" }}>
                      {total ? ((c.total / total) * 100).toFixed(1) : "0"}% of scoped projects
                    </p>
                  </div>
                  <p className="text-[10px] text-right" style={{ color: "#64748b" }}>{c.campus || "No campus"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
