import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../lib/dashboardApi";
import { financialApi } from "../lib/financialApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type {
  AppendixEEntry,
  AppendixFExport,
  AppendixGExport,
  BudgetDashboard,
  ComplianceDashboard,
  ForecastingDashboard,
  OutputDashboard,
  PlanningMetric,
  PlanningTarget,
  PlanningTargetComparison,
  ProjectDashboard,
  REIThrustAlignment,
} from "../types/dashboard";
import type { Disbursement } from "../types/financial";
import type { FundingType, Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Field, SkeletonRows, TableHead } from "../components/common/proto";
import { ChartCard, CountBars, DonutChart, EmptyChart, HBar, KpiBox, MiniBar, TrendBar } from "../components/analytics/ProtoCharts";

const MANAGE_TARGET_ROLE_CODES = ["system_admin", "riuh", "drd", "vprei"];

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const PROJECT_STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#059669" },
  completed: { label: "Completed", color: "#0d2a5e" },
  archived: { label: "Archived", color: "#94a3b8" },
};

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  journal_article: "Journal Article",
  book: "Book",
  book_chapter: "Book Chapter",
  conference_proceeding: "Conference Proceeding",
  instructional_material: "Instructional Material",
};

const IP_STATUS_LABELS: Record<string, string> = {
  disclosed: "Disclosed",
  filed: "Filed",
  registered: "Registered",
  adopted: "Adopted by Community",
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
  ["projects", "Projects"],
  ["budget", "Budget"],
  ["forecast", "Budget Forecast"],
  ["compliance", "Compliance"],
  ["outputs", "Outputs"],
  ["rei", "REI Thrust"],
  ["planning", "Planning Targets"],
  ["exports", "Data Exports"],
] as const;

