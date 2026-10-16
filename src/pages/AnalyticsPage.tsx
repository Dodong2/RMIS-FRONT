import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../lib/dashboardApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type {
  AnalyticsScope,
  AppendixEEntry,
  AppendixFExport,
  AppendixGExport,
  ComplianceDashboard,
  ForecastingDashboard,
  OutputDashboard,
  PlanningMetric,
  PlanningTarget,
  PlanningTargetComparison,
  PerformanceDashboard,
  PortfolioCollege,
  PortfolioDashboard,
  ProjectDashboard,
  REIThrustAlignment,
} from "../types/dashboard";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Field, SkeletonRows, TableHead } from "../components/common/proto";
import { BudgetTab } from "../components/analytics/BudgetTab";
import { DecisionTab } from "../components/analytics/DecisionTab";
import { ForecastTab } from "../components/analytics/ForecastTab";
import { OutputsTab } from "../components/analytics/OutputsTab";
import { OverviewTab } from "../components/analytics/OverviewTab";
import { ProjectsTab } from "../components/analytics/ProjectsTab";
import { PortfolioTab } from "../components/analytics/PortfolioTab";
import { ChartCard, CountBars, EmptyChart, HBar, KpiBox } from "../components/analytics/ProtoCharts";

const MANAGE_TARGET_ROLE_CODES = ["system_admin", "riuh", "drd", "vprei"];


const PROJECT_STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#059669" },
  completed: { label: "Completed", color: "#0d2a5e" },
  archived: { label: "Archived", color: "#94a3b8" },
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  conditional: "Conditionally Approved",
  revision_required: "Revision Required",
  rejected: "Rejected",
};

const COI_STATUS_LABELS: Record<string, string> = {
  disclosed: "Disclosed",
  under_review: "Under Review",
  resolved: "Resolved",
};

const MISCONDUCT_STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  under_investigation: "Under Investigation",
  upheld: "Upheld",
  dismissed: "Dismissed",
};

const PLANNING_METRIC_LABELS: Record<PlanningMetric, string> = {
  completed_projects: "Completed Projects",
  publications: "Publications",
  ip_disclosures: "IP Disclosures",
  budget_utilization_pct: "Budget Utilization %",
};

const TABS = [
  ["overview", "Overview"],
  ["portfolio", "Portfolio"],
  ["projects", "Projects"],
  ["budget", "Budget"],
  ["outputs", "Outputs"],
  ["forecast", "Budget Forecast"],
  ["decision", "Decision Support"],
  ["compliance", "Compliance"],
  ["rei", "REI Thrust"],
  ["planning", "Planning Targets"],
  ["exports", "Data Exports"],
] as const;

type Tab = (typeof TABS)[number][0];

const humanize = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const selCls = "px-3 py-2 rounded-xl text-xs font-semibold border outline-none";
const selSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

function pctStatus(pct: number | null) {
  if (pct === null) return { color: "#94a3b8", label: "No data" };
  if (pct >= 100) return { color: "#059669", label: "Met" };
  if (pct >= 50) return { color: "#f59e0b", label: "In progress" };
  return { color: "#dc2626", label: "Behind" };
}

