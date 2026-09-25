import { useEffect, useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { forecastingApi } from "../lib/forecastingApi";
import { researchApi } from "../lib/researchApi";
import { budgetApi } from "../lib/budgetApi";
import { financialApi } from "../lib/financialApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE } from "../lib/protoStyles";
import type { ForecastRun, ForecastStatus } from "../types/forecasting";
import type { Project } from "../types/research";
import type { BudgetSummary, Disbursement } from "../types/financial";
import type { LineItemBudget } from "../types/budget";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const FORECAST_ROLE_CODES = ["system_admin", "drd", "vprei", "finance_budget"];
const FORECASTABLE_FUNDING_TYPES = ["institutional", "externally_funded"];

type Method = "arima" | "burn_rate" | "linear_trend" | "moving_average" | "percent_completion";
type Scenario = "optimistic" | "base" | "conservative";
type Tab = "results" | "comparison" | "saved";

const METHOD_META: Record<Method, { label: string; icon: string; desc: string }> = {
  arima: { label: "ARIMA (server model)", icon: "🧠", desc: "Statistical model fitted on 6+ months of history, with confidence band, backtest, and overrun flag. Saved as a run." },
  burn_rate: { label: "Average Burn Rate", icon: "🔥", desc: "Average monthly disbursement so far, carried forward." },
  linear_trend: { label: "Linear Trend", icon: "📈", desc: "Least-squares trend over the anchor period, extended forward." },
  moving_average: { label: "Moving Average", icon: "〰️", desc: "Average of the most recent anchor-period months." },
  percent_completion: { label: "% Completion", icon: "🎯", desc: "Remaining budget spread evenly over the months left to the target end date." },
};

const SCENARIO_META: Record<Scenario, { label: string; color: string; bg: string }> = {
  optimistic: { label: "Optimistic", color: "#059669", bg: "#d1fae5" },
  base: { label: "Base", color: "#0891b2", bg: "#e0f2fe" },
  conservative: { label: "Conservative", color: "#dc2626", bg: "#fee2e2" },
};

const STATUS_META: Record<ForecastStatus, { label: string; bg: string; color: string }> = {
  success: { label: "Success", bg: "#d1fae5", color: "#166534" },
  insufficient_data: { label: "Insufficient Data", bg: "#fef3c7", color: "#92400e" },
  failed: { label: "Failed", bg: "#fee2e2", color: "#991b1b" },
};

const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(n));
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const labelOf = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" })} '${String(y).slice(2)}`;
};
const addMonths = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};

interface ScenarioResult {
  monthly: number[];
  total: number;
  projectedFinal: number;
  utilizationPct: number;
}

interface QuickResult {
  labels: string[];
  optimistic: ScenarioResult;
  base: ScenarioResult;
  conservative: ScenarioResult;
}

