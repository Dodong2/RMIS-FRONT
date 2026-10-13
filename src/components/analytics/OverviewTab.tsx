import { useState, type ReactNode } from "react";
import type { OutputDashboard, PerformanceDashboard, PerformanceScore } from "../../types/dashboard";
import { SkeletonRows } from "../common/proto";
import { FUNDING_LABELS, monthLabel, peso } from "./format";
import { ChartCard, DonutChart, EmptyChart, HBar, KpiBox, MiniBar, TrendBar } from "./ProtoCharts";

const PROGRESS_PER_PAGE = 4;
const RANK_LIMIT = 6;
const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);
const barColor = (i: number) => (i === 0 ? "#059669" : i === 1 ? "#0891b2" : i === 2 ? "#7c3aed" : "#94a3b8");
const rankBox = (top: boolean) => ({ background: top ? "#f0fdf4" : "#f8fafc", border: `1px solid ${top ? "#bbf7d0" : "#e2e8f0"}` });

function Empty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10" style={{ color: "#94a3b8" }}>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ScoreBar({ item, index }: { item: PerformanceScore; index: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.score)}%`, background: barColor(index) }} />
      </div>
      <span className="text-xs shrink-0" style={{ color: "#94a3b8" }}>
        {item.avg_progress}% prog · {item.utilization}% util
      </span>
    </div>
  );
}

function Points({ score, index }: { score: number; index: number }) {
  return (
    <div className="shrink-0 text-right">
      <span className="text-sm font-black" style={{ color: barColor(index) }}>{score}</span>
      <span className="text-xs ml-0.5" style={{ color: "#94a3b8" }}>pts</span>
    </div>
  );
}

function More({ total, noun }: { total: number; noun: string }) {
  if (total <= RANK_LIMIT) return null;
  return (
    <p className="text-xs text-center pt-1" style={{ color: "#94a3b8" }}>
      +{total - RANK_LIMIT} more {noun}
    </p>
  );
}

