import { useEffect, useState } from "react";
import { riskApi } from "../../lib/riskApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { FLAG_LABELS, FLAG_ORDER, LEVEL_META, flagDetail, levelOf } from "../../lib/riskMeta";
import type { ProjectRiskStatus, RiskDashboard, RiskLevel } from "../../types/risk";
import type { Project } from "../../types/research";
import { NoActualData } from "../common/NoActualData";
import { SkeletonRows, TableHead } from "../common/proto";
import { LevelBadge } from "./RiskParts";

const FUNDING_TYPE_LABELS: Record<string, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const selCls = "px-3 py-2 rounded-xl border text-xs outline-none";
const selSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

function FlagChips({ status }: { status: ProjectRiskStatus }) {
  const active = FLAG_ORDER.filter((k) => status.flags[k].flagged);
  if (active.length === 0) return <span className="text-xs" style={{ color: "#94a3b8" }}>No flags</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((k) => {
        const lm = LEVEL_META[levelOf(status.flags[k].score)];
        return (
          <span key={k} title={flagDetail(k, status.flags)} className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: lm.bg, color: lm.color }}>
            {FLAG_LABELS[k]} · {status.flags[k].score}
          </span>
        );
      })}
    </div>
  );
}

function ProjectStatusCard({ status, project }: { status: ProjectRiskStatus; project: Project | undefined }) {
  const lm = LEVEL_META[status.risk_level];
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div className="min-w-0">
          <p className="text-sm font-black" style={{ color: "#0d2a5e" }}>{status.project_code}</p>
          <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{project?.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-black leading-none" style={{ color: lm.color }}>{status.risk_score}<span className="text-xs">/25</span></p>
            <p className="text-xs" style={{ color: "#94a3b8" }}>Highest flag score</p>
          </div>
          <LevelBadge level={status.risk_level} />
        </div>
      </div>
      <div className="px-4 py-3 text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ background: lm.bg, color: lm.color }}>
        <span>
          <strong>Recommended action:</strong> {status.recommended_action}
        </span>
        <span>
          {status.flagged_count} flag{status.flagged_count === 1 ? "" : "s"} raised · {status.open_register_risks} open register risk{status.open_register_risks === 1 ? "" : "s"}
        </span>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {FLAG_ORDER.map((k) => {
          const f = status.flags[k];
          const fm = LEVEL_META[levelOf(f.score)];
          return (
            <div key={k} className="rounded-xl p-3" style={{ background: f.flagged ? fm.bg : "#f8fafc", border: `1px solid ${f.flagged ? fm.color + "40" : "#e2e8f0"}` }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{FLAG_LABELS[k]}</p>
                {f.flagged ? (
                  <span className="text-xs font-black" style={{ color: fm.color }}>
                    L{f.likelihood} × I{f.impact} = {f.score}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#d1fae5", color: "#059669" }}>Clear</span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: "#64748b" }}>{flagDetail(k, status.flags)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EarlyWarningPanel({ projects }: { projects: Project[] }) {
  const [view, setView] = useState<"overview" | "project">("overview");
  const [campus, setCampus] = useState("");
  const [fundingType, setFundingType] = useState("");
  const [filters, setFilters] = useState<{ campus?: string; funding_type?: string }>({});
  const [dashboard, setDashboard] = useState<RiskDashboard | null>(null);
  const [projectId, setProjectId] = useState<number | null>(projects[0]?.id ?? null);
  const [status, setStatus] = useState<ProjectRiskStatus | null>(null);

  const campuses = [...new Set(projects.map((p) => p.campus).filter(Boolean))].sort();

  useEffect(() => {
    let alive = true;
    riskApi
      .getDashboard(filters)
      .then((d) => alive && setDashboard(d))
      .catch((err) => {
        if (!alive) return;
        setDashboard({ total_projects: 0, by_risk_level: { low: 0, medium: 0, high: 0, critical: 0 }, flagged_projects: [] });
        notify.error(errorMessage(err, "Could not load the risk dashboard."));
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  useEffect(() => {
    if (projectId === null) return;
    let alive = true;
    riskApi
      .getProjectStatus(projectId)
      .then((s) => alive && setStatus(s))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load this project's risk status.")));
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: "#64748b" }}>
          Computed live from reports, budget, milestones, personnel, procurement and forecasts. Each trigger is scored Likelihood × Impact on the 5×5 scale.
        </p>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#e2e8f0" }}>
          {(
            [
              ["overview", "Institution Overview"],
              ["project", "Project Risk Status"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={view === k ? { background: "white", color: "#0d2a5e" } : { color: "#64748b" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {view === "overview" && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={campus} onChange={(e) => setCampus(e.target.value)} className={selCls} style={selSt}>
              <option value="">All Campuses</option>
              {campuses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={fundingType} onChange={(e) => setFundingType(e.target.value)} className={selCls} style={selSt}>
              <option value="">All Funding Types</option>
              {Object.entries(FUNDING_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setDashboard(null);
                setFilters({ campus: campus || undefined, funding_type: fundingType || undefined });
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: "#0d2a5e" }}
            >
              Apply
            </button>
          </div>
          {!dashboard ? (
            <SkeletonRows />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-xl p-3" style={{ background: "#e0eaf7" }}>
                  <p className="text-2xl font-black" style={{ color: "#0d2a5e" }}>{dashboard.total_projects}</p>
                  <p className="text-xs font-semibold" style={{ color: "#0d2a5e" }}>Active Projects</p>
                </div>
                {(["low", "medium", "high", "critical"] as RiskLevel[]).map((k) => (
                  <div key={k} className="rounded-xl p-3" style={{ background: LEVEL_META[k].bg }}>
                    <p className="text-2xl font-black" style={{ color: LEVEL_META[k].color }}>{dashboard.by_risk_level[k]}</p>
                    <p className="text-xs font-semibold" style={{ color: LEVEL_META[k].color }}>{LEVEL_META[k].label} Risk</p>
                  </div>
                ))}
              </div>
              {dashboard.flagged_projects.length === 0 ? (
                <NoActualData message="No active project has a raised early-warning flag." />
              ) : (
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
                  <table className="w-full text-xs">
                    <TableHead cols={["Project", "Score", "Level", "Raised Flags", "Recommended Action"]} />
                    <tbody>
                      {dashboard.flagged_projects.map((p) => (
                        <tr key={p.project} className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={() => { setProjectId(p.project); setView("project"); }}>
                          <td className="px-3 py-2">
                            <p className="font-bold" style={{ color: "#0d2a5e" }}>{p.project_code}</p>
                            <p className="truncate max-w-[220px]" style={{ color: "#94a3b8" }}>{projects.find((x) => x.id === p.project)?.title}</p>
                          </td>
                          <td className="px-3 py-2 font-mono font-black" style={{ color: LEVEL_META[p.risk_level].color }}>{p.risk_score}</td>
                          <td className="px-3 py-2"><LevelBadge level={p.risk_level} /></td>
                          <td className="px-3 py-2"><FlagChips status={p} /></td>
                          <td className="px-3 py-2" style={{ color: "#334155" }}>{p.recommended_action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {view === "project" && (
        <>
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Project:</p>
            <select
              value={projectId ?? ""}
              onChange={(e) => {
                setStatus(null);
                setProjectId(Number(e.target.value));
              }}
              className={selCls + " max-w-[420px]"}
              style={selSt}
            >
              {projects.length === 0 && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
              ))}
            </select>
          </div>
          {projectId === null ? (
            <NoActualData message="No projects registered yet." />
          ) : !status || status.project !== projectId ? (
            <SkeletonRows />
          ) : (
            <ProjectStatusCard status={status} project={projects.find((p) => p.id === projectId)} />
          )}
        </>
      )}
    </div>
  );
}
