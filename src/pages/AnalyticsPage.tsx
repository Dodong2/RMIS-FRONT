import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../lib/dashboardApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import type {
  AnalyticsScope,
  ComplianceDashboard,
  ForecastingDashboard,
  OutputDashboard,
  PerformanceDashboard,
  PortfolioCollege,
  PortfolioDashboard,
  ProjectDashboard,
} from "../types/dashboard";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { SkeletonRows } from "../components/common/proto";
import { BudgetTab } from "../components/analytics/BudgetTab";
import { DecisionTab } from "../components/analytics/DecisionTab";
import { ForecastTab } from "../components/analytics/ForecastTab";
import { OutputsTab } from "../components/analytics/OutputsTab";
import { OverviewTab } from "../components/analytics/OverviewTab";
import { ProjectsTab } from "../components/analytics/ProjectsTab";
import { PortfolioTab } from "../components/analytics/PortfolioTab";

const PROJECT_STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#059669" },
  completed: { label: "Completed", color: "#0d2a5e" },
  archived: { label: "Archived", color: "#94a3b8" },
};

const TABS = [
  ["overview", "Overview"],
  ["portfolio", "Portfolio"],
  ["projects", "Projects"],
  ["budget", "Budget"],
  ["outputs", "Outputs"],
  ["forecast", "Budget Forecast"],
  ["decision", "Decision Support"],
] as const;

type Tab = (typeof TABS)[number][0];


function AnalyticsContent() {
  const [tab, setTab] = useState<Tab>("overview");
  const [campus, setCampus] = useState("");
  const [collegeKey, setCollegeKey] = useState("");
  const [projects, setProjects] = useState<Project[] | null>(null);

  const [projectDash, setProjectDash] = useState<ProjectDashboard | null>(null);
  const [forecastDash, setForecastDash] = useState<ForecastingDashboard | null>(null);
  const [complianceDash, setComplianceDash] = useState<ComplianceDashboard | null>(null);
  const [outputDash, setOutputDash] = useState<OutputDashboard | null>(null);
  const [portfolioDash, setPortfolioDash] = useState<PortfolioDashboard | null>(null);
  const [performanceDash, setPerformanceDash] = useState<PerformanceDashboard | null>(null);
  const [portfolioCampuses, setPortfolioCampuses] = useState<string[]>([]);
  const [allColleges, setAllColleges] = useState<PortfolioCollege[]>([]);


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

  const campuses = useMemo(
    () => [...new Set([...(projects ?? []).map((p) => p.campus), ...portfolioCampuses].filter(Boolean))].sort(),
    [projects, portfolioCampuses],
  );
  const collegeOptions = allColleges.filter((c) => !campus || c.campus === campus);
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

      {tab === "outputs" && <OutputsTab data={performanceDash} outputDash={outputDash} />}
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
