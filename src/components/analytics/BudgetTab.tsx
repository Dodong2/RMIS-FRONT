import type { PerformanceDashboard } from "../../types/dashboard";
import { SkeletonRows } from "../common/proto";
import { monthLabel, peso } from "./format";
import { ChartCard, EmptyChart, KpiBox, TrendBar } from "./ProtoCharts";

const utilColor = (util: number) => (util >= 90 ? "#ef4444" : util >= 70 ? "#f59e0b" : "#0891b2");

export function BudgetTab({ data }: { data: PerformanceDashboard | null }) {
  if (!data) return <SkeletonRows />;
  const rows = data.projects.filter((r) => r.approved > 0);
  const totalBudget = rows.reduce((a, r) => a + r.approved, 0);
  const totalDisbursed = rows.reduce((a, r) => a + r.actual, 0);
  const utilization = totalBudget ? Math.round((totalDisbursed / totalBudget) * 100) : 0;

  const months = data.monthly_disbursements;
  const periodTotal = months.reduce((a, m) => a + m.total, 0);
  const transactions = months.reduce((a, m) => a + m.count, 0);
  const highest = months.reduce<(typeof months)[number] | null>((best, m) => (m.total > 0 && (!best || m.total > best.total) ? m : best), null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Total Budget" value={peso(totalBudget)} sub={`${rows.length} project${rows.length !== 1 ? "s" : ""} with a budget`} color="#0d2a5e" />
        <KpiBox label="Total Disbursed" value={peso(totalDisbursed)} sub={`${utilization}% utilization`} color="#0891b2" />
        <KpiBox label="Remaining" value={peso(totalBudget - totalDisbursed)} sub="Undisbursed" color="#059669" />
        <KpiBox label="Avg. Utilization" value={`${utilization}%`} color="#d97706" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Budget Utilization by Project">
          {rows.length === 0 ? (
            <EmptyChart message="No project budgets match the selected filters." />
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {rows.map((p) => {
                const util = Math.round(p.financial_pct ?? 0);
                return (
                  <div key={p.project} className="p-3 rounded-xl" style={{ background: "#f8fafc" }}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-semibold line-clamp-1 flex-1 pr-2" style={{ color: "#0d2a5e" }} title={p.title}>{p.title}</p>
                      <span className="text-xs font-black shrink-0" style={{ color: "#0891b2" }}>{util}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, util)}%`, background: utilColor(util) }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1" style={{ color: "#94a3b8" }}>
                      <span>{peso(p.actual)} disbursed</span>
                      <span>of {peso(p.approved)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Monthly Disbursement Trend (Latest 12 Months)">
          {transactions > 0 ? (
            <TrendBar labels={months.map((m) => monthLabel(m.month))} values={months.map((m) => m.total)} color="#0891b2" format={peso} />
          ) : (
            <EmptyChart message="No disbursement records found for the selected filters." />
          )}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            {[
              { label: "Highest Month", val: highest ? monthLabel(highest.month) : "—", sub: peso(highest?.total ?? 0) },
              { label: "Avg/Month", val: peso(periodTotal / Math.max(months.length, 1)), sub: "monthly avg." },
              { label: "Period Total", val: peso(periodTotal), sub: `${transactions} transaction${transactions !== 1 ? "s" : ""}` },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl" style={{ background: "#f0f9ff" }}>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{item.label}</p>
                <p className="text-sm font-black mt-0.5" style={{ color: "#0d2a5e" }}>{item.val}</p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
