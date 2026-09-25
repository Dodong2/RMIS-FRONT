import { useEffect, useMemo, useState } from "react";
import { monitoringApi } from "../lib/monitoringApi";
import { outputsApi } from "../lib/outputsApi";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { notify } from "../lib/notify";
import type { EscalationStatus, ProjectEvaluation, ProjectMonitoringStatus } from "../types/monitoring";
import type { ExpectedVsActual } from "../types/outputs";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { SkeletonRows } from "../components/common/proto";
import { EvaluationsPanel, RubricPanel } from "../components/monitoring/Evaluations";
import { ExtensionsPanel, ProgressReportsPanel, RenewalPanel } from "../components/monitoring/Reports";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const REPORT_ROLE_CODES = ["system_admin", "riuh", "project_leader", "study_leader", "project_staff"];
const CERTIFY_ROLE_CODES = ["system_admin", "riuh"];
const EVALUATE_ROLE_CODES = ["system_admin", "vprei", "drd", "crc_chair"];
const RENEWAL_DECIDE_ROLE_CODES = ["system_admin", "riuh", "drd", "vprei"];
const EXT_REQUEST_ROLE_CODES = ["system_admin", "program_leader", "project_leader"];
const EXT_ENDORSE_ROLE_CODES = ["system_admin", "drd", "crc_chair"];
const EXT_APPROVE_ROLE_CODES = ["system_admin", "university_admin"];

type IndicatorType = "output" | "outcome" | "process";
type IndicatorStatus = "on_track" | "at_risk" | "off_track" | "achieved" | "not_started";
type BoardTab = "indicators" | "performance" | "evaluations" | "reports" | "extensions" | "renewal";

type Indicator = {
  key: string;
  name: string;
  type: IndicatorType;
  status: IndicatorStatus;
  value: string;
  target: string;
  pct: number | null;
  note: string;
};

const IND_TYPE_META: Record<IndicatorType, { label: string; color: string; bg: string; icon: string }> = {
  output: { label: "Output", color: "#0891b2", bg: "#e0f2fe", icon: "📤" },
  outcome: { label: "Outcome", color: "#0d2a5e", bg: "#e0eaf7", icon: "📊" },
  process: { label: "Process", color: "#92400e", bg: "#fef3c7", icon: "⚙️" },
};

