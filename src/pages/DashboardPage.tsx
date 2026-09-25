import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { NoActualData } from "../components/common/NoActualData";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/authApi";
import { budgetApi } from "../lib/budgetApi";
import { dashboardApi } from "../lib/dashboardApi";
import { monitoringApi } from "../lib/monitoringApi";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { riskApi } from "../lib/riskApi";
import { visibleSections } from "../lib/nav";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE } from "../lib/projectStatus";
import { resolveTier, roleLabel, roleScopeLine, type RoleTier } from "../lib/roles";
import type {
  BudgetDashboard,
  ComplianceDashboard,
  ForecastingDashboard,
  FundingAllocationDashboard,
  OutputDashboard,
  ProjectDashboard,
  TaskDashboardRow,
} from "../types/dashboard";
import type { LineItemBudget } from "../types/budget";
import type { ProjectMonitoringStatus } from "../types/monitoring";
import type { WorkloadRow } from "../types/personnel";
import type { Project, RecordStatus } from "../types/research";
import type { RiskDashboard, RiskLevel } from "../types/risk";

type DomainTab = "projects" | "budget" | "compliance" | "outputs" | "me" | "risk" | "personnel";

const TASK_ASSIGNER_CODES = [
  "system_admin",
  "crc_chair",
  "drd",
  "riuh",
  "program_leader",
  "project_leader",
  "study_leader",
];

const WIDE_TIERS: RoleTier[] = ["system_admin", "institution_oversight"];

const FUNDING_TYPE_LABELS: Record<string, string> = {
  institutional: "Institutional",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally Funded",
};

const ESCALATION_LABELS: Record<string, string> = {
  unknown: "No reports yet",
  on_track: "On Track",
  notify_dean_riuh: "Notify Dean/RIUH",
  terminate_recommended: "Termination Recommended",
};

const RISK_SEV_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "#7f1d1d", bg: "#fee2e2" },
  high: { label: "High", color: "#991b1b", bg: "#fee2e2" },
  medium: { label: "Medium", color: "#92400e", bg: "#fef3c7" },
  low: { label: "Low", color: "#166534", bg: "#d1fae5" },
};

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);

const millions = (n: number) => (n >= 1e6 ? `₱${(n / 1e6).toFixed(1)}M` : `₱${Math.round(n / 1e3)}K`);

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

const humanize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const svgPath = (d: string, size = 18) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
    <path d={d} />
  </svg>
);

interface DashData {
  projectDash?: ProjectDashboard | null;
  budgetDash?: BudgetDashboard | null;
  complianceDash?: ComplianceDashboard | null;
  outputDash?: OutputDashboard | null;
  riskDash?: RiskDashboard | null;
  forecastDash?: ForecastingDashboard | null;
  fundingDash?: FundingAllocationDashboard | null;
  taskDash?: TaskDashboardRow[] | null;
  projects?: Project[] | null;
  budgets?: LineItemBudget[] | null;
  workload?: WorkloadRow[] | null;
}

function settle<T>(p: Promise<T>): Promise<T | null> {
  return p.catch(() => null);
}

function MiniBar({ pct, color = "#0891b2" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "#f1f5f9" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function StatusDot({ status }: { status: RecordStatus }) {
  const c = PROJECT_STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

function KpiTile({ label, value, sub, color, bg, icon }: { label: string; value: string; sub?: string; color: string; bg: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>{label}</p>
          <p className="text-3xl font-black mt-1 font-mono" style={{ color }}>{value}</p>
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
      {sub && <p className="text-xs" style={{ color: "#94a3b8" }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, req, children, aside }: { title: string; req?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "#f1f5f9", background: "#f8fafc" }}>
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{title}</p>
          {req && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>{req}</span>
          )}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function CountTile({ label, value, color, bg }: { label: string; value: number | string; color: string; bg: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: bg }}>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs font-bold" style={{ color }}>{label}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
      ))}
    </div>
  );
}