function AnalyticsContent() {
  const { user } = useAuth();
  const canManageTargets = MANAGE_TARGET_ROLE_CODES.includes(user?.role?.code ?? "");

  const [tab, setTab] = useState<Tab>("overview");
  const [campus, setCampus] = useState("");
  const [collegeKey, setCollegeKey] = useState("");
  const [projects, setProjects] = useState<Project[] | null>(null);

  const [projectDash, setProjectDash] = useState<ProjectDashboard | null>(null);
  const [forecastDash, setForecastDash] = useState<ForecastingDashboard | null>(null);
  const [complianceDash, setComplianceDash] = useState<ComplianceDashboard | null>(null);
  const [outputDash, setOutputDash] = useState<OutputDashboard | null>(null);
  const [reiDash, setReiDash] = useState<REIThrustAlignment | null>(null);
  const [portfolioDash, setPortfolioDash] = useState<PortfolioDashboard | null>(null);
  const [performanceDash, setPerformanceDash] = useState<PerformanceDashboard | null>(null);
  const [portfolioCampuses, setPortfolioCampuses] = useState<string[]>([]);
  const [allColleges, setAllColleges] = useState<PortfolioCollege[]>([]);


  const [planningTargets, setPlanningTargets] = useState<PlanningTarget[] | null>(null);
  const [planningComparison, setPlanningComparison] = useState<PlanningTargetComparison[]>([]);
  const [planningYear, setPlanningYear] = useState("");
  const [planningKey, setPlanningKey] = useState(0);
  const emptyTargetForm = { metric: "", campus: "", target_year: String(new Date().getFullYear()), target_value: "" };
  const [targetForm, setTargetForm] = useState(emptyTargetForm);
  const [attemptedTarget, setAttemptedTarget] = useState(false);
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  const [exportProject, setExportProject] = useState<number | null>(null);
  const [appendixE, setAppendixE] = useState<AppendixEEntry[] | null>(null);
  const [appendixF, setAppendixF] = useState<AppendixFExport | null>(null);
  const [gCampus, setGCampus] = useState("");
  const [gYear, setGYear] = useState("");
  const [gParams, setGParams] = useState<{ campus?: string; year?: number }>({});
  const [appendixG, setAppendixG] = useState<AppendixGExport | null>(null);

  const selectedCollege = allColleges.find((c) => collegeKey === `${c.campus}|${c.college}`);
  const scope = useMemo<AnalyticsScope>(
    () => ({ campus: campus || selectedCollege?.campus || undefined, college: selectedCollege?.college }),
    [campus, selectedCollege],
  );

  useEffect(() => {
    let alive = true;
    researchApi
      .getProjects()
      .then((p) => alive && setProjects(p))
      .catch(() => {
        if (!alive) return;
        setProjects([]);
        notify.error("Could not load projects.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    dashboardApi
      .getProjectDashboard(scope)
      .then((d) => alive && setProjectDash(d))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the projects dashboard.")));
    dashboardApi
      .getPortfolioDashboard(scope)
      .then((d) => {
        if (!alive) return;
        setPortfolioDash(d);
        if (!scope.campus && !scope.college) {
          setPortfolioCampuses(d.by_college.map((c) => c.campus).filter(Boolean));
          setAllColleges(d.by_college);
        }
      })
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the portfolio dashboard.")));
    dashboardApi
      .getForecastingDashboard(scope)
      .then((d) => alive && setForecastDash(d))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the forecasting dashboard.")));
    dashboardApi.getComplianceDashboard(scope).then((d) => alive && setComplianceDash(d)).catch(() => undefined);
    dashboardApi.getREIThrustAlignment(scope).then((d) => alive && setReiDash(d)).catch(() => undefined);
    dashboardApi
      .getPerformanceDashboard(scope)
      .then((d) => alive && setPerformanceDash(d))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load project performance.")));
    return () => {
      alive = false;
    };
  }, [scope]);

  useEffect(() => {
    let alive = true;
    dashboardApi
      .getOutputDashboard(scope)
      .then((d) => alive && setOutputDash(d))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the outputs dashboard.")));
    return () => {
      alive = false;
    };
  }, [scope]);

  useEffect(() => {
    let alive = true;
    Promise.all([dashboardApi.getPlanningTargets(), dashboardApi.getPlanningTargetComparison({ year: planningYear ? Number(planningYear) : undefined })])
      .then(([t, c]) => {
        if (!alive) return;
        setPlanningTargets(t);
        setPlanningComparison(c);
      })
      .catch((err) => {
        if (!alive) return;
        setPlanningTargets([]);
        notify.error(errorMessage(err, "Could not load planning targets."));
      });
    return () => {
      alive = false;
    };
  }, [planningKey, planningYear]);

  useEffect(() => {
    if (exportProject === null) return;
    let alive = true;
    Promise.all([dashboardApi.getAppendixE(exportProject), dashboardApi.getAppendixF(exportProject)])
      .then(([e, f]) => {
        if (!alive) return;
        setAppendixE(e);
        setAppendixF(f);
      })
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the export data.")));
    return () => {
      alive = false;
    };
  }, [exportProject]);

  useEffect(() => {
    let alive = true;
    dashboardApi
      .getAppendixG(gParams)
      .then((g) => alive && setAppendixG(g))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the accomplishment report summary.")));
    return () => {
      alive = false;
    };
  }, [gParams]);

  const campuses = useMemo(
    () => [...new Set([...(projects ?? []).map((p) => p.campus), ...portfolioCampuses].filter(Boolean))].sort(),
    [projects, portfolioCampuses],
  );
  const collegeOptions = allColleges.filter((c) => !campus || c.campus === campus);
  const handleAddTarget = async () => {
    setAttemptedTarget(true);
    if (!targetForm.metric || !targetForm.target_year || !targetForm.target_value) {
      notify.error("Metric, target year, and target value are required.");
      return;
    }
    setIsSavingTarget(true);
    try {
      await dashboardApi.createPlanningTarget({
        metric: targetForm.metric as PlanningMetric,
        campus: targetForm.campus,
        target_year: Number(targetForm.target_year),
        target_value: targetForm.target_value,
      });
      setAttemptedTarget(false);
      notify.success("Planning target set.");
      setTargetForm(emptyTargetForm);
      setPlanningKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not set this planning target."));
    } finally {
      setIsSavingTarget(false);
    }
  };

  if (projects === null) return <SkeletonRows />;

  // Every known status shows (0 included); anything else is counted under Unclassified so slices always sum to the scoped total.
  const byStatus = projectDash?.by_status ?? {};
  const unclassified = Object.entries(byStatus).reduce((a, [k, v]) => (k in PROJECT_STATUS_META ? a : a + v), 0);
  const statusSegments = [
    ...Object.entries(PROJECT_STATUS_META).map(([k, m]) => ({ label: m.label, value: byStatus[k] ?? 0, color: m.color })),
    ...(unclassified ? [{ label: "Unclassified", value: unclassified, color: "#f59e0b" }] : []),
  ];
  const sim = complianceDash?.similarity_checks;
  const count = (obj: Record<string, number> | undefined) => Object.values(obj ?? {}).reduce((a, v) => a + v, 0);

  const complianceSnapshot = complianceDash && (
    <div className="grid grid-cols-2 gap-3">
      {[
        { icon: "🔍", label: "Similarity checks", val: sim?.total ?? 0, sub: `${sim?.within_threshold ?? 0} within · ${sim?.over_threshold ?? 0} over threshold`, color: "#0891b2" },
        { icon: "🤖", label: "AI declarations", val: complianceDash.ai_use_declarations, sub: "Self-declared AI use", color: "#7c3aed" },
        { icon: "📑", label: "Review references", val: count(complianceDash.ethics_reviews_by_status), sub: "TRC / integrity / external", color: "#0d2a5e" },
        { icon: "⚖️", label: "COI / Misconduct", val: count(complianceDash.coi_disclosures_by_status) + count(complianceDash.misconduct_cases_by_status), sub: `${count(complianceDash.coi_disclosures_by_status)} COI · ${count(complianceDash.misconduct_cases_by_status)} cases`, color: "#dc2626" },
      ].map((s) => (
        <div key={s.label} className="p-3 rounded-xl" style={{ background: "#f8fafc" }}>
          <p className="text-lg">{s.icon}</p>
          <p className="text-2xl font-black" style={{ color: s.color }}>{s.val}</p>
          <p className="text-xs font-semibold" style={{ color: "#334155" }}>{s.label}</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor="analytics-campus-filter" className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wide" style={{ color: "#64748b" }}>
            Campus
            <select
              id="analytics-campus-filter"
              value={campus}
              onChange={(e) => {
                setCampus(e.target.value);
                setCollegeKey("");
              }}
              className="min-w-44 rounded-xl border px-3 py-2 text-xs font-semibold normal-case tracking-normal outline-none"
              style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
            >
              <option value="">All Campuses</option>
              {campuses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label htmlFor="analytics-college-filter" className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wide" style={{ color: "#64748b" }}>
            College
            <select
              id="analytics-college-filter"
              value={collegeKey}
              onChange={(e) => setCollegeKey(e.target.value)}
              className="min-w-52 rounded-xl border px-3 py-2 text-xs font-semibold normal-case tracking-normal outline-none"
              style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
            >
              <option value="">All Colleges</option>
              {collegeOptions.map((c) => (
                <option key={`${c.campus}|${c.college}`} value={`${c.campus}|${c.college}`}>
                  {c.code} — {c.title}
                  {!campus && c.campus ? ` (${c.campus})` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setCampus("");
              setCollegeKey("");
            }}
            disabled={!campus && !collegeKey}
            className="rounded-xl border px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "#cbd5e1", background: "white" }}
          >
            Reset
          </button>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border p-1" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{ background: tab === k ? "#0d2a5e" : "transparent", color: tab === k ? "white" : "#64748b" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <OverviewTab data={performanceDash} statusSegments={statusSegments} outputDash={outputDash} complianceSnapshot={complianceSnapshot} />
      )}

      {tab === "portfolio" && <PortfolioTab data={portfolioDash} />}

      {tab === "projects" && <ProjectsTab data={performanceDash} />}

      {tab === "budget" && <BudgetTab data={performanceDash} />}

      {tab === "forecast" && <ForecastTab data={performanceDash} forecast={forecastDash} />}

      {tab === "decision" && <DecisionTab data={performanceDash} />}

      {tab === "compliance" &&
        (!complianceDash ? (
          <SkeletonRows />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiBox label="AI Use Declarations" value={String(complianceDash.ai_use_declarations)} color="#7c3aed" />
              <KpiBox label="Similarity Checks" value={String(sim?.total ?? 0)} sub={`${sim?.within_threshold ?? 0} within threshold`} color="#0891b2" />
              <KpiBox label="Over Threshold" value={String(sim?.over_threshold ?? 0)} sub="Similarity above the limit" color="#dc2626" />
              <KpiBox label="Misconduct Cases" value={String(count(complianceDash.misconduct_cases_by_status))} color="#0d2a5e" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Review References by Status">
                <CountBars data={complianceDash.ethics_reviews_by_status} labelFor={(k) => REVIEW_STATUS_LABELS[k] ?? humanize(k)} emptyMessage="No review references recorded yet." />
              </ChartCard>
              <ChartCard title="COI Disclosures by Status">
                <CountBars data={complianceDash.coi_disclosures_by_status} labelFor={(k) => COI_STATUS_LABELS[k] ?? humanize(k)} emptyMessage="No COI disclosures recorded yet." />
              </ChartCard>
              <ChartCard title="Misconduct Cases by Status">
                <CountBars data={complianceDash.misconduct_cases_by_status} labelFor={(k) => MISCONDUCT_STATUS_LABELS[k] ?? humanize(k)} emptyMessage="No misconduct cases recorded." />
              </ChartCard>
            </div>
          </>
        ))}

      {tab === "outputs" && <OutputsTab data={performanceDash} outputDash={outputDash} />}

      {tab === "rei" &&
        (!reiDash ? (
          <SkeletonRows />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiBox label="REI Thrusts Covered" value={String(Object.keys(reiDash.by_thrust).length)} color="#0d2a5e" />
              <KpiBox label="Aligned Projects" value={String(count(reiDash.by_thrust))} color="#059669" />
              <KpiBox label="No REI Thrust Recorded" value={String(reiDash.unaligned_count)} sub="Needs alignment" color="#dc2626" />
            </div>
            <ChartCard title="Projects by REI Thrust">
              <CountBars data={reiDash.by_thrust} labelFor={(k) => k} emptyMessage="No REI thrust recorded on any project yet." />
            </ChartCard>
          </>
        ))}

      {tab === "planning" && (
        <>
          {canManageTargets && (
            <ChartCard title="Set a Planning Target">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Metric" required>
                  <select value={targetForm.metric} onChange={(e) => setTargetForm((f) => ({ ...f, metric: e.target.value }))} className={INPUT_CLS} style={invalidStyle(attemptedTarget && !targetForm.metric)}>
                    <option value="">Select metric</option>
                    {(Object.keys(PLANNING_METRIC_LABELS) as PlanningMetric[]).map((m) => (
                      <option key={m} value={m}>{PLANNING_METRIC_LABELS[m]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Campus">
                  <select value={targetForm.campus} onChange={(e) => setTargetForm((f) => ({ ...f, campus: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE}>
                    <option value="">Institution-wide</option>
                    {campuses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Target Year" required>
                  <input type="number" value={targetForm.target_year} onChange={(e) => setTargetForm((f) => ({ ...f, target_year: e.target.value }))} className={INPUT_CLS} style={invalidStyle(attemptedTarget && !targetForm.target_year)} />
                </Field>
                <Field label="Target Value" required>
                  <input type="number" min="0" step="0.01" value={targetForm.target_value} onChange={(e) => setTargetForm((f) => ({ ...f, target_value: e.target.value }))} className={INPUT_CLS} style={invalidStyle(attemptedTarget && !targetForm.target_value)} />
                </Field>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={handleAddTarget} disabled={isSavingTarget} className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50" style={{ background: "#0d2a5e" }}>
                  {isSavingTarget ? "Saving…" : "Set Target"}
                </button>
              </div>
            </ChartCard>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Actual vs. Target"
              aside={<input type="number" value={planningYear} onChange={(e) => setPlanningYear(e.target.value)} placeholder="All years" className="px-2 py-1 rounded-lg text-xs border outline-none w-24" style={selSt} />}
            >
              {planningComparison.length === 0 ? (
                <EmptyChart message="No planning targets for this year." />
              ) : (
                <div className="space-y-1">
                  {planningComparison.map((r) => {
                    const st = pctStatus(r.pct_of_target);
                    return (
                      <HBar
                        key={r.id}
                        label={`${PLANNING_METRIC_LABELS[r.metric]}${r.campus ? ` · ${r.campus}` : ""} (${r.target_year})`}
                        val={r.pct_of_target ?? 0}
                        max={100}
                        color={st.color}
                        valLabel={`${r.pct_of_target ?? 0}% · ${r.actual_value ?? "—"} / ${r.target_value} · ${st.label}`}
                      />
                    );
                  })}
                </div>
              )}
            </ChartCard>
            <ChartCard title="All Planning Targets">
              {planningTargets === null ? (
                <SkeletonRows />
              ) : planningTargets.length === 0 ? (
                <EmptyChart message="No planning targets set yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <TableHead cols={["Metric", "Campus", "Year", "Target"]} />
                    <tbody>
                      {planningTargets.map((t) => (
                        <tr key={t.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#0d2a5e" }}>{PLANNING_METRIC_LABELS[t.metric]}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{t.campus || "Institution-wide"}</td>
                          <td className="px-4 py-3 text-xs">{t.target_year}</td>
                          <td className="px-4 py-3 text-xs font-mono">{t.target_value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}

      {tab === "exports" && (
        <>
          <ChartCard title="Appendix G — R&D Accomplishment Report">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select value={gCampus} onChange={(e) => setGCampus(e.target.value)} className={selCls} style={selSt}>
                <option value="">Institution-wide</option>
                {campuses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input type="number" value={gYear} onChange={(e) => setGYear(e.target.value)} placeholder="All years" className="px-3 py-2 rounded-xl text-xs border outline-none w-28" style={selSt} />
              <button onClick={() => setGParams({ campus: gCampus || undefined, year: gYear ? Number(gYear) : undefined })} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
                Apply
              </button>
              <p className="text-xs" style={{ color: "#94a3b8" }}>Download the file from Reports &amp; Data Export.</p>
            </div>
            {!appendixG ? (
              <SkeletonRows />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ["Completed Projects", appendixG.completed_projects, "#0d2a5e"],
                  ["Publications", appendixG.publications, "#0891b2"],
                  ["IP Records", appendixG.ip_records, "#7c3aed"],
                  ["Creative Works", appendixG.creative_works, "#059669"],
                  ["Monthly Reports", appendixG.monthly_reports_submitted, "#f59e0b"],
                ].map(([l, v, c]) => (
                  <div key={l as string} className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
                    <p className="text-2xl font-black" style={{ color: c as string }}>{v}</p>
                    <p className="text-xs font-semibold" style={{ color: "#64748b" }}>{l}</p>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
          <ChartCard
            title="Appendix E / F — Per-Project Reports"
            aside={
              <select
                value={exportProject ?? ""}
                onChange={(e) => {
                  setAppendixE(null);
                  setAppendixF(null);
                  setExportProject(e.target.value ? Number(e.target.value) : null);
                }}
                className={selCls + " max-w-[420px]"}
                style={selSt}
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
                ))}
              </select>
            }
          >
            {exportProject === null ? (
              <EmptyChart message="Select a project to view its midterm and terminal report data." />
            ) : appendixE === null ? (
              <SkeletonRows />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Appendix E — Midterm Progress Reports</p>
                  {appendixE.length === 0 ? (
                    <EmptyChart message="No midterm reports submitted for this project." />
                  ) : (
                    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
                      <table className="w-full text-sm">
                        <TableHead cols={["Year", "Narrative", "Expenditure Summary", "Submitted"]} />
                        <tbody>
                          {appendixE.map((r) => (
                            <tr key={r.project_year} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                              <td className="px-4 py-3 text-xs font-bold">Y{r.project_year}</td>
                              <td className="px-4 py-3 text-xs max-w-sm truncate">{r.narrative || "—"}</td>
                              <td className="px-4 py-3 text-xs max-w-sm truncate">{r.expenditure_summary || "—"}</td>
                              <td className="px-4 py-3 text-xs font-mono">{r.submitted_at.slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Appendix F — Terminal Report</p>
                  {!appendixF ? (
                    <EmptyChart message="No terminal report submitted for this project." />
                  ) : (
                    <div className="rounded-xl p-4 space-y-2" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <p className="text-sm" style={{ color: "#334155" }}>{appendixF.narrative || "—"}</p>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "#94a3b8" }}>
                        <span>Submitted {appendixF.submitted_at.slice(0, 10)}</span>
                        <span className="px-2 py-0.5 rounded-full font-semibold" style={appendixF.is_certified ? { background: "#d1fae5", color: "#059669" } : { background: "#fef3c7", color: "#d97706" }}>
                          {appendixF.is_certified ? "Certified" : "Awaiting certification"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Analytics">
        <AnalyticsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