const IND_STATUS_META: Record<IndicatorStatus, { label: string; bg: string; text: string; dot: string }> = {
  on_track: { label: "On Track", bg: "#d1fae5", text: "#166534", dot: "#059669" },
  at_risk: { label: "At Risk", bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  off_track: { label: "Off Track", bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  achieved: { label: "Achieved ✓", bg: "#d1fae5", text: "#166534", dot: "#22c55e" },
  not_started: { label: "Not Started", bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
};

const ESCALATION_META: Record<EscalationStatus, { label: string; bg: string; color: string }> = {
  unknown: { label: "No monthly report yet", bg: "#f1f5f9", color: "#475569" },
  on_track: { label: "Reporting on track", bg: "#d1fae5", color: "#166534" },
  notify_dean_riuh: { label: "Non-submission: notify Dean/RIUH", bg: "#fef3c7", color: "#92400e" },
  terminate_recommended: { label: "Non-submission: termination recommended", bg: "#fee2e2", color: "#991b1b" },
};

const ratioStatus = (ratio: number): IndicatorStatus => (ratio >= 1 ? "achieved" : ratio >= 0.7 ? "on_track" : ratio >= 0.4 ? "at_risk" : "off_track");

function buildIndicators(s: ProjectMonitoringStatus, eva: ExpectedVsActual | null): Indicator[] {
  const i = s.indicators;
  const esc: Record<EscalationStatus, IndicatorStatus> = { unknown: "not_started", on_track: "on_track", notify_dean_riuh: "at_risk", terminate_recommended: "off_track" };
  const pctInd = (key: string, name: string, type: IndicatorType, pct: number | null, note: string): Indicator => ({
    key,
    name,
    type,
    status: pct === null ? "not_started" : ratioStatus(pct / 70),
    value: pct === null ? "—" : `${pct.toFixed(1)}%`,
    target: "70%",
    pct: pct === null ? null : Math.min(100, (pct / 70) * 100),
    note,
  });
  const list: Indicator[] = [
    {
      key: "monthly",
      name: "Monthly progress report submission",
      type: "process",
      status: esc[i.monthly_report.status],
      value: i.monthly_report.months_since_last_report === null ? "none yet" : `${i.monthly_report.months_since_last_report} mo ago`,
      target: "every month",
      pct: null,
      note: ESCALATION_META[i.monthly_report.status].label,
    },
    pctInd("budget", "Budget utilization", "process", i.budget_utilization_pct, "Actual disbursements vs. certified LIB (renewal needs ≥ 70%)"),
    pctInd("deliverables", "Deliverables completion", "output", i.deliverables_pct, "Done milestones vs. all work-plan milestones (renewal needs ≥ 70%)"),
    {
      key: "midterm",
      name: "Midterm reports (Appendix E)",
      type: "output",
      status: i.midterm_report_years.length ? "on_track" : "not_started",
      value: String(i.midterm_report_years.length),
      target: "1 per project year",
      pct: null,
      note: i.midterm_report_years.length ? `Submitted for year ${i.midterm_report_years.join(", ")}` : "No midterm report yet",
    },
    {
      key: "terminal",
      name: "Terminal report (Appendix F)",
      type: "output",
      status: i.terminal_report_submitted ? "achieved" : "not_started",
      value: i.terminal_report_submitted ? "Submitted" : "Not yet",
      target: "1",
      pct: i.terminal_report_submitted ? 100 : 0,
      note: "Due at project completion",
    },
    ...(eva?.by_category ?? [])
      .filter((c) => c.target > 0)
      .map<Indicator>((c) => ({
        key: `6p-${c.category}`,
        name: `6Ps — ${c.label}`,
        type: "output",
        status: c.actual === 0 ? "not_started" : ratioStatus(c.actual / c.target),
        value: String(c.actual),
        target: String(c.target),
        pct: Math.min(100, (c.actual / c.target) * 100),
        note: "Expected vs actual research outputs",
      })),
    {
      key: "evaluation",
      name: "Latest annual evaluation",
      type: "outcome",
      status: !i.latest_evaluation ? "not_started" : { pending: "on_track", passed: "achieved", conditional: "at_risk", failed: "off_track" }[i.latest_evaluation.outcome] as IndicatorStatus,
      value: i.latest_evaluation ? i.latest_evaluation.outcome : "—",
      target: "passed",
      pct: null,
      note: i.latest_evaluation ? `Scheduled ${i.latest_evaluation.scheduled_date}` : "No evaluation scheduled",
    },
    {
      key: "similarity",
      name: "Similarity checks within threshold",
      type: "process",
      status: i.similarity_checks.total === 0 ? "not_started" : i.similarity_checks.over_threshold > 0 ? "at_risk" : "achieved",
      value: `${i.similarity_checks.total - i.similarity_checks.over_threshold}/${i.similarity_checks.total}`,
      target: "all within",
      pct: i.similarity_checks.total ? ((i.similarity_checks.total - i.similarity_checks.over_threshold) / i.similarity_checks.total) * 100 : null,
      note: `${i.similarity_checks.over_threshold} over threshold`,
    },
    {
      key: "ai",
      name: "AI declarations under 20% AI content",
      type: "process",
      status: i.ai_declarations.total === 0 ? "not_started" : i.ai_declarations.over_threshold > 0 ? "at_risk" : "achieved",
      value: `${i.ai_declarations.total - i.ai_declarations.over_threshold}/${i.ai_declarations.total}`,
      target: "all under",
      pct: i.ai_declarations.total ? ((i.ai_declarations.total - i.ai_declarations.over_threshold) / i.ai_declarations.total) * 100 : null,
      note: `${i.ai_declarations.over_threshold} over 20%`,
    },
    {
      key: "procurement",
      name: "Procurement requests without delay",
      type: "process",
      status: i.procurement_delayed === 0 ? "on_track" : "at_risk",
      value: `${i.procurement_delayed} delayed`,
      target: "0 delayed",
      pct: null,
      note: "Open more than 30 days",
    },
    {
      key: "realignment",
      name: "Budget realignments this year",
      type: "process",
      status: i.realignments_this_year <= 1 ? "on_track" : "at_risk",
      value: String(i.realignments_this_year),
      target: "≤ 1 per year",
      pct: null,
      note: "Manual allows one realignment per calendar year",
    },
    {
      key: "forecast",
      name: "Forecast overrun risk",
      type: "process",
      status: i.forecast_overrun_risk === null ? "not_started" : i.forecast_overrun_risk ? "off_track" : "on_track",
      value: i.forecast_overrun_risk === null ? "no forecast" : i.forecast_overrun_risk ? "overrun risk" : "within budget",
      target: "within budget",
      pct: null,
      note: "Latest successful ARIMA forecast run",
    },
    {
      key: "budget_office",
      name: "Budget Office reconciliation",
      type: "process",
      status: { matched: "achieved", discrepancy: "off_track", no_rmis_budget: "at_risk", unlinked: "not_started" }[i.budget_office_status ?? "unlinked"] as IndicatorStatus,
      value: i.budget_office_status ? i.budget_office_status.replace(/_/g, " ") : "no import",
      target: "matched",
      pct: null,
      note: "Consolidated LIB workbook vs. RMIS LIB",
    },
  ];
  return list;
}

function IndicatorStatusBadge({ s }: { s: IndicatorStatus }) {
  const m = IND_STATUS_META[s];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function TypeChip({ t }: { t: IndicatorType }) {
  const m = IND_TYPE_META[t];
  return <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>{m.icon} {m.label}</span>;
}

function ProgressBar({ pct, status }: { pct: number; status: IndicatorStatus }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: "#f1f5f9" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: IND_STATUS_META[status].dot }} />
    </div>
  );
}

function MonitoringContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const can = (codes: string[]) => codes.includes(code);

  const [view, setView] = useState<"board" | "rubric">("board");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [projectId, setProjectId] = useState<number | null>(null);
  const [status, setStatus] = useState<ProjectMonitoringStatus | null>(null);
  const [eva, setEva] = useState<ExpectedVsActual | null>(null);
  const [evals, setEvals] = useState<ProjectEvaluation[]>([]);
  const [tab, setTab] = useState<BoardTab>("indicators");
  const [typeFilter, setTypeFilter] = useState<IndicatorType | "all">("all");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    researchApi
      .getProjects()
      .then((p) => {
        if (!alive) return;
        setProjects(p);
        setProjectId((cur) => cur ?? p[0]?.id ?? null);
        setNames((m) => new Map([...m, ...p.map((x) => [x.lead_detail.id, x.lead_detail.email] as [number, string])]));
      })
      .catch(() => {
        if (!alive) return;
        setProjects([]);
        notify.error("Could not load projects.");
      });
    personnelApi
      .getAssignments({ active: true })
      .then((a) => alive && setNames((m) => new Map([...m, ...a.map((x) => [x.user_detail.id, x.user_detail.email] as [number, string])])))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (projectId === null) return;
    monitoringApi
      .getProjectStatus(projectId)
      .then((s) => alive && setStatus(s))
      .catch(() => alive && notify.error("Could not load the monitoring status."));
    outputsApi
      .getExpectedVsActual(projectId)
      .then((e) => alive && setEva(e))
      .catch(() => alive && setEva(null));
    monitoringApi
      .getEvaluations({ project: projectId })
      .then((e) => alive && setEvals(e))
      .catch(() => alive && setEvals([]));
    return () => {
      alive = false;
    };
  }, [projectId, reloadKey]);

  const nameOf = (id: number | null) => (id === null ? "—" : id === user?.pk ? user.email : names.get(id) ?? `User #${id}`);
  const project = projects?.find((p) => p.id === projectId) ?? null;
  const indicators = useMemo(() => (status && status.project === projectId ? buildIndicators(status, eva) : []), [status, eva, projectId]);
  const loaded = !!status && status.project === projectId;
  const count = (s: IndicatorStatus) => indicators.filter((i) => i.status === s).length;
  const measured = indicators.filter((i) => i.status !== "not_started");
  const overallPct = measured.length ? Math.round(((count("achieved") + count("on_track") * 0.7) / measured.length) * 100) : 0;
  const shown = indicators.filter((i) => typeFilter === "all" || i.type === typeFilter);
  const changed = () => setReloadKey((k) => k + 1);

  const kpi = (label: string, val: number | string, color: string) => (
    <div key={label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="text-3xl font-black mt-1" style={{ color }}>{loaded ? val : "—"}</p>
    </div>
  );

  if (projects === null) return <SkeletonRows />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className={`flex items-center gap-2 ${view === "rubric" ? "invisible" : ""}`}>
          <p className="text-xs font-bold" style={{ color: "#64748b" }}>Project:</p>
          <select
            value={projectId ?? ""}
            onChange={(e) => {
              setStatus(null);
              setEva(null);
              setProjectId(Number(e.target.value));
            }}
            disabled={projects.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none max-w-[420px]"
            style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#e2e8f0" }}>
          {(
            [
              ["board", "📊 Project M&E"],
              ["rubric", "⚖️ Evaluation Rubric"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className="px-4 py-2 rounded-lg text-xs font-bold transition-all" style={view === k ? { background: "white", color: "#0d2a5e", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: "#64748b" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {view === "rubric" ? (
        <RubricPanel canEvaluate={can(EVALUATE_ROLE_CODES)} />
      ) : !project ? (
        <NoActualData message="No projects yet" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpi("Total Indicators", indicators.length, "#0d2a5e")}
            {kpi("Achieved", count("achieved"), "#059669")}
            {kpi("On Track", count("on_track"), "#0891b2")}
            {kpi("At Risk", count("at_risk"), "#f59e0b")}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpi("Off Track", count("off_track"), "#ef4444")}
            {kpi("Not Yet Started", count("not_started"), "#94a3b8")}
            {kpi("Completed Evals", evals.filter((e) => e.outcome !== "pending").length, "#166534")}
            {kpi("Scheduled Evals", evals.filter((e) => e.outcome === "pending").length, "#0369a1")}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <div className="min-w-0">
                <p className="text-xs font-mono font-bold" style={{ color: "#94a3b8" }}>{project.project_code}</p>
                <p className="font-black text-sm leading-snug mt-0.5" style={{ color: "#0d2a5e" }}>{project.title}</p>
              </div>
              {loaded && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: ESCALATION_META[status!.escalation_status].bg, color: ESCALATION_META[status!.escalation_status].color }}>
                  {ESCALATION_META[status!.escalation_status].label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4" style={{ borderBottom: "1px solid #e2e8f0" }}>
              {(
                [
                  ["Achieved", count("achieved"), "#059669"],
                  ["On Track", count("on_track"), "#0891b2"],
                  ["At Risk", count("at_risk"), "#f59e0b"],
                  ["Off Track", count("off_track"), "#ef4444"],
                ] as const
              ).map(([l, v, c]) => (
                <div key={l} className="px-4 py-3 text-center">
                  <p className="text-xl font-black" style={{ color: c }}>{loaded ? v : "—"}</p>
                  <p className="text-xs font-semibold" style={{ color: c }}>{l}</p>
                </div>
              ))}
            </div>

            <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
              {(
                [
                  ["indicators", "Indicators"],
                  ["performance", "Performance Map"],
                  ["evaluations", "Evaluations"],
                  ["reports", "Progress Reports"],
                  ["extensions", "Extensions"],
                  ["renewal", "Renewal"],
                ] as [BoardTab, string][]
              ).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-4">
              {(tab === "indicators" || tab === "performance") && !loaded && <SkeletonRows />}

              {tab === "indicators" && loaded && (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap mb-3">
                    {(["all", "output", "outcome", "process"] as (IndicatorType | "all")[]).map((t) => (
                      <button key={t} onClick={() => setTypeFilter(t)} className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all" style={{ background: typeFilter === t ? "#0d2a5e" : "#f1f5f9", color: typeFilter === t ? "white" : "#64748b" }}>
                        {t === "all" ? "All Types" : IND_TYPE_META[t].icon + " " + IND_TYPE_META[t].label}
                      </button>
                    ))}
                  </div>
                  {shown.map((ind) => (
                    <div key={ind.key} className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <TypeChip t={ind.type} />
                            <IndicatorStatusBadge s={ind.status} />
                          </div>
                          <p className="text-xs font-bold leading-snug" style={{ color: "#0d2a5e" }}>{ind.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{ind.note}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xl font-black" style={{ color: "#0d2a5e" }}>{ind.value}</p>
                          <p className="text-xs" style={{ color: "#94a3b8" }}>target {ind.target}</p>
                        </div>
                      </div>
                      {ind.pct !== null && (
                        <div className="mt-2.5">
                          <ProgressBar pct={ind.pct} status={ind.status} />
                          <div className="flex justify-end mt-1">
                            <span className="text-xs font-bold" style={{ color: "#0d2a5e" }}>{Math.round(ind.pct)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === "performance" && loaded && (
                <div className="space-y-4">
                  <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #0d2a5e, #1a3f7a)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(168,196,232,0.5)" }}>Overall Performance Score</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-5xl font-black text-white">{overallPct}%</p>
                        <p className="text-xs mt-1" style={{ color: "rgba(168,196,232,0.5)" }}>
                          {count("achieved") + count("on_track")} of {measured.length} measured indicators achieved or on track
                        </p>
                      </div>
                      <div className="flex-1">
                        <div className="w-full rounded-full overflow-hidden" style={{ height: "10px", background: "rgba(255,255,255,0.1)" }}>
                          <div className="h-full rounded-full" style={{ width: `${overallPct}%`, background: overallPct >= 80 ? "#4ade80" : overallPct >= 60 ? "#fbbf24" : "#f87171" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid #e2e8f0" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Indicator", "Type", "Target", "Actual", "Progress", "Status"].map((h, idx) => (
                            <th key={h} className={`px-3 py-3 font-bold ${idx === 0 ? "text-left px-4" : idx < 4 ? "text-right" : "text-center"}`} style={{ color: "#64748b" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {indicators.map((ind) => (
                          <tr key={ind.key} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                            <td className="px-4 py-3 font-semibold" style={{ color: "#0d2a5e", maxWidth: "260px" }}>
                              <p className="truncate">{ind.name}</p>
                              <p className="text-xs font-normal truncate mt-0.5" style={{ color: "#94a3b8" }}>{ind.note}</p>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="inline-block text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: IND_TYPE_META[ind.type].bg, color: IND_TYPE_META[ind.type].color }}>{IND_TYPE_META[ind.type].icon}</span>
                            </td>
                            <td className="px-3 py-3 text-right font-bold" style={{ color: "#0d2a5e" }}>{ind.target}</td>
                            <td className="px-3 py-3 text-right font-black" style={{ color: "#0891b2" }}>{ind.value}</td>
                            <td className="px-3 py-3 w-36">
                              {ind.pct !== null ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: "5px", background: "#f1f5f9" }}>
                                    <div className="h-full rounded-full" style={{ width: `${ind.pct}%`, background: IND_STATUS_META[ind.status].dot }} />
                                  </div>
                                  <span className="text-xs font-mono" style={{ color: "#64748b" }}>{Math.round(ind.pct)}%</span>
                                </div>
                              ) : (
                                <p className="text-center" style={{ color: "#cbd5e1" }}>—</p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center"><IndicatorStatusBadge s={ind.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === "evaluations" && <EvaluationsPanel project={project.id} canEvaluate={can(EVALUATE_ROLE_CODES)} reloadKey={reloadKey} onChanged={changed} />}
              {tab === "reports" && <ProgressReportsPanel project={project.id} canReport={can(REPORT_ROLE_CODES)} canCertify={can(CERTIFY_ROLE_CODES)} nameOf={nameOf} onChanged={changed} reloadKey={reloadKey} />}
              {tab === "extensions" && (
                <ExtensionsPanel project={project} canRequest={can(EXT_REQUEST_ROLE_CODES)} canEndorse={can(EXT_ENDORSE_ROLE_CODES)} canApprove={can(EXT_APPROVE_ROLE_CODES)} nameOf={nameOf} onChanged={changed} reloadKey={reloadKey} />
              )}
              {tab === "renewal" && <RenewalPanel project={project.id} canReport={can(REPORT_ROLE_CODES)} canDecide={can(RENEWAL_DECIDE_ROLE_CODES)} onChanged={changed} reloadKey={reloadKey} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Monitoring & Evaluation">
        <MonitoringContent />
      </AppShell>
    </ProtectedRoute>
  );
}