function computeQuick(
  method: Exclude<Method, "arima">,
  history: { key: string; amount: number }[],
  horizon: number,
  anchor: number,
  contingency: number,
  budget: number,
  actual: number,
  monthsLeft: number,
): QuickResult {
  const amounts = history.map((h) => h.amount);
  const recent = amounts.slice(-anchor);
  let base: number[];
  if (method === "burn_rate") {
    const avg = amounts.reduce((a, b) => a + b, 0) / Math.max(1, amounts.length);
    base = Array(horizon).fill(avg);
  } else if (method === "moving_average") {
    const avg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    base = Array(horizon).fill(avg);
  } else if (method === "linear_trend") {
    const n = recent.length;
    const xs = recent.map((_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const my = recent.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const slope = den ? xs.reduce((s, x, i) => s + (x - mx) * (recent[i] - my), 0) / den : 0;
    base = Array.from({ length: horizon }, (_, i) => Math.max(0, my + slope * (n - mx + i)));
  } else {
    const remaining = Math.max(0, budget - actual);
    const perMonth = remaining / Math.max(1, monthsLeft);
    base = Array.from({ length: horizon }, (_, i) => (i < monthsLeft ? perMonth : 0));
  }
  const build = (factor: number): ScenarioResult => {
    const monthly = base.map((v) => Math.round(v * factor));
    const total = monthly.reduce((a, b) => a + b, 0);
    const projectedFinal = actual + total;
    return { monthly, total, projectedFinal, utilizationPct: budget > 0 ? Math.round((projectedFinal / budget) * 100) : 0 };
  };
  const last = history[history.length - 1]?.key ?? monthKey(new Date());
  return {
    labels: Array.from({ length: horizon }, (_, i) => labelOf(addMonths(last, i + 1))),
    optimistic: build(0.85),
    base: build(1),
    conservative: build(1 + contingency / 100),
  };
}

function QuickChart({ history, result, scenario }: { history: { key: string; amount: number }[]; result: QuickResult; scenario: Scenario }) {
  const sm = SCENARIO_META[scenario];
  const hist = history.slice(-12);
  const fc = result[scenario].monthly.slice(0, 12);
  const max = Math.max(...hist.map((h) => h.amount), ...fc, 1);
  const H = 180;
  const bar = (amt: number, key: string, label: string, color: string, dashed: boolean) => (
    <div key={key} className="flex flex-col items-center gap-1 shrink-0" style={{ width: "36px" }}>
      <span className="font-mono" style={{ color: "#94a3b8", fontSize: "9px" }}>{amt >= 1000 ? `${Math.round(amt / 1000)}k` : amt}</span>
      <div className="w-full rounded-t" style={{ height: `${Math.max(4, Math.round((amt / max) * H))}px`, background: color, opacity: dashed ? 0.7 : 1, border: dashed ? `1.5px dashed ${color}` : undefined }} />
      <span style={{ color: dashed ? color : "#94a3b8", fontSize: "9px", transform: "rotate(-45deg)", transformOrigin: "top left", whiteSpace: "nowrap", marginTop: "2px" }}>{label}</span>
    </div>
  );
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: "#0d2a5e" }} />
          <span className="text-xs font-semibold" style={{ color: "#64748b" }}>Actual (last {hist.length} months)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: sm.color }} />
          <span className="text-xs font-semibold" style={{ color: "#64748b" }}>{sm.label} Forecast</span>
        </div>
      </div>
      <div className="flex items-end gap-1 overflow-x-auto pb-6" style={{ height: `${H + 48}px` }}>
        {hist.map((h) => bar(h.amount, h.key, labelOf(h.key), "#0d2a5e", false))}
        <div className="shrink-0" style={{ width: "16px" }}>
          <div className="w-px h-full mx-auto" style={{ background: "#e2e8f0" }} />
        </div>
        {fc.map((amt, i) => bar(amt, `f${i}`, result.labels[i], sm.color, true))}
      </div>
    </div>
  );
}

const arimaConfig: ChartConfig = { predicted: { label: "Predicted Disbursement", color: "#0891b2" } };

function ArimaChart({ run }: { run: ForecastRun }) {
  const rows = run.forecasts.map((f) => ({
    period: new Date(f.period).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
    predicted: Number(f.predicted_amount),
    lower: Number(f.lower_bound),
    upper: Number(f.upper_bound),
  }));
  if (rows.length === 0) return <NoActualData message="No monthly forecast points" />;
  return (
    <ChartContainer config={arimaConfig} className="aspect-auto h-64 w-full">
      <ComposedChart data={rows} margin={{ top: 24, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="period" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => `₱${(v / 1000).toLocaleString()}K`} width={64} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (name === "predicted" ? peso(Number(value)) : undefined)} />} />
        <Area dataKey={(d: { lower: number; upper: number }) => [d.lower, d.upper]} stroke="none" fill="var(--color-predicted)" fillOpacity={0.12} isAnimationActive={false} />
        <Line dataKey="predicted" stroke="var(--color-predicted)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-predicted)" }} isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

function Pill({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color }}>{children}</span>;
}