type Tab = (typeof TABS)[number][0];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const humanize = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const peso = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
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
  const [fundingType, setFundingType] = useState("");
  const [projects, setProjects] = useState<Project[] | null>(null);

  const [projectDash, setProjectDash] = useState<ProjectDashboard | null>(null);
  const [budgetDash, setBudgetDash] = useState<BudgetDashboard | null>(null);
  const [forecastDash, setForecastDash] = useState<ForecastingDashboard | null>(null);
  const [complianceDash, setComplianceDash] = useState<ComplianceDashboard | null>(null);
  const [outputDash, setOutputDash] = useState<OutputDashboard | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[] | null>(null);
  const [reiDash, setReiDash] = useState<REIThrustAlignment | null>(null);

  const [outputYear, setOutputYear] = useState("");
  const [outputYearApplied, setOutputYearApplied] = useState("");
  const [trendYear, setTrendYear] = useState(new Date().getFullYear());

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
    dashboardApi.getComplianceDashboard().then((d) => alive && setComplianceDash(d)).catch(() => undefined);
    dashboardApi.getREIThrustAlignment().then((d) => alive && setReiDash(d)).catch(() => undefined);
    financialApi
      .getDisbursements()
      .then((d) => alive && setDisbursements(d))
      .catch(() => alive && setDisbursements([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const scope = { campus: campus || undefined, funding_type: fundingType || undefined };
    dashboardApi
      .getProjectDashboard(scope)
      .then((d) => alive && setProjectDash(d))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the projects dashboard.")));
    dashboardApi
      .getBudgetDashboard({ campus: scope.campus })
      .then((d) => alive && setBudgetDash(d))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the budget dashboard.")));
    dashboardApi
      .getForecastingDashboard(scope)
      .then((d) => alive && setForecastDash(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [campus, fundingType]);

  useEffect(() => {
    let alive = true;
    dashboardApi
      .getOutputDashboard({ year: outputYearApplied ? Number(outputYearApplied) : undefined })
      .then((d) => alive && setOutputDash(d))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load the outputs dashboard.")));
    return () => {
      alive = false;
    };
  }, [outputYearApplied]);

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

  const campuses = useMemo(() => [...new Set((projects ?? []).map((p) => p.campus).filter(Boolean))].sort(), [projects]);
  const scopedProjects = useMemo(
    () => (projects ?? []).filter((p) => (!campus || p.campus === campus) && (!fundingType || p.funding_type === fundingType)),
    [projects, campus, fundingType],
  );
  const monthly = useMemo(() => {
    const totals = Array(12).fill(0) as number[];
    (disbursements ?? []).forEach((d) => {
      const dt = new Date(d.disbursed_on + "T00:00:00");
      if (dt.getFullYear() === trendYear) totals[dt.getMonth()] += Number(d.amount);
    });
    return totals;
  }, [disbursements, trendYear]);
  const trendYears = useMemo(() => {
    const ys = new Set((disbursements ?? []).map((d) => Number(d.disbursed_on.slice(0, 4))));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [disbursements]);

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

  const statusSegments = Object.entries(projectDash?.by_status ?? {}).map(([k, v]) => ({ label: PROJECT_STATUS_META[k]?.label ?? humanize(k), value: v, color: PROJECT_STATUS_META[k]?.color ?? "#64748b" }));
  const pubTotal = Object.values(outputDash?.publications_by_type ?? {}).reduce((a, v) => a + v, 0);
  const ipTotal = Object.values(outputDash?.ip_records_by_status ?? {}).reduce((a, v) => a + v, 0);
  const outputsTotal = pubTotal + ipTotal + (outputDash?.creative_works_count ?? 0);
  const util = budgetDash?.utilization_pct ?? null;
  const sim = complianceDash?.similarity_checks;
  const trendTotal = monthly.reduce((a, v) => a + v, 0);
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

  const trendCard = (
    <ChartCard
      title={`Monthly Disbursement (${trendYear})`}
      aside={
        <select value={trendYear} onChange={(e) => setTrendYear(Number(e.target.value))} className="px-2 py-1 rounded-lg text-xs border outline-none" style={selSt}>
          {trendYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      }
    >
      {disbursements === null ? (
        <SkeletonRows />
      ) : trendTotal === 0 ? (
        <EmptyChart message={`No disbursement records found for ${trendYear}.`} />
      ) : (
        <>
          <TrendBar labels={MONTHS} values={monthly} color="#0891b2" format={peso} />
          <p className="text-xs mt-3" style={{ color: "#94a3b8" }}>
            Total {trendYear}: <span className="font-bold" style={{ color: "#0d2a5e" }}>{peso(trendTotal)}</span>
          </p>
        </>
      )}
    </ChartCard>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className={selCls} style={selSt}>
            <option value="">All Campuses</option>
            {campuses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={fundingType} onChange={(e) => setFundingType(e.target.value)} className={selCls} style={selSt}>
            <option value="">All Funding Types</option>
            {(Object.keys(FUNDING_LABELS) as FundingType[]).map((t) => (
              <option key={t} value={t}>{FUNDING_LABELS[t]}</option>
            ))}
          </select>
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
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiBox label="Total Projects" value={String(projectDash?.total_projects ?? "—")} sub="All lifecycle stages" color="#0d2a5e" />
            <KpiBox label="Approved Budget" value={budgetDash ? peso(budgetDash.total_approved) : "—"} sub={`${budgetDash?.project_count ?? 0} certified LIB(s)`} color="#0891b2" />
            <KpiBox label="Budget Utilization" value={util === null ? "—" : `${Math.round(util)}%`} sub={budgetDash ? `${peso(budgetDash.total_actual)} disbursed` : undefined} color="#d97706" />
            <KpiBox label="Research Outputs" value={outputDash ? String(outputsTotal) : "—"} sub={`${pubTotal} pubs · ${ipTotal} IP · ${outputDash?.creative_works_count ?? 0} creative`} color="#059669" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ChartCard title="Projects by Status">
              {projectDash && projectDash.total_projects > 0 ? <DonutChart segments={statusSegments} centerLabel="Projects" /> : <EmptyChart message="No projects match the current scope." />}
            </ChartCard>
            <ChartCard title="Projects by Funding Type">
              <CountBars data={projectDash?.by_funding_type ?? {}} labelFor={(k) => FUNDING_LABELS[k as FundingType] ?? humanize(k)} emptyMessage="No projects match the current scope." />
            </ChartCard>
            {trendCard}
            <ChartCard title="Projects by Campus">
              <CountBars data={projectDash?.by_campus ?? {}} labelFor={(k) => k || "Unspecified"} emptyMessage="No campus recorded yet." />
            </ChartCard>
            <ChartCard title="Research Output Summary">
              {outputDash && outputsTotal > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: "📄", label: "Publications", val: pubTotal, sub: `${outputDash.publications_by_type.journal_article ?? 0} journal articles`, color: "#0d2a5e" },
                    { icon: "🔏", label: "IP Records", val: ipTotal, sub: `${outputDash.ip_incentive_eligible_count} incentive-eligible`, color: "#6b21a8" },
                    { icon: "🎨", label: "Creative Works", val: outputDash.creative_works_count, sub: "Registered works", color: "#059669" },
                    { icon: "💰", label: "Est. Incentives", val: peso(outputDash.total_estimated_publication_incentive), sub: "Article V tables", color: "#f59e0b" },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl" style={{ background: "#f8fafc" }}>
                      <p className="text-lg">{s.icon}</p>
                      <p className="text-xl font-black" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-xs font-semibold" style={{ color: "#334155" }}>{s.label}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>{s.sub}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyChart message="No research outputs recorded yet." />
              )}
            </ChartCard>
            <ChartCard title="Compliance Snapshot">{complianceSnapshot ?? <SkeletonRows />}</ChartCard>
          </div>
        </>
      )}

      {tab === "projects" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiBox label="Total Projects" value={String(projectDash?.total_projects ?? "—")} color="#0d2a5e" />
            <KpiBox label="Active" value={String(projectDash?.by_status.active ?? 0)} color="#059669" />
            <KpiBox label="Completed" value={String(projectDash?.by_status.completed ?? 0)} color="#0891b2" />
            <KpiBox label="Archived" value={String(projectDash?.by_status.archived ?? 0)} color="#64748b" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="By Status">
              <CountBars data={projectDash?.by_status ?? {}} labelFor={(k) => PROJECT_STATUS_META[k]?.label ?? humanize(k)} emptyMessage="No projects match these filters." />
            </ChartCard>
            <ChartCard title="By Funding Type">
              <CountBars data={projectDash?.by_funding_type ?? {}} labelFor={(k) => FUNDING_LABELS[k as FundingType] ?? humanize(k)} emptyMessage="No projects match these filters." />
            </ChartCard>
            <ChartCard title="By Campus">
              <CountBars data={projectDash?.by_campus ?? {}} labelFor={(k) => k || "Unspecified"} emptyMessage="No campus recorded yet." />
            </ChartCard>
          </div>
          <ChartCard title="Project Register" aside={<span className="text-xs" style={{ color: "#94a3b8" }}>{scopedProjects.length} in scope</span>}>
            {scopedProjects.length === 0 ? (
              <EmptyChart message="No projects match these filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <TableHead cols={["Project Code", "Title", "Funding", "Campus", "REI Thrust", "Status", "Start", "Target End"]} />
                  <tbody>
                    {scopedProjects.map((p) => (
                      <tr key={p.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                        <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: "#0d2a5e" }}>{p.project_code}</td>
                        <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: "#334155" }}>{p.title}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{FUNDING_LABELS[p.funding_type] ?? p.funding_type}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{p.campus || "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{p.rei_thrust || "—"}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: "#f1f5f9", color: PROJECT_STATUS_META[p.status]?.color ?? "#64748b" }}>{PROJECT_STATUS_META[p.status]?.label ?? p.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "#94a3b8" }}>{p.start_date ?? "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "#94a3b8" }}>{p.target_end_date ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </>
      )}

      {tab === "budget" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiBox label="Total Approved" value={budgetDash ? peso(budgetDash.total_approved) : "—"} sub={`${budgetDash?.project_count ?? 0} projects with a certified LIB`} color="#0d2a5e" />
            <KpiBox label="Total Disbursed" value={budgetDash ? peso(budgetDash.total_actual) : "—"} sub={util === null ? "No certified budget yet" : `${util}% utilization`} color="#0891b2" />
            <KpiBox label="Remaining" value={budgetDash ? peso(budgetDash.total_approved - budgetDash.total_actual) : "—"} sub="Undisbursed" color="#059669" />
            <KpiBox label="Utilization" value={util === null ? "—" : `${util}%`} color={util !== null && util > 100 ? "#dc2626" : "#d97706"} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Institutional Utilization">
              {util === null ? (
                <EmptyChart message="No certified budget in this scope yet." />
              ) : (
                <div className="space-y-4">
                  <MiniBar label="Disbursed vs. approved" pct={Math.round(util)} color={util > 100 ? "#dc2626" : "#0891b2"} />
                  <HBar label="Approved" val={budgetDash!.total_approved} max={budgetDash!.total_approved} color="#0d2a5e" valLabel={peso(budgetDash!.total_approved)} />
                  <HBar label="Disbursed" val={budgetDash!.total_actual} max={budgetDash!.total_approved} color="#0891b2" valLabel={peso(budgetDash!.total_actual)} />
                  <p className="text-xs" style={{ color: "#94a3b8" }}>Campus filter applies; the budget dashboard has no funding-type filter.</p>
                </div>
              )}
            </ChartCard>
            {trendCard}
          </div>
        </>
      )}

      {tab === "forecast" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiBox label="Projects in Scope" value={String(forecastDash?.projects_in_scope ?? "—")} sub="Institutional + externally funded" color="#0d2a5e" />
            <KpiBox label="Forecasted" value={String(forecastDash?.projects_forecasted ?? "—")} sub="With a successful ARIMA run" color="#0891b2" />
            <KpiBox label="Overrun Risk" value={String(forecastDash?.overrun_risk_count ?? "—")} sub="Projected over approved" color="#dc2626" />
            <KpiBox label="Avg. MAPE" value={forecastDash?.accuracy.avg_mape != null ? `${forecastDash.accuracy.avg_mape.toFixed(1)}%` : "—"} sub="Backtest accuracy" color="#7c3aed" />
          </div>
          <ChartCard title="Project-Level Budget Forecast">
            {!forecastDash || forecastDash.projects.length === 0 ? (
              <EmptyChart message="No forecast runs yet. A project needs 6+ months of disbursements before ARIMA can fit." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <TableHead cols={["Project", "Approved", "Actual to Date", "Projected (Horizon)", "Risk", "MAE", "RMSE", "MAPE", "Run"]} />
                  <tbody>
                    {forecastDash.projects.map((r) => (
                      <tr key={r.run} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: "#0d2a5e" }}>{r.project_code}</td>
                        <td className="px-4 py-3 text-xs">{peso(r.approved_budget_total)}</td>
                        <td className="px-4 py-3 text-xs">{peso(r.actual_to_date)}</td>
                        <td className="px-4 py-3 text-xs">{r.projected_total_at_horizon === null ? "—" : peso(r.projected_total_at_horizon)}</td>
                        <td className="px-4 py-3 text-xs">
                          {r.is_overrun_risk === null ? (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full font-semibold" style={r.is_overrun_risk ? { background: "#fee2e2", color: "#dc2626" } : { background: "#d1fae5", color: "#059669" }}>
                              {r.is_overrun_risk ? "Overrun risk" : "Within budget"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">{r.mae?.toFixed(0) ?? "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono">{r.rmse?.toFixed(0) ?? "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono">{r.mape != null ? `${r.mape.toFixed(1)}%` : "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: "#94a3b8" }}>{r.run_at.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </>
      )}

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

      {tab === "outputs" && (
        <>
          <div className="flex items-center gap-2">
            <input type="number" value={outputYear} onChange={(e) => setOutputYear(e.target.value)} placeholder="All years" className="px-3 py-2 rounded-xl text-xs border outline-none w-32" style={selSt} />
            <button onClick={() => setOutputYearApplied(outputYear)} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
              Apply Year
            </button>
          </div>
          {!outputDash ? (
            <SkeletonRows />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiBox label="Total Outputs" value={String(outputsTotal)} sub="Publications + IP + creative works" color="#0d2a5e" />
                <KpiBox label="Publications" value={String(pubTotal)} color="#0891b2" />
                <KpiBox label="IP Incentive-Eligible" value={String(outputDash.ip_incentive_eligible_count)} sub={`of ${ipTotal} IP records`} color="#7c3aed" />
                <KpiBox label="Est. Publication Incentives" value={peso(outputDash.total_estimated_publication_incentive)} sub="Manual Article V tables" color="#059669" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Publications by Type">
                  <CountBars data={outputDash.publications_by_type} labelFor={(k) => PUBLICATION_TYPE_LABELS[k] ?? humanize(k)} emptyMessage="No publications recorded yet." />
                </ChartCard>
                <ChartCard title="IP Records by Status">
                  <CountBars data={outputDash.ip_records_by_status} labelFor={(k) => IP_STATUS_LABELS[k] ?? humanize(k)} emptyMessage="No IP records logged yet." />
                </ChartCard>
              </div>
            </>
          )}
        </>
      )}

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