function DomainSummary({ data }: { data: DashData }) {
  const { projectDash, budgetDash, complianceDash, outputDash, riskDash } = data;
  const hasProjects = !!projectDash && projectDash.total_projects > 0;
  const hasBudget = !!budgetDash && budgetDash.project_count > 0;
  const util = budgetDash?.utilization_pct ?? null;
  const sim = complianceDash?.similarity_checks;
  const outputs = outputDash
    ? sum(outputDash.publications_by_type) + sum(outputDash.ip_records_by_status) + outputDash.creative_works_count
    : 0;
  const riskTotal = riskDash?.total_projects ?? 0;
  const onTrack = riskDash
    ? riskTotal - riskDash.flagged_projects.filter((p) => p.flags.non_submission_warning.flagged).length
    : 0;
  const highRisks = riskDash ? riskDash.by_risk_level.high + riskDash.by_risk_level.critical : 0;
  const openRisks = highRisks > 0 ? highRisks : riskDash?.by_risk_level.medium ?? 0;

  const tiles = [
    { label: "Projects", val: hasProjects ? String(projectDash!.total_projects) : "—", color: "#0d2a5e" },
    { label: "Budget", val: hasBudget ? millions(budgetDash!.total_approved) : "—", color: "#0891b2" },
    {
      label: "Utilization",
      val: util !== null ? `${Math.round(util)}%` : "—",
      color: util !== null && util >= 70 ? "#059669" : "#f59e0b",
    },
    { label: "Compliance", val: sim && sim.total > 0 ? `${sim.within_threshold}/${sim.total}` : "—", color: "#7c3aed" },
    { label: "Outputs", val: outputs > 0 ? String(outputs) : "—", color: "#0d2a5e" },
    { label: "M&E", val: riskTotal > 0 ? `${onTrack}/${riskTotal}` : "—", color: "#166534" },
    { label: "Open Risks", val: riskTotal > 0 ? String(openRisks) : "—", color: highRisks > 0 ? "#dc2626" : "#f59e0b" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
      {tiles.map((d) => (
        <div key={d.label} className="rounded-xl p-3 text-center" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <p className="text-lg font-black" style={{ color: d.val === "—" ? "#cbd5e1" : d.color }}>{d.val}</p>
          <p className="text-xs font-bold mt-0.5" style={{ color: "#64748b" }}>{d.label}</p>
        </div>
      ))}
    </div>
  );
}

function ObjectiveDashboards({ data, canOpen }: { data: DashData; canOpen: (to: string) => boolean }) {
  const { complianceDash, taskDash, budgetDash, forecastDash, fundingDash } = data;
  const openTasks = taskDash?.reduce((s, r) => s + r.open, 0) ?? 0;
  const overdueTasks = taskDash?.reduce((s, r) => s + r.overdue, 0) ?? 0;
  const simTotal = complianceDash?.similarity_checks.total ?? 0;

  const cards: { code: string; title: string; to: string; empty: boolean; figures: [string, string][] }[] = [
    {
      code: "5a",
      title: "Compliance & Activity",
      to: "/compliance",
      empty: simTotal === 0 && (taskDash?.length ?? 0) === 0 && (complianceDash?.ai_use_declarations ?? 0) === 0,
      figures: [
        ["Similarity checks", String(simTotal)],
        ["Open tasks", String(openTasks)],
        ["Overdue tasks", String(overdueTasks)],
      ],
    },
    {
      code: "5b",
      title: "Budget Monitoring",
      to: "/budget",
      empty: !budgetDash || budgetDash.project_count === 0,
      figures: [
        ["Approved", budgetDash ? peso(budgetDash.total_approved) : "—"],
        ["Actual", budgetDash ? peso(budgetDash.total_actual) : "—"],
        ["Utilization", budgetDash?.utilization_pct != null ? `${Math.round(budgetDash.utilization_pct)}%` : "—"],
      ],
    },
    {
      code: "5c",
      title: "Forecasting Analytics",
      to: "/budget/forecast",
      empty: !forecastDash || forecastDash.projects_forecasted === 0,
      figures: [
        ["Forecasted", forecastDash ? `${forecastDash.projects_forecasted}/${forecastDash.projects_in_scope}` : "—"],
        ["Overrun risk", forecastDash ? String(forecastDash.overrun_risk_count) : "—"],
        ["Avg. MAPE", forecastDash?.accuracy.avg_mape != null ? `${forecastDash.accuracy.avg_mape.toFixed(1)}%` : "—"],
      ],
    },
    {
      code: "5d",
      title: "Funding Allocation Decision",
      to: "/decision-support",
      empty: !fundingDash || fundingDash.ranking.length === 0,
      figures: [
        ["Latest run", fundingDash ? fundingDash.label || `Run #${fundingDash.run}` : "—"],
        ["Ranked", fundingDash ? String(fundingDash.ranking.length) : "—"],
        ["To fund", fundingDash ? String(fundingDash.decision_summary.fund) : "—"],
      ],
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Objective Dashboards — 5a–5d</p>
      {cards.map((c) => {
        const body = (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black" style={{ color: "#0d2a5e" }}>{c.title}</p>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>{c.code}</span>
            </div>
            {c.empty ? (
              <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>No actual data</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {c.figures.map(([l, v]) => (
                  <div key={l} className="min-w-0">
                    <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{l}</p>
                    <p className="text-xs font-black font-mono truncate" style={{ color: "#0891b2" }}>{v}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        );
        return canOpen(c.to) ? (
          <Link
            key={c.code}
            to={c.to}
            className="block w-full text-left rounded-2xl p-4 transition-all hover:border-[#0891b2] hover:-translate-y-px"
            style={{ background: "white", border: "1px solid #e2e8f0" }}
          >
            {body}
          </Link>
        ) : (
          <div key={c.code} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function ProjectsPanel({ data }: { data: DashData }) {
  const { projectDash, projects } = data;
  if (projectDash === undefined || projects === undefined) return <Loading />;
  if (!projectDash || projectDash.total_projects === 0) return <NoActualData />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 mb-2">
        {(["active", "completed", "archived"] as const).map((s) => {
          const c = PROJECT_STATUS_STYLE[s];
          return <CountTile key={s} label={PROJECT_STATUS_LABELS[s]} value={projectDash.by_status[s] ?? 0} color={c.text} bg={c.bg} />;
        })}
      </div>
      {(projects ?? []).map((proj) => (
        <Link
          key={proj.id}
          to={`/projects/${proj.id}`}
          className="flex items-center gap-3 py-2.5 border-b hover:bg-slate-50"
          style={{ borderColor: "#f1f5f9" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-bold" style={{ color: "#0891b2" }}>{proj.project_code}</p>
            <p className="text-xs font-semibold truncate" style={{ color: "#0d2a5e" }}>{proj.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
              {FUNDING_TYPE_LABELS[proj.funding_type] ?? proj.funding_type}
              {proj.total_cost ? ` · ${peso(Number(proj.total_cost))}` : ""}
            </p>
          </div>
          <StatusDot status={proj.status} />
        </Link>
      ))}
    </div>
  );
}

function BudgetPanel({ data }: { data: DashData }) {
  const { budgetDash, budgets, projects } = data;
  if (budgetDash === undefined) return <Loading />;
  if (!budgetDash || budgetDash.project_count === 0) return <NoActualData hint="No certified budgets in scope yet." />;
  const balance = budgetDash.total_approved - budgetDash.total_actual;
  const util = Math.round(budgetDash.utilization_pct ?? 0);
  const projectCode = (id: number) => projects?.find((p) => p.id === id)?.project_code ?? `#${id}`;
  const current = (budgets ?? []).filter((b) => b.is_current);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #0d2a5e, #1a3f7a)" }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(168,196,232,0.5)" }}>Portfolio Budget</p>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["Total Approved", peso(budgetDash.total_approved), "white"],
              ["Actual", peso(budgetDash.total_actual), "#67e8f9"],
              ["Balance", peso(balance), "#4ade80"],
            ] as const
          ).map(([l, v, c]) => (
            <div key={l}>
              <p className="text-xs" style={{ color: "rgba(168,196,232,0.5)" }}>{l}</p>
              <p className="text-sm font-black mt-0.5" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="w-full rounded-full overflow-hidden" style={{ height: "8px", background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, util)}%`, background: util >= 80 ? "#4ade80" : "#67e8f9" }} />
          </div>
          <p className="text-xs mt-1 text-white font-bold">{util}% overall utilization</p>
        </div>
      </div>
      {current.length > 0 && (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Project", "LIB Version", "Status", "Total LIB"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.map((b) => (
                <tr key={b.id} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-3 py-2 font-mono font-bold" style={{ color: "#0891b2" }}>{projectCode(b.project)}</td>
                  <td className="px-3 py-2" style={{ color: "#334155" }}>v{b.version_number}</td>
                  <td className="px-3 py-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={
                        b.status === "certified"
                          ? { background: "#d1fae5", color: "#166534" }
                          : { background: "#fef3c7", color: "#92400e" }
                      }
                    >
                      {humanize(b.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#0d2a5e" }}>{peso(Number(b.total_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompliancePanel({ data }: { data: DashData }) {
  const { complianceDash } = data;
  if (complianceDash === undefined) return <Loading />;
  if (!complianceDash) return <NoActualData />;
  const sim = complianceDash.similarity_checks;
  const rows: [string, Record<string, number>][] = [
    ["Review status references", complianceDash.ethics_reviews_by_status],
    ["COI disclosures", complianceDash.coi_disclosures_by_status],
    ["Misconduct cases", complianceDash.misconduct_cases_by_status],
  ];
  const total =
    sim.total + complianceDash.ai_use_declarations + rows.reduce((s, [, r]) => s + sum(r), 0);
  if (total === 0) return <NoActualData />;
  const rate = sim.total > 0 ? Math.round((sim.within_threshold / sim.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <CountTile label="Within Threshold" value={sim.within_threshold} color="#059669" bg="#d1fae5" />
        <CountTile label="Over Threshold" value={sim.over_threshold} color="#dc2626" bg="#fee2e2" />
        <CountTile label="AI Declarations" value={complianceDash.ai_use_declarations} color="#7c3aed" bg="#f5f3ff" />
      </div>
      {sim.total > 0 && (
        <div className="flex items-center gap-3 mb-1">
          <p className="text-xs font-bold" style={{ color: "#64748b" }}>Similarity Compliance Rate</p>
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: "6px", background: "#f1f5f9" }}>
            <div className="h-full rounded-full" style={{ width: `${rate}%`, background: "#059669" }} />
          </div>
          <span className="text-xs font-black" style={{ color: "#059669" }}>{rate}%</span>
        </div>
      )}
      {rows.map(([label, byStatus]) => (
        <div key={label} className="py-2 border-b" style={{ borderColor: "#f1f5f9" }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "#0d2a5e" }}>{label}</p>
          {sum(byStatus) === 0 ? (
            <p className="text-xs" style={{ color: "#94a3b8" }}>No records</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(byStatus).map(([s, n]) => (
                <span key={s} className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f1f5f9", color: "#475569" }}>
                  {humanize(s)} · {n}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OutputsPanel({ data }: { data: DashData }) {
  const { outputDash } = data;
  if (outputDash === undefined) return <Loading />;
  if (!outputDash) return <NoActualData />;
  const pubs = sum(outputDash.publications_by_type);
  const ip = sum(outputDash.ip_records_by_status);
  if (pubs + ip + outputDash.creative_works_count === 0) return <NoActualData />;

  const tiles: [string, string | number, string, string][] = [
    ["Publications", pubs, "#0d2a5e", "#e0eaf7"],
    ["IP Records", ip, "#6b21a8", "#faf5ff"],
    ["Creative Works", outputDash.creative_works_count, "#0891b2", "#e0f2fe"],
    ["IP Incentive-Eligible", outputDash.ip_incentive_eligible_count, "#166534", "#d1fae5"],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([l, v, c, bg]) => (
          <div key={l} className="rounded-xl p-3" style={{ background: bg }}>
            <p className="text-xl font-black" style={{ color: c }}>{v}</p>
            <p className="text-xs font-bold" style={{ color: c }}>{l}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <p className="text-xs font-semibold" style={{ color: "#64748b" }}>Estimated publication incentive</p>
        <p className="text-sm font-black font-mono" style={{ color: "#059669" }}>{peso(outputDash.total_estimated_publication_incentive)}</p>
      </div>
      {[...Object.entries(outputDash.publications_by_type), ...Object.entries(outputDash.ip_records_by_status).map(([k, v]) => [`IP · ${k}`, v] as const)].map(
        ([k, v]) => (
          <div key={k} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "#f1f5f9" }}>
            <p className="flex-1 text-xs font-semibold truncate" style={{ color: "#0d2a5e" }}>{humanize(String(k))}</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>{v}</span>
          </div>
        ),
      )}
    </div>
  );
}

function MEPanel({ data }: { data: DashData }) {
  const { projects } = data;
  const [projectId, setProjectId] = useState<number | null>(null);
  const [status, setStatus] = useState<ProjectMonitoringStatus | null | undefined>(undefined);
  const selected = projectId ?? projects?.[0]?.id ?? null;

  useEffect(() => {
    if (selected === null) return;
    let active = true;
    monitoringApi
      .getProjectStatus(selected)
      .then((s) => active && setStatus(s))
      .catch(() => active && setStatus(null));
    return () => {
      active = false;
    };
  }, [selected]);

  if (projects === undefined) return <Loading />;
  if (!projects || projects.length === 0) return <NoActualData />;

  const ind = status?.indicators;
  const budgetPct = ind?.budget_utilization_pct ?? null;
  const delivPct = ind?.deliverables_pct ?? null;

  return (
    <div className="space-y-4">
      <select
        value={selected ?? ""}
        onChange={(e) => {
          setStatus(undefined);
          setProjectId(Number(e.target.value));
        }}
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
        style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.project_code} — {p.title}
          </option>
        ))}
      </select>
      {status === undefined ? (
        <Loading />
      ) : !status || !ind ? (
        <NoActualData />
      ) : (
        <>
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #0d2a5e, #1a3f7a)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(168,196,232,0.5)" }}>Renewal Readiness (70% / 70%)</p>
            {(
              [
                ["Budget utilization", budgetPct, ind.budget_utilization_meets_70],
                ["Deliverables", delivPct, ind.deliverables_meets_70],
              ] as const
            ).map(([l, v, ok]) => (
              <div key={l} className="flex items-center gap-3 mt-2">
                <p className="text-xs w-32 shrink-0" style={{ color: "rgba(168,196,232,0.7)" }}>{l}</p>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: "8px", background: "rgba(255,255,255,0.1)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, v ?? 0)}%`, background: ok ? "#4ade80" : "#fbbf24" }} />
                </div>
                <span className="text-xs font-bold text-white w-12 text-right">{v !== null ? `${Math.round(v)}%` : "—"}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <CountTile label={ESCALATION_LABELS[ind.monthly_report.status] ?? "Monthly Reports"} value={ind.monthly_report.months_since_last_report ?? "—"} color="#0891b2" bg="#e0f2fe" />
            <CountTile label="Midterm Years" value={ind.midterm_report_years.length} color="#0d2a5e" bg="#e0eaf7" />
            <CountTile label="Realignments (yr)" value={ind.realignments_this_year} color="#92400e" bg="#fef3c7" />
            <CountTile label="Delayed Procurement" value={ind.procurement_delayed} color="#dc2626" bg="#fee2e2" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Terminal report", ind.terminal_report_submitted ? "Submitted" : "Not yet"],
                ["Similarity over threshold", `${ind.similarity_checks.over_threshold}/${ind.similarity_checks.total}`],
                ["AI over 20%", `${ind.ai_declarations.over_threshold}/${ind.ai_declarations.total}`],
                ["Forecast overrun", ind.forecast_overrun_risk === null ? "No forecast" : ind.forecast_overrun_risk ? "At risk" : "Clear"],
              ] as const
            ).map(([l, v]) => (
              <div key={l} className="rounded-xl p-3 flex items-center justify-between" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <p className="text-xs font-semibold" style={{ color: "#64748b" }}>{l}</p>
                <p className="text-xs font-black" style={{ color: "#0d2a5e" }}>{v}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RiskPanel({ data }: { data: DashData }) {
  const { riskDash } = data;
  if (riskDash === undefined) return <Loading />;
  if (!riskDash || riskDash.total_projects === 0) return <NoActualData />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {(["critical", "high", "medium", "low"] as RiskLevel[]).map((s) => {
          const m = RISK_SEV_META[s];
          return <CountTile key={s} label={m.label} value={riskDash.by_risk_level[s] ?? 0} color={m.color} bg={m.bg} />;
        })}
      </div>
      {riskDash.flagged_projects.map((p) => {
        const m = RISK_SEV_META[p.risk_level];
        const flags = Object.entries(p.flags)
          .filter(([, f]) => f.flagged)
          .map(([k]) => humanize(k));
        return (
          <div key={p.project} className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-xs font-bold leading-snug" style={{ color: "#0d2a5e" }}>{p.recommended_action}</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: m.bg, color: m.color }}>
                {m.label} · {p.risk_score}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{flags.join(" · ")}</p>
            <p className="text-xs font-mono mt-1" style={{ color: "#94a3b8" }}>{p.project_code}</p>
          </div>
        );
      })}
      {riskDash.flagged_projects.length === 0 && (
        <div className="text-center py-6 rounded-xl" style={{ background: "#d1fae5" }}>
          <p className="text-sm font-bold" style={{ color: "#166534" }}>No open risks in scope</p>
        </div>
      )}
    </div>
  );
}

function PersonnelPanel({ data, canSeeWorkload }: { data: DashData; canSeeWorkload: boolean }) {
  const { taskDash, workload } = data;
  if (taskDash === undefined) return <Loading />;
  if (!taskDash || taskDash.length === 0) return <NoActualData hint="No tasks recorded yet." />;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#94a3b8" }}>Tasks per Project</p>
        {taskDash.map((r) => {
          const total = r.open + r.done;
          const pct = total > 0 ? Math.round((r.done / total) * 100) : 0;
          return (
            <div key={r.project} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-xs font-mono font-bold w-28 shrink-0 truncate" style={{ color: "#0891b2" }}>{r.project_code}</p>
              <MiniBar pct={pct} color="#059669" />
              <span className="text-xs font-mono shrink-0" style={{ color: "#64748b" }}>{r.done}/{total} done</span>
              {r.overdue > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "#fee2e2", color: "#dc2626" }}>
                  {r.overdue} overdue
                </span>
              )}
            </div>
          );
        })}
      </div>
      {canSeeWorkload && workload && workload.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#94a3b8" }}>Workload per Assignee</p>
          {workload.map((w) => (
            <div key={w.assignee} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs shrink-0" style={{ background: "#0d2a5e" }}>
                {w.email.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: "#0d2a5e" }}>{w.email}</p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  {w.logged_hours}h logged / {w.estimated_hours}h estimated
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0369a1" }}>{w.open} open</span>
              {w.overdue > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#dc2626" }}>{w.overdue} overdue</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountsCard() {
  const [counts, setCounts] = useState<{ users: number; pending: number } | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    Promise.all([authApi.getUsers(), authApi.getPendingUsers()])
      .then(([users, pending]) => active && setCounts({ users: users.length, pending: pending.length }))
      .catch(() => active && setCounts(null));
    return () => {
      active = false;
    };
  }, []);

  return (
    <SectionCard
      title="Accounts"
      aside={
        counts?.pending ? (
          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#fee2e2", color: "#dc2626" }}>{counts.pending}</span>
        ) : undefined
      }
    >
      <ul>
        {(
          [
            ["Registered accounts", counts?.users, "/admin/users", "Manage users"],
            ["Waiting for a role", counts?.pending, "/admin/pending-users", "Review requests"],
          ] as const
        ).map(([label, value, to, cta]) => (
          <li key={to} className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: "#f8fafc" }}>
            <div>
              <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>{label}</p>
              <Link to={to} className="text-xs font-bold" style={{ color: "#0891b2" }}>{cta} →</Link>
            </div>
            <p className="text-2xl font-black font-mono" style={{ color: "#0d2a5e" }}>
              {counts === undefined ? "…" : counts === null ? "—" : value}
            </p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const tier = resolveTier(user?.role);
  const hasRole = !!user?.role;
  const isWide = tier !== null && WIDE_TIERS.includes(tier);
  const canSeeWorkload = !!user?.role && TASK_ASSIGNER_CODES.includes(user.role.code);
  const navTargets = visibleSections(tier).flatMap((s) => s.items.filter((i) => i.ready).map((i) => i.to));
  const canOpen = (to: string) => navTargets.includes(to);

  const [data, setData] = useState<DashData>({});
  const [domainTab, setDomainTab] = useState<DomainTab>("projects");

  useEffect(() => {
    if (!hasRole) return;
    let active = true;
    Promise.all([
      settle(dashboardApi.getProjectDashboard()),
      settle(dashboardApi.getBudgetDashboard()),
      settle(dashboardApi.getComplianceDashboard()),
      settle(dashboardApi.getOutputDashboard()),
      settle(riskApi.getDashboard()),
      settle(dashboardApi.getForecastingDashboard()),
      settle(dashboardApi.getFundingAllocationDashboard()),
      settle(dashboardApi.getTaskDashboard()),
      settle(researchApi.getProjects()),
      settle(budgetApi.getBudgets()),
    ]).then(([projectDash, budgetDash, complianceDash, outputDash, riskDash, forecastDash, fundingDash, taskDash, projects, budgets]) => {
      if (!active) return;
      setData((d) => ({
        ...d,
        projectDash,
        budgetDash,
        complianceDash,
        outputDash,
        riskDash,
        forecastDash,
        fundingDash,
        taskDash,
        projects,
        budgets,
      }));
    });
    if (canSeeWorkload) {
      settle(personnelApi.getWorkload()).then((workload) => active && setData((d) => ({ ...d, workload })));
    }
    return () => {
      active = false;
    };
  }, [hasRole, canSeeWorkload]);

  if (!hasRole) {
    return (
      <div className="rounded-2xl p-5 flex items-start gap-3 animate-fade-in" style={{ background: "#fffbeb", border: "1px solid #fcd34d" }}>
        <span style={{ color: "#b45309" }}>{svgPath("M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z", 20)}</span>
        <div className="text-sm leading-relaxed">
          <p className="font-black" style={{ color: "#92400e" }}>Waiting for role assignment</p>
          <p className="mt-1" style={{ color: "#b45309" }}>
            Modules stay locked until a system administrator assigns your role. You will receive an email as soon as that happens.
          </p>
        </div>
      </div>
    );
  }

  const { projectDash, budgetDash, outputDash, riskDash } = data;
  const outputsTotal = outputDash
    ? sum(outputDash.publications_by_type) + sum(outputDash.ip_records_by_status) + outputDash.creative_works_count
    : 0;
  const highRisks = riskDash ? riskDash.by_risk_level.high + riskDash.by_risk_level.critical : 0;

  const DOMAIN_TABS: { key: DomainTab; label: string }[] = [
    { key: "projects", label: "Projects" },
    { key: "budget", label: "Budget" },
    { key: "compliance", label: "Compliance" },
    { key: "outputs", label: "Outputs" },
    { key: "me", label: "M&E" },
    { key: "risk", label: "Risk" },
    { key: "personnel", label: "Personnel" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {isWide && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile
            label="Total Projects"
            value={projectDash?.total_projects ? String(projectDash.total_projects) : "—"}
            sub={projectDash?.total_projects ? `${projectDash.by_status.active ?? 0} ongoing` : "No actual data"}
            color="#0d2a5e"
            bg="#e0eaf7"
            icon={svgPath("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2", 16)}
          />
          <KpiTile
            label="Research Budget"
            value={budgetDash?.project_count ? millions(budgetDash.total_approved) : "—"}
            sub={
              budgetDash?.utilization_pct != null ? `${Math.round(budgetDash.utilization_pct)}% overall utilization` : "No actual data"
            }
            color="#0891b2"
            bg="#e0f2fe"
            icon={svgPath("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2", 16)}
          />
          <KpiTile
            label="Research Outputs"
            value={outputsTotal > 0 ? String(outputsTotal) : "—"}
            sub={outputsTotal > 0 ? `${outputDash!.ip_incentive_eligible_count} IP incentive-eligible` : "No actual data"}
            color="#7c3aed"
            bg="#f5f3ff"
            icon={svgPath("M12 6.253v13M3 6.253l9-3.253 9 3.253", 16)}
          />
          <KpiTile
            label="Open High Risks"
            value={riskDash?.total_projects ? String(highRisks) : "—"}
            sub={riskDash?.total_projects ? "High + Critical, requiring attention" : "No actual data"}
            color="#dc2626"
            bg="#fee2e2"
            icon={svgPath("M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94", 16)}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap py-3 px-5 rounded-2xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs font-black uppercase tracking-widest mr-1" style={{ color: "#94a3b8" }}>Scope:</span>
          <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#0d2a5e", color: "white" }}>
            {isWide ? "Institution" : user?.office || roleScopeLine(user?.role)}
          </span>
        </div>
        <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{roleLabel(user?.role)}</span>
      </div>

      <DomainSummary data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl p-4 overflow-y-auto" style={{ background: "white", border: "1px solid #e2e8f0", maxHeight: "640px" }}>
          <ObjectiveDashboards data={data} canOpen={canOpen} />
        </div>

        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div className="flex overflow-x-auto border-b" style={{ borderColor: "#e2e8f0" }}>
            {DOMAIN_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setDomainTab(t.key)}
                className="px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all shrink-0"
                style={{
                  borderBottomColor: domainTab === t.key ? "#0891b2" : "transparent",
                  color: domainTab === t.key ? "#0891b2" : "#64748b",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-5 overflow-y-auto" style={{ maxHeight: "580px" }}>
            {domainTab === "projects" && <ProjectsPanel data={data} />}
            {domainTab === "budget" && <BudgetPanel data={data} />}
            {domainTab === "compliance" && <CompliancePanel data={data} />}
            {domainTab === "outputs" && <OutputsPanel data={data} />}
            {domainTab === "me" && <MEPanel data={data} />}
            {domainTab === "risk" && <RiskPanel data={data} />}
            {domainTab === "personnel" && <PersonnelPanel data={data} canSeeWorkload={canSeeWorkload} />}
          </div>
        </div>
      </div>

      {tier === "system_admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AccountsCard />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Dashboard">
        <DashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}