function ForecastContent() {
  const { user } = useAuth();
  const canRun = FORECAST_ROLE_CODES.includes(user?.role?.code ?? "");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [budget, setBudget] = useState<LineItemBudget | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[] | null>(null);
  const [runs, setRuns] = useState<ForecastRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("arima");
  const [horizon, setHorizon] = useState(6);
  const [anchor, setAnchor] = useState(6);
  const [contingency, setContingency] = useState(15);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [tab, setTab] = useState<Tab>("results");
  const [ranQuick, setRanQuick] = useState(false);
  const [running, setRunning] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    researchApi
      .getProjects()
      .then((all) => {
        if (!active) return;
        const list = all.filter((p) => FORECASTABLE_FUNDING_TYPES.includes(p.funding_type));
        setProjects(list);
        if (list[0]) setProjectId(list[0].id);
      })
      .catch(() => {
        if (!active) return;
        setProjects([]);
        notify.error("Could not load projects. Check your connection and refresh.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (projectId === null) return;
    let active = true;
    Promise.all([budgetApi.getBudgets(projectId), financialApi.getDisbursements({ project: projectId }), forecastingApi.getRuns({ project: projectId })])
      .then(([budgets, disb, r]) => {
        if (!active) return;
        const current = budgets.find((b) => b.is_current) ?? null;
        setBudget(current);
        setDisbursements(disb);
        setRuns(r);
        setSelectedRunId(r[0]?.id ?? null);
        if (current?.status === "certified") {
          financialApi.getBudgetSummary(current.id).then((s) => active && setSummary(s)).catch(() => undefined);
        } else {
          setSummary(null);
        }
      })
      .catch(() => active && notify.error("Could not load this project's financial history."));
    return () => {
      active = false;
    };
  }, [projectId]);

  const project = projects?.find((p) => p.id === projectId) ?? null;
  const budgetTotal = summary ? summary.totals.adjusted : Number(budget?.total_amount ?? 0);
  const actual = (disbursements ?? []).reduce((s, d) => s + Number(d.amount), 0);

  const history = useMemo(() => {
    const byMonth: Record<string, number> = {};
    (disbursements ?? []).forEach((d) => (byMonth[d.disbursed_on.slice(0, 7)] = (byMonth[d.disbursed_on.slice(0, 7)] ?? 0) + Number(d.amount)));
    const keys = Object.keys(byMonth).sort();
    if (!keys.length) return [];
    const out: { key: string; amount: number }[] = [];
    for (let k = keys[0]; k <= monthKey(now); k = addMonths(k, 1)) out.push({ key: k, amount: byMonth[k] ?? 0 });
    return out;
  }, [disbursements, now]);

  const monthsLeft = project?.target_end_date
    ? Math.max(1, (new Date(project.target_end_date).getFullYear() - now.getFullYear()) * 12 + new Date(project.target_end_date).getMonth() - now.getMonth())
    : horizon;

  const quick = useMemo(
    () => (method === "arima" || history.length === 0 ? null : computeQuick(method, history, horizon, Math.min(anchor, history.length), contingency, budgetTotal, actual, monthsLeft)),
    [method, history, horizon, anchor, contingency, budgetTotal, actual, monthsLeft],
  );
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  const run = async () => {
    if (method !== "arima") {
      setRanQuick(true);
      setTab("results");
      return;
    }
    if (!projectId) return;
    setRunning(true);
    try {
      const r = await forecastingApi.triggerRun(projectId);
      setRuns((prev) => [r, ...prev]);
      setSelectedRunId(r.id);
      setTab("results");
      if (r.status === "success") notify.success(r.is_overrun_risk ? "Forecast complete — overrun risk flagged." : "Forecast complete.");
      else if (r.status === "insufficient_data") notify.warning(r.error_message);
      else notify.error(r.error_message || "The forecast fit failed.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not run a forecast for this project."));
    } finally {
      setRunning(false);
    }
  };

  if (projects === null) return <div className="h-64 rounded-2xl animate-pulse" style={{ background: "white", border: "1px solid #e2e8f0" }} />;
  if (projects.length === 0) return <NoActualData hint="Forecasting covers institutional and externally-funded projects only." />;

  const utilNow = budgetTotal > 0 ? Math.round((actual / budgetTotal) * 100) : 0;
  const showQuick = method !== "arima" && ranQuick && quick;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl overflow-hidden self-start" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
            <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>Forecast Parameters</p>
            <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>Institutional & externally-funded projects</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="label-field">Project</label>
              <select
                value={projectId ?? ""}
                onChange={(e) => {
                  setProjectId(Number(e.target.value));
                  setRanQuick(false);
                  setDisbursements(null);
                }}
                className={INPUT_CLS}
                style={INPUT_STYLE}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_code}</option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl p-3 space-y-2" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#94a3b8" }}>Current Budget Status</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    [summary ? "Adjusted Budget" : "LIB Total", budgetTotal ? peso(budgetTotal) : "—", "#0d2a5e"],
                    ["Disbursed", peso(actual), "#0891b2"],
                    ["Remaining", budgetTotal ? peso(budgetTotal - actual) : "—", "#059669"],
                    ["Utilization", budgetTotal ? `${utilNow}%` : "—", "#f59e0b"],
                  ] as const
                ).map(([l, v, c]) => (
                  <div key={l}>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>{l}</p>
                    <p className="text-sm font-black" style={{ color: c }}>{v}</p>
                  </div>
                ))}
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: "5px", background: "#e2e8f0" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, utilNow)}%`, background: "#0891b2" }} />
              </div>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                {history.length} month{history.length !== 1 ? "s" : ""} of disbursement history
                {budget && budget.status !== "certified" ? " · LIB not yet certified" : ""}
              </p>
            </div>
            <div>
              <label className="label-field">Forecast Method</label>
              <div className="space-y-2 mt-1">
                {(Object.entries(METHOD_META) as [Method, (typeof METHOD_META)[Method]][]).map(([k, m]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setMethod(k);
                      setRanQuick(false);
                    }}
                    className="w-full text-left rounded-xl px-3 py-2.5 transition-all"
                    style={{ background: method === k ? "#e0eaf7" : "#f8fafc", border: `1.5px solid ${method === k ? "#0d2a5e40" : "#e2e8f0"}` }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{m.icon}</span>
                      <p className="text-xs font-black" style={{ color: "#0d2a5e" }}>{m.label}</p>
                      {method === k && <span className="ml-auto text-xs" style={{ color: "#0d2a5e" }}>✓</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {method !== "arima" && (
              <>
                <div>
                  <label className="label-field">Forecast Horizon: <strong>{horizon} months</strong></label>
                  <input type="range" min={1} max={24} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="w-full mt-1" />
                </div>
                {(method === "linear_trend" || method === "moving_average") && (
                  <div>
                    <label className="label-field">Anchor Period (recent months): <strong>{Math.min(anchor, Math.max(1, history.length))}</strong></label>
                    <input type="range" min={1} max={Math.max(2, Math.min(12, history.length))} value={anchor} onChange={(e) => setAnchor(Number(e.target.value))} className="w-full mt-1" />
                  </div>
                )}
                <div>
                  <label className="label-field">Contingency Buffer (Conservative): <strong>{contingency}%</strong></label>
                  <input type="range" min={5} max={40} step={5} value={contingency} onChange={(e) => setContingency(Number(e.target.value))} className="w-full mt-1" />
                </div>
              </>
            )}
            {method === "arima" && !canRun ? (
              <p className="text-xs" style={{ color: "#94a3b8" }}>Only DRD, VPREI, the Budget Officer, or the System Admin can run the ARIMA model. Past runs are under "Saved Forecasts".</p>
            ) : (
              <button
                onClick={run}
                disabled={running || (method !== "arima" && history.length === 0)}
                className="w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #0d2a5e, #0891b2)" }}
              >
                ▶ {running ? "Running…" : method === "arima" ? "Run ARIMA Forecast" : "Run Forecast"}
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl overflow-hidden self-start" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
            {(
              [
                ["results", "Projections & Chart"],
                ["comparison", "Budget Comparison"],
                ["saved", `Saved Forecasts (${runs.length})`],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="px-5 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap"
                style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="p-5">
            {disbursements === null ? (
              <div className="h-48 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
            ) : tab === "results" ? (
              method === "arima" ? (
                !selectedRun ? (
                  <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc" }}>
                    <p className="text-3xl mb-2">▶️</p>
                    <p className="text-sm font-bold" style={{ color: "#64748b" }}>No ARIMA run for this project yet.</p>
                    <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>The model needs at least 6 months of disbursement history.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>Run from {new Date(selectedRun.run_at).toLocaleString()}</p>
                        <p className="text-xs" style={{ color: "#94a3b8" }}>
                          {selectedRun.months_of_history} months of history{selectedRun.arima_order ? ` · ARIMA order ${selectedRun.arima_order}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {selectedRun.is_overrun_risk && <Pill bg="#fee2e2" color="#991b1b">⚠ Overrun Risk</Pill>}
                        <Pill bg={STATUS_META[selectedRun.status].bg} color={STATUS_META[selectedRun.status].color}>{STATUS_META[selectedRun.status].label}</Pill>
                      </div>
                    </div>
                    {selectedRun.status !== "success" ? (
                      <div className="rounded-xl px-4 py-3" style={{ background: "#fef3c7", border: "1px solid #fcd34d" }}>
                        <p className="text-xs" style={{ color: "#92400e" }}>{selectedRun.error_message || "This run did not produce a forecast."}</p>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Monthly Disbursement Forecast (with confidence band)</p>
                          <ArimaChart run={selectedRun} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            ["Approved Budget", selectedRun.approved_budget_total ? peso(selectedRun.approved_budget_total) : "—", "#0d2a5e", "#e0eaf7"],
                            ["Actual to Date", selectedRun.actual_to_date ? peso(selectedRun.actual_to_date) : "—", "#0891b2", "#e0f2fe"],
                            ["Projected at Horizon", selectedRun.projected_total_at_horizon ? peso(selectedRun.projected_total_at_horizon) : "—", selectedRun.is_overrun_risk ? "#dc2626" : "#059669", selectedRun.is_overrun_risk ? "#fee2e2" : "#d1fae5"],
                            ["MAE", selectedRun.mae ? peso(selectedRun.mae) : "Not backtested", "#475569", "#f1f5f9"],
                            ["RMSE", selectedRun.rmse ? peso(selectedRun.rmse) : "Not backtested", "#475569", "#f1f5f9"],
                            ["MAPE", selectedRun.mape ? `${selectedRun.mape}%` : "Not backtested", "#475569", "#f1f5f9"],
                          ].map(([l, v, c, bg]) => (
                            <div key={l} className="rounded-xl p-3" style={{ background: bg }}>
                              <p className="text-xs font-bold" style={{ color: c }}>{l}</p>
                              <p className="text-lg font-black mt-0.5 font-mono" style={{ color: c }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              ) : history.length === 0 ? (
                <NoActualData hint="No disbursements recorded for this project yet." />
              ) : !showQuick ? (
                <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc" }}>
                  <p className="text-3xl mb-2">▶️</p>
                  <p className="text-sm font-bold" style={{ color: "#64748b" }}>Configure parameters and click Run Forecast to generate projections.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex gap-2">
                    {(["optimistic", "base", "conservative"] as Scenario[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setScenario(s)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: scenario === s ? SCENARIO_META[s].bg : "#f8fafc", color: SCENARIO_META[s].color, border: `1.5px solid ${scenario === s ? SCENARIO_META[s].color + "40" : "#e2e8f0"}` }}
                      >
                        {SCENARIO_META[s].label}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>
                      Monthly Disbursement: Actual + {SCENARIO_META[scenario].label} Forecast ({METHOD_META[method].label})
                    </p>
                    <QuickChart history={history} result={quick!} scenario={scenario} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(["optimistic", "base", "conservative"] as Scenario[]).map((s) => {
                      const m = SCENARIO_META[s];
                      const r = quick![s];
                      const over = budgetTotal > 0 && r.projectedFinal > budgetTotal;
                      return (
                        <div key={s} className="rounded-2xl p-4" style={{ background: m.bg, border: `1.5px solid ${m.color}20` }}>
                          <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: m.color }}>{m.label}</p>
                          <p className="text-lg font-black" style={{ color: m.color }}>{budgetTotal ? `${r.utilizationPct}%` : "—"}</p>
                          <p className="text-xs font-semibold mt-0.5" style={{ color: m.color }}>projected utilization</p>
                          <div className="mt-2 pt-2 border-t" style={{ borderColor: m.color + "20" }}>
                            <p className="text-xs" style={{ color: m.color }}>+ {peso(r.total)} forecast</p>
                            <p className="text-xs font-bold mt-0.5" style={{ color: over ? "#dc2626" : "#059669" }}>
                              Final: {peso(r.projectedFinal)} {over ? "⚠️" : "✓"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Month</th>
                          {(["optimistic", "base", "conservative"] as Scenario[]).map((s) => (
                            <th key={s} className="px-3 py-2.5 text-right font-bold uppercase tracking-wide" style={{ color: SCENARIO_META[s].color }}>{SCENARIO_META[s].label}</th>
                          ))}
                          <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Base Cumul.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quick!.labels.map((month, i) => {
                          const cumul = actual + quick!.base.monthly.slice(0, i + 1).reduce((s, a) => s + a, 0);
                          return (
                            <tr key={month} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                              <td className="px-3 py-2 font-mono font-semibold" style={{ color: "#0d2a5e" }}>{month}</td>
                              {(["optimistic", "base", "conservative"] as Scenario[]).map((s) => (
                                <td key={s} className="px-3 py-2 text-right font-mono" style={{ color: SCENARIO_META[s].color }}>{peso(quick![s].monthly[i] ?? 0)}</td>
                              ))}
                              <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: budgetTotal && cumul > budgetTotal ? "#dc2626" : "#059669" }}>{peso(cumul)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    Quick projections are computed in the browser from this project's recorded disbursements and are not saved. Use ARIMA for a stored, backtested run.
                  </p>
                </div>
              )
            ) : tab === "comparison" ? (
              !budgetTotal ? (
                <NoActualData hint="Needs a LIB for this project." />
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Approved Budget vs. Actuals vs. Projections</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: summary ? "Adjusted Budget" : "LIB Total", val: budgetTotal, color: "#0d2a5e", bg: "#e0eaf7" },
                      { label: "Actual Disbursed", val: actual, color: "#0891b2", bg: "#e0f2fe" },
                      { label: "Remaining Balance", val: budgetTotal - actual, color: "#059669", bg: "#d1fae5" },
                      ...(quick
                        ? (["optimistic", "base", "conservative"] as Scenario[]).map((s) => ({
                            label: `${SCENARIO_META[s].label} (${METHOD_META[method].label})`,
                            val: quick[s].projectedFinal,
                            color: SCENARIO_META[s].color,
                            bg: SCENARIO_META[s].bg,
                          }))
                        : []),
                      ...(selectedRun?.projected_total_at_horizon
                        ? [{ label: "ARIMA at horizon", val: Number(selectedRun.projected_total_at_horizon), color: "#6b21a8", bg: "#faf5ff" }]
                        : []),
                    ].map((item) => {
                      const over = item.val > budgetTotal && item.label !== "Remaining Balance";
                      return (
                        <div key={item.label} className="rounded-xl p-3" style={{ background: item.bg }}>
                          <p className="text-xs font-bold" style={{ color: item.color }}>{item.label}</p>
                          <p className="text-lg font-black mt-0.5" style={{ color: over ? "#dc2626" : item.color }}>{peso(item.val)}</p>
                          {over && <p className="text-xs font-bold" style={{ color: "#dc2626" }}>⚠️ Exceeds budget</p>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    {[
                      { label: "Actual (to date)", pct: utilNow, color: "#0891b2" },
                      ...(quick ? (["optimistic", "base", "conservative"] as Scenario[]).map((s) => ({ label: `${SCENARIO_META[s].label} scenario`, pct: quick[s].utilizationPct, color: SCENARIO_META[s].color })) : []),
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3">
                        <p className="text-xs font-semibold w-40 shrink-0" style={{ color: "#334155" }}>{row.label}</p>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: "8px", background: "#e2e8f0" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.pct)}%`, background: row.pct > 100 ? "#dc2626" : row.color }} />
                        </div>
                        <span className="text-xs font-black w-10 text-right shrink-0" style={{ color: row.pct > 100 ? "#dc2626" : row.color }}>{row.pct}%</span>
                      </div>
                    ))}
                  </div>
                  {summary && (
                    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["Category", "Adjusted", "Disbursed", "Util.", "Available"].map((h) => (
                              <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {summary.by_category.map((c) => (
                            <tr key={c.category} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                              <td className="px-3 py-2 font-semibold uppercase" style={{ color: "#334155" }}>{c.category}</td>
                              <td className="px-3 py-2 font-mono" style={{ color: "#0d2a5e" }}>{peso(c.adjusted)}</td>
                              <td className="px-3 py-2 font-mono" style={{ color: "#0891b2" }}>{peso(c.actual)}</td>
                              <td className="px-3 py-2" style={{ color: "#64748b" }}>{Math.round(c.utilization_pct ?? 0)}%</td>
                              <td className="px-3 py-2 font-mono font-bold" style={{ color: "#059669" }}>{peso(c.available)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            ) : runs.length === 0 ? (
              <NoActualData message="No saved forecasts yet." hint={canRun ? "Run the ARIMA model to save a forecast." : undefined} />
            ) : (
              <div className="space-y-3">
                {runs.map((r) => (
                  <div key={r.id} className="rounded-2xl p-4" style={{ background: r.id === selectedRunId ? "#f0f9ff" : "#f8fafc", border: `1px solid ${r.id === selectedRunId ? "#bae6fd" : "#e2e8f0"}` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Pill bg="#e0eaf7" color="#0d2a5e">{project?.project_code}</Pill>
                          <Pill bg="#f1f5f9" color="#64748b">🧠 ARIMA{r.arima_order ? ` ${r.arima_order}` : ""}</Pill>
                          <Pill bg={STATUS_META[r.status].bg} color={STATUS_META[r.status].color}>{STATUS_META[r.status].label}</Pill>
                          {r.is_overrun_risk && <Pill bg="#fee2e2" color="#991b1b">⚠ Overrun risk</Pill>}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                          Run {new Date(r.run_at).toLocaleString()} · {r.months_of_history} months of history
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: "#94a3b8" }}>Projected at horizon</p>
                        <p className="text-lg font-black font-mono" style={{ color: r.is_overrun_risk ? "#dc2626" : "#059669" }}>{r.projected_total_at_horizon ? peso(r.projected_total_at_horizon) : "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: "#e2e8f0" }}>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>
                        Budget: {r.approved_budget_total ? peso(r.approved_budget_total) : "—"} · Actual: {r.actual_to_date ? peso(r.actual_to_date) : "—"} · MAPE {r.mape ? `${r.mape}%` : "n/a"}
                      </p>
                      <button
                        onClick={() => {
                          setSelectedRunId(r.id);
                          setMethod("arima");
                          setTab("results");
                        }}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: "#e0eaf7", color: "#0d2a5e" }}
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BudgetForecastPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Budget Forecasting">
        <ForecastContent />
      </AppShell>
    </ProtectedRoute>
  );
}
