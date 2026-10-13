import type { ForecastingDashboard, PerformanceDashboard } from "../../types/dashboard";
import { SkeletonRows } from "../common/proto";
import { FUNDING_LABELS, monthLabel, peso } from "./format";
import { ChartCard, EmptyChart, HBar, KpiBox, MiniBar } from "./ProtoCharts";

const ARIMA_ORDER = "(1, 1, 1)";
const HORIZON_MONTHS = 3;

const riskBand = (util: number) =>
  util >= 90
    ? { label: "High", color: "#ef4444", background: "#fee2e2", reason: "Utilization is at or above 90%; review remaining obligations." }
    : util >= 70
      ? { label: "Medium", color: "#d97706", background: "#fef3c7", reason: "Utilization is above 70%; monitor the remaining balance." }
      : { label: "Low", color: "#059669", background: "#d1fae5", reason: "Current utilization remains within the monitoring threshold." };

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export function ForecastTab({ data, forecast }: { data: PerformanceDashboard | null; forecast: ForecastingDashboard | null }) {
  if (!data || !forecast) return <SkeletonRows />;

  const rows = data.projects.filter((r) => r.approved > 0);
  const approved = rows.reduce((a, r) => a + r.approved, 0);
  const actual = rows.reduce((a, r) => a + r.actual, 0);
  const ledgerUtil = approved ? Math.round((actual / approved) * 100) : 0;
  const runs = new Map(forecast.projects.map((p) => [p.project, p]));
  const estimate = forecast.monthly_forecast.reduce((a, m) => a + m.predicted, 0);

  const actualByMonth = new Map(data.monthly_disbursements.map((m) => [m.month, m.total]));
  const forecastByMonth = new Map(forecast.monthly_forecast.map((m) => [m.month, m.predicted]));
  const months = [...new Set([...actualByMonth.keys(), ...forecastByMonth.keys()])].sort().slice(-12);
  const chartMax = Math.max(0, ...months.map((m) => Math.max(actualByMonth.get(m) ?? 0, forecastByMonth.get(m) ?? 0)));
  const hasChart = months.some((m) => (actualByMonth.get(m) ?? 0) > 0 || (forecastByMonth.get(m) ?? 0) > 0);

  const risks = data.projects
    .filter((r) => r.status === "active" && r.approved > 0)
    .map((r) => ({ row: r, util: Math.round(r.financial_pct ?? 0) }))
    .sort((a, b) => b.util - a.util);

  const byFunding = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.funding_type] = (acc[r.funding_type] ?? 0) + r.approved;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const overruns = forecast.projects.filter((p) => p.is_overrun_risk);
  const year = new Date().getFullYear();
  const metric = (v: number | null, suffix = "") => (v === null ? "—" : `${v.toLocaleString("en-PH", { maximumFractionDigits: 1 })}${suffix}`);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(168,196,232,0.6)" }}>Budget Forecasting Module</p>
        <p className="text-white font-black text-lg">Projected Budget Utilization — FY {year}–{year + 1}</p>
        <p className="text-sm mt-1" style={{ color: "rgba(168,196,232,0.7)" }}>
          Based on posted disbursements and each project's latest ARIMA forecast run.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label={`${HORIZON_MONTHS}-Month Estimate`} value={peso(estimate)} sub="Saved ARIMA forecasts" color="#0891b2" />
        <KpiBox label="Approved Budget" value={peso(approved)} sub="Certified LIBs in scope" color="#7c3aed" />
        <KpiBox label="Remaining Budget" value={peso(approved - actual)} sub="After posted disbursements" color="#d97706" />
        <KpiBox label="Ledger Utilization" value={`${ledgerUtil}%`} sub={`${peso(actual)} actual`} color="#059669" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Budget Projection">
          {!hasChart ? (
            <EmptyChart message="No disbursements or forecasts for the selected filters." />
          ) : (
            <>
              <div className="flex justify-center gap-4 mb-3 text-xs font-semibold" style={{ color: "#475569" }}>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: "#0891b2" }} />Actual</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: "repeating-linear-gradient(45deg, #7c3aed 0 2px, #c4b5fd 2px 4px)" }} />Estimated</span>
              </div>
              <div className="flex items-end gap-2 h-40">
                {months.map((m) => {
                  const a = actualByMonth.get(m) ?? 0;
                  const f = forecastByMonth.get(m) ?? 0;
                  return (
                    <div key={m} className="flex flex-col items-center justify-end gap-1 flex-1 h-full" title={`${monthLabel(m)}: ${peso(a)} actual · ${peso(f)} estimated`}>
                      <div className="flex items-end gap-0.5 w-full h-full justify-center">
                        {a > 0 && <div className="w-1/2 rounded-t" style={{ height: `${(a / chartMax) * 100}%`, minHeight: 3, background: "#0891b2" }} />}
                        {f > 0 && <div className="w-1/2 rounded-t" style={{ height: `${(f / chartMax) * 100}%`, minHeight: 3, background: "repeating-linear-gradient(45deg, #7c3aed 0 3px, #c4b5fd 3px 6px)" }} />}
                      </div>
                      <span style={{ color: "#94a3b8", fontSize: "10px" }}>{monthLabel(m)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-4 p-3 rounded-xl text-xs space-y-1" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b" }}>
            <p><strong style={{ color: "#0d2a5e" }}>Scope:</strong> {forecast.projects_in_scope} institutional / externally funded project{forecast.projects_in_scope !== 1 ? "s" : ""}.</p>
            <p>Actual values are posted disbursements. Estimated values are each project's latest successful ARIMA run ({HORIZON_MONTHS}-month horizon).</p>
            {forecast.projects_in_scope > forecast.projects_forecasted && (
              <p style={{ color: "#b45309" }}>
                {forecast.projects_in_scope - forecast.projects_forecasted} project{forecast.projects_in_scope - forecast.projects_forecasted !== 1 ? "s" : ""} have no saved forecast yet (ARIMA needs 6+ months of disbursements).
              </p>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Project-Level Budget Forecast">
          {rows.length === 0 ? (
            <EmptyChart message="No project budgets match the selected filters." />
          ) : (
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {rows.map((r) => {
                const run = runs.get(r.project);
                const projected = num(run?.projected_total_at_horizon);
                const saved = run && projected !== null ? projected - Number(run.actual_to_date) : null;
                const util = Math.round(r.financial_pct ?? 0);
                return (
                  <div key={r.project} className="p-3 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <p className="text-xs font-black mb-2" style={{ color: "#0d2a5e" }}>{r.project_code}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div>
                        <p style={{ color: "#94a3b8" }}>Remaining Budget</p>
                        <p className="font-black" style={{ color: "#0d2a5e" }}>{peso(r.approved - r.actual)}</p>
                      </div>
                      <div>
                        <p style={{ color: "#94a3b8" }}>Saved {HORIZON_MONTHS}-Month Estimate</p>
                        <p className="font-black" style={{ color: "#0891b2" }}>{saved === null ? "₱0" : peso(saved)}</p>
                        {saved === null && <p className="text-[10px]" style={{ color: "#b45309" }}>No saved forecast</p>}
                      </div>
                    </div>
                    <MiniBar label={`Utilized (${util}%)`} pct={util} color={riskBand(util).color} />
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Budget Risk Assessment">
          {risks.length === 0 ? (
            <EmptyChart message="No active project budgets match the selected filters." />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {risks.map(({ row, util }) => {
                const band = riskBand(util);
                return (
                  <div key={row.project} className="p-3 rounded-xl" style={{ background: band.background }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black" style={{ color: band.color }}>{row.project_code}</p>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ background: band.color }}>{band.label} Risk</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#334155" }}>{util}% utilized. {band.reason}</p>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Budget by Funding Type">
          {byFunding.length === 0 ? (
            <EmptyChart message="No budget data matches the selected filters." />
          ) : (
            <div className="space-y-2">
              {byFunding.map(([type, value], i) => (
                <HBar key={type} label={FUNDING_LABELS[type] ?? type} val={value} max={byFunding[0][1]} color={["#0d2a5e", "#0891b2", "#7c3aed", "#059669"][i % 4]} valLabel={peso(value)} />
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="ARIMA Forecasting Diagnostics">
          <div className="space-y-3 text-xs">
            <p style={{ color: "#64748b" }}>Average backtest error across the latest runs in scope</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "MAE", val: metric(num(forecast.accuracy.avg_mae)), bg: "#e0f2fe", color: "#0369a1" },
                { label: "RMSE", val: metric(num(forecast.accuracy.avg_rmse)), bg: "#ede9fe", color: "#5b21b6" },
                { label: "MAPE", val: metric(num(forecast.accuracy.avg_mape), "%"), bg: "#d1fae5", color: "#065f46" },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-lg text-center" style={{ background: m.bg }}>
                  <p className="font-bold mb-1" style={{ color: m.color }}>{m.label}</p>
                  <p className="text-sm font-black font-mono">{m.val}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]" style={{ background: "#f0f9ff" }}>
              <span style={{ color: "#64748b" }}>ARIMA (p,d,q)</span>
              <span className="font-bold text-right">{ARIMA_ORDER}</span>
              <span style={{ color: "#64748b" }}>Forecast horizon</span>
              <span className="font-bold text-right">{HORIZON_MONTHS} months</span>
              <span style={{ color: "#64748b" }}>Projects forecasted</span>
              <span className="font-bold text-right">{forecast.projects_forecasted} of {forecast.projects_in_scope}</span>
              <span style={{ color: "#64748b" }}>Backtest</span>
              <span className="font-bold text-right">Last 3 months held out (9+ months of history)</span>
            </div>
          </div>
        </ChartCard>

        <div className="md:col-span-2">
          <ChartCard title="Budget Overrun Detection">
            {overruns.length === 0 ? (
              <EmptyChart message="No project is forecast to exceed its approved budget." />
            ) : (
              <div className="space-y-3">
                {overruns.map((p) => {
                  const projected = num(p.projected_total_at_horizon) ?? 0;
                  const limit = Number(p.approved_budget_total);
                  return (
                    <div key={p.run} className="p-4 rounded-xl flex flex-wrap items-center justify-between gap-3" style={{ background: "#fee2e2", border: "1px solid #fecaca" }}>
                      <div>
                        <p className="text-xs font-black" style={{ color: "#dc2626" }}>
                          {p.project_code}
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full text-white uppercase" style={{ background: "#dc2626" }}>Overrun risk</span>
                        </p>
                        <p className="text-sm font-bold mt-1" style={{ color: "#0d2a5e" }}>{p.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: "#64748b" }}>Projected Overrun</p>
                        <p className="text-lg font-black font-mono" style={{ color: "#dc2626" }}>+{peso(projected - limit)}</p>
                        <p className="text-[10px]" style={{ color: "#64748b" }}>Forecast: {peso(projected)} (vs {peso(limit)})</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
