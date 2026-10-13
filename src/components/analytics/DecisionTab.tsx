import { useEffect, useState } from "react";
import { dashboardApi } from "../../lib/dashboardApi";
import { decisionSupportApi } from "../../lib/decisionSupportApi";
import type { FundingAllocationDashboard, PerformanceDashboard } from "../../types/dashboard";
import type { AHPMatrixRun, DecisionCriterion } from "../../types/decisionSupport";
import { SkeletonRows } from "../common/proto";
import { peso } from "./format";
import { ChartCard, EmptyChart, MiniBar } from "./ProtoCharts";

const WEIGHT_COLORS = ["#065f46", "#0369a1", "#b45309", "#6b21a8", "#334155", "#0891b2"];
const DECISION_META: Record<string, { label: string; color: string; background: string }> = {
  fund: { label: "Fund", color: "#059669", background: "#d1fae5" },
  defer: { label: "Defer", color: "#d97706", background: "#fef3c7" },
  decline: { label: "Decline", color: "#dc2626", background: "#fee2e2" },
  none: { label: "Undecided", color: "#64748b", background: "#f1f5f9" },
};

export function DecisionTab({ data }: { data: PerformanceDashboard | null }) {
  const [allocation, setAllocation] = useState<FundingAllocationDashboard | null | undefined>(undefined);
  const [ahpRun, setAhpRun] = useState<AHPMatrixRun | null>(null);
  const [criteria, setCriteria] = useState<DecisionCriterion[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    dashboardApi
      .getFundingAllocationDashboard()
      .then(async (d) => {
        if (!alive) return;
        setAllocation(d);
        if (!d) return;
        const [run, list] = await Promise.all([decisionSupportApi.getAHPRun(d.ahp_run), decisionSupportApi.getCriteria()]);
        if (!alive) return;
        setAhpRun(run);
        setCriteria(list);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <EmptyChart message="Could not load the decision support results." />;
  if (!data || allocation === undefined) return <SkeletonRows />;

  const inScope = new Map(data.projects.map((r) => [r.project, r]));
  const ranking = (allocation?.ranking ?? []).filter((r) => inScope.has(r.project));
  const names = new Map(criteria.map((c) => [String(c.id), c.name]));
  const weights = Object.entries(ahpRun?.weights ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(203,213,225,0.7)" }}>MCDA Decision Support System</p>
        <p className="text-white font-black text-lg">AHP &amp; WSM Funding Allocation Insights</p>
        <p className="text-sm mt-1" style={{ color: "rgba(203,213,225,0.8)" }}>
          Data-driven multi-criteria decision analysis combining Analytic Hierarchy Process (AHP) weights with the Weighted Sum Model (WSM) for proposal ranking.
        </p>
      </div>

      {!allocation ? (
        <ChartCard title="WSM Proposal Ranking & Allocation Recommendations">
          <EmptyChart message="No funding recommendation run yet. Run one from the Decision Support System page." />
        </ChartCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="AHP Criteria Weights">
            {weights.length === 0 ? (
              <EmptyChart message="Weights are not available for this run." />
            ) : (
              <div className="space-y-3">
                {weights.map(([id, w], i) => (
                  <MiniBar key={id} label={names.get(id) ?? `Criterion ${id}`} pct={Math.round(w * 100)} color={WEIGHT_COLORS[i % WEIGHT_COLORS.length]} />
                ))}
                {ahpRun?.consistency_ratio != null && (
                  <p className="text-[10px] italic pt-1" style={{ color: "#94a3b8" }}>
                    Consistency Ratio (CR) = {ahpRun.consistency_ratio.toFixed(2)} {ahpRun.is_consistent ? "< 0.10 (Acceptable)" : "> 0.10 (Inconsistent)"}
                  </p>
                )}
                <p className="text-[10px]" style={{ color: "#94a3b8" }}>
                  From AHP model “{ahpRun?.label}” used by run “{allocation.label || `#${allocation.run}`}”.
                </p>
              </div>
            )}
          </ChartCard>

          <div className="lg:col-span-2">
            <ChartCard title="WSM Proposal Ranking & Allocation Recommendations">
              {ranking.length === 0 ? (
                <EmptyChart message="No ranked projects match the selected filters." />
              ) : (
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#f0f4f8" }}>
                        {["Rank", "Proposal / Title", "Requested (LIB)", "WSM Score", "Recommendation"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((r) => {
                        const meta = DECISION_META[r.decision ?? "none"];
                        const approved = inScope.get(r.project)?.approved ?? 0;
                        return (
                          <tr key={r.project} className="border-t" style={{ borderColor: "#e2e8f0" }}>
                            <td className="px-3 py-3 text-sm font-black" style={{ color: "#0d2a5e" }}>#{r.rank}</td>
                            <td className="px-3 py-3 text-xs">
                              <p className="font-bold" style={{ color: "#0891b2" }}>{r.project_code}</p>
                              <p style={{ color: "#0d2a5e" }}>{r.title}</p>
                            </td>
                            <td className="px-3 py-3 text-xs font-mono whitespace-nowrap">{approved ? peso(approved) : "—"}</td>
                            <td className="px-3 py-3 text-sm font-black font-mono">{Number(r.composite_score).toFixed(2)}</td>
                            <td className="px-3 py-3">
                              <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: meta.background, color: meta.color }}>{meta.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