export function OverviewTab({
  data,
  statusSegments,
  outputDash,
  complianceSnapshot,
}: {
  data: PerformanceDashboard | null;
  statusSegments: { label: string; value: number; color: string }[];
  outputDash: OutputDashboard | null;
  complianceSnapshot: ReactNode;
}) {
  const [page, setPage] = useState(0);
  if (!data) return <SkeletonRows />;

  const rows = data.projects;
  const w = data.weights;
  const formula = `Score = ${w.progress * 100}% progress + ${w.utilization * 100}% utilization + ${w.completion * 100}% completion rate + ${w.outputs * 100}% outputs (10 pts each, max 100).`;
  const totalBudget = rows.reduce((a, r) => a + r.approved, 0);
  const totalDisbursed = rows.reduce((a, r) => a + r.actual, 0);
  const avgProgress = rows.length ? Math.round(rows.reduce((a, r) => a + (r.physical_pct ?? 0), 0) / rows.length) : 0;
  const utilization = totalBudget ? Math.round((totalDisbursed / totalBudget) * 100) : 0;

  const totalPages = Math.ceil(rows.length / PROGRESS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = rows.slice(currentPage * PROGRESS_PER_PAGE, (currentPage + 1) * PROGRESS_PER_PAGE);

  const months = data.monthly_disbursements;
  const monthTotal = months.reduce((a, m) => a + m.total, 0);
  const monthCount = months.reduce((a, m) => a + m.count, 0);
  const monthLabels = months.map((m) => monthLabel(m.month));

  const byFunding = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      if (r.approved) acc[r.funding_type] = (acc[r.funding_type] ?? 0) + r.approved;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxFunding = Math.max(0, ...byFunding.map(([, v]) => v));

  const pageBtn = (disabled: boolean) => ({ background: disabled ? "#f1f5f9" : "#0d2a5e", color: disabled ? "#94a3b8" : "white" });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Total Projects" value={String(rows.length)} sub="Unique projects in selected scope" color="#0d2a5e" />
        <KpiBox label="Total Budget" value={peso(totalBudget)} sub="Across selected projects" color="#0891b2" />
        <KpiBox label="Avg. Progress" value={`${avgProgress}%`} sub="Physical completion" color="#059669" />
        <KpiBox label="Budget Utilization" value={`${utilization}%`} sub={`${peso(totalDisbursed)} disbursed`} color="#d97706" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="Projects by Status">
          {rows.length > 0 ? <DonutChart segments={statusSegments} centerLabel="Projects" /> : <Empty message="No projects match the selected filters." />}
        </ChartCard>

        <ChartCard title="Project Progress Overview">
          <div className="flex flex-col h-full">
            <div className="space-y-3 flex-1">
              {paginated.length === 0 && <Empty message="No projects match the selected filters." />}
              {paginated.map((p) => (
                <div key={p.project} className="p-3 rounded-xl" style={{ background: "#f8fafc" }}>
                  <p className="text-xs font-semibold mb-2 line-clamp-1" style={{ color: "#0d2a5e" }} title={p.title}>{p.title}</p>
                  <div className="space-y-1.5">
                    <MiniBar label="Physical" pct={Math.round(p.physical_pct ?? 0)} color="#059669" />
                    <MiniBar label="Financial" pct={Math.round(p.financial_pct ?? 0)} color="#0891b2" />
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 mt-3 shrink-0 border-t" style={{ borderColor: "#e2e8f0" }}>
                <button onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="px-3 py-1 rounded-lg text-xs font-bold transition-all" style={pageBtn(currentPage === 0)}>
                  ← Prev
                </button>
                <span className="text-xs font-semibold" style={{ color: "#64748b" }}>
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage === totalPages - 1} className="px-3 py-1 rounded-lg text-xs font-bold transition-all" style={pageBtn(currentPage === totalPages - 1)}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Monthly Disbursement (Latest 12 Months)">
          {monthCount > 0 ? (
            <>
              <TrendBar labels={monthLabels} values={months.map((m) => m.total)} color="#0891b2" format={peso} />
              <p className="text-xs mt-3" style={{ color: "#94a3b8" }}>
                Period total: <span className="font-bold" style={{ color: "#0d2a5e" }}>{peso(monthTotal)}</span>
                {" · "}
                {monthCount} posted transaction{monthCount !== 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <EmptyChart message="No disbursement records found for the selected filters." />
          )}
        </ChartCard>

        <ChartCard title="Budget Allocation by Funding Type">
          {byFunding.length === 0 ? (
            <Empty message="No budget data matches the selected filters." />
          ) : (
            <div className="space-y-2">
              {byFunding.map(([type, value], i) => (
                <HBar key={type} label={FUNDING_LABELS[type] ?? type} val={value} max={maxFunding} color={["#0d2a5e", "#0891b2", "#7c3aed", "#059669"][i % 4]} valLabel={peso(value)} />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Research Output Summary" className="order-1">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "📄", label: "Research Outputs", val: rows.reduce((a, r) => a + r.outputs, 0), sub: "Recorded project outputs", color: "#0d2a5e" },
              { icon: "🎤", label: "Completed Projects", val: rows.filter((r) => r.status === "completed").length, sub: "Completed projects", color: "#0891b2" },
              { icon: "🌱", label: "Tech Transfers", val: outputDash?.ip_records_by_status.adopted ?? 0, sub: "IP adopted by community", color: "#059669" },
              { icon: "🏆", label: "Active Projects", val: rows.filter((r) => r.status === "active").length, sub: "Currently ongoing", color: "#f59e0b" },
              { icon: "📋", label: "Milestones Done", val: rows.reduce((a, r) => a + r.milestones_done, 0), sub: "Completed milestones", color: "#64748b" },
              { icon: "⚙️", label: "Team Members", val: rows.reduce((a, r) => a + r.team_members, 0), sub: "Project team assignments", color: "#d97706" },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl text-center" style={{ background: "#f8fafc" }}>
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="text-2xl font-black" style={{ color: item.color }}>{item.val}</p>
                <p className="text-xs font-bold" style={{ color: "#334155" }}>{item.label}</p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Compliance Snapshot" className="order-2">
          {complianceSnapshot ?? <SkeletonRows />}
        </ChartCard>

        <ChartCard title="College Performance Ranking" className="order-3">
          {data.college_ranking.length === 0 ? (
            <Empty message="No college data available." />
          ) : (
            <div className="space-y-2">
              {data.college_ranking.slice(0, RANK_LIMIT).map((c, i) => (
                <div key={`${c.campus}|${c.college}`} className="rounded-xl px-3 py-2.5" style={rankBox(i === 0)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base shrink-0">{medal(i)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: i === 0 ? "#065f46" : "#0d2a5e" }}>{c.title}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>
                        {c.campus || "No campus"} · {c.projects} project{c.projects !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Points score={c.score} index={i} />
                  </div>
                  <ScoreBar item={c} index={i} />
                </div>
              ))}
              <More total={data.college_ranking.length} noun="colleges" />
              <p className="text-[10px] pt-1" style={{ color: "#94a3b8" }}>{formula}</p>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Campus Performance Ranking" className="order-4">
          {data.campus_ranking.length === 0 ? (
            <Empty message="No campus data available." />
          ) : (
            <div className="space-y-3">
              {data.campus_ranking.map((c, i) => (
                <div key={c.campus} className="rounded-xl p-3" style={rankBox(i === 0)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{medal(i)}</span>
                      <div>
                        <p className="text-xs font-black" style={{ color: i === 0 ? "#065f46" : "#0d2a5e" }}>{c.campus}</p>
                        <p className="text-xs" style={{ color: "#94a3b8" }}>
                          {c.projects} project{c.projects !== 1 ? "s" : ""} · {c.outputs} outputs
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black" style={{ color: i === 0 ? "#059669" : "#0d2a5e" }}>{c.score}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>score</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      { label: "Progress", val: `${c.avg_progress}%`, color: "#059669" },
                      { label: "Utilization", val: `${c.utilization}%`, color: "#0891b2" },
                      { label: "Completed", val: c.completed, color: "#7c3aed" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg py-1" style={{ background: "white" }}>
                        <p className="text-xs font-black" style={{ color: m.color }}>{m.val}</p>
                        <p className="text-xs" style={{ color: "#94a3b8", fontSize: "10px" }}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.score)}%`, background: i === 0 ? "#059669" : "#0891b2" }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px]" style={{ color: "#94a3b8" }}>{formula}</p>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Project Leader Performance Ranking" className="order-5">
          {data.leader_ranking.length === 0 ? (
            <Empty message="No project leader data matches the selected filters." />
          ) : (
            <div className="space-y-2">
              {data.leader_ranking.slice(0, RANK_LIMIT).map((l, i) => (
                <div key={l.leader_id} className="rounded-xl px-3 py-2.5" style={rankBox(i === 0)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-7 shrink-0 text-xs font-black" style={{ color: barColor(i) }}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: i === 0 ? "#065f46" : "#0d2a5e" }}>{l.leader}</p>
                      {(l.position || l.office) && (
                        <p className="text-[10px] truncate" style={{ color: "#94a3b8" }} title={[l.position, l.office].filter(Boolean).join(" · ")}>
                          {[l.position, l.office].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-[10px]" style={{ color: "#64748b" }}>
                        {l.projects} project{l.projects !== 1 ? "s" : ""} · {l.outputs} output{l.outputs !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Points score={l.score} index={i} />
                  </div>
                  <ScoreBar item={l} index={i} />
                </div>
              ))}
              <More total={data.leader_ranking.length} noun="project leaders" />
              <p className="text-[10px] pt-1" style={{ color: "#94a3b8" }}>{formula}</p>
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
}
