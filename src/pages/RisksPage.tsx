import { useEffect, useMemo, useState } from "react";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { riskApi } from "../lib/riskApi";
import { notify } from "../lib/notify";
import { ALERT_ROUTING, CAT_META, FLAG_LABELS, FLAG_ORDER, LEVEL_META, STATUS_META } from "../lib/riskMeta";
import type { ProjectAssignment } from "../types/personnel";
import type { ProjectRisk, RiskCategory, RiskDashboard, RiskLevel, RiskRegisterStatus } from "../types/risk";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { NoActualData } from "../components/common/NoActualData";
import { SkeletonRows } from "../components/common/proto";
import { EarlyWarningPanel } from "../components/risks/EarlyWarning";
import { CatChip, IdentifyRiskModal, LevelBadge, RiskCard, RiskDetailModal, RiskHeatMap, StatusBadge, UpdateRiskModal } from "../components/risks/RiskParts";
import { useAuth } from "../context/AuthContext";

const MANAGE_ROLE_CODES = ["system_admin", "drd", "vprei", "crc_chair", "riuh", "program_leader", "project_leader"];

type Tab = "register" | "heatmap" | "mitigation" | "flags" | "alerts";

type Alert = {
  key: string;
  level: Exclude<RiskLevel, "low">;
  source: "Early-warning flags" | "Risk register";
  projectId: number;
  score: number;
  title: string;
  detail: string;
  risk?: ProjectRisk;
};

const selCls = "px-3 py-2 rounded-xl border text-xs outline-none";
const selSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };
const fmtDate = (iso: string) => iso.slice(0, 10);

function RisksContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canManage = MANAGE_ROLE_CODES.includes(code);

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [risks, setRisks] = useState<ProjectRisk[] | null>(null);
  const [dashboard, setDashboard] = useState<RiskDashboard | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [tab, setTab] = useState<Tab>("register");
  const [filterProject, setFilterProject] = useState<number | "all">("all");
  const [filterLevel, setFilterLevel] = useState<RiskLevel | "all">("all");
  const [filterStatus, setFilterStatus] = useState<RiskRegisterStatus | "all">("all");
  const [filterCat, setFilterCat] = useState<RiskCategory | "all">("all");
  const [heatProject, setHeatProject] = useState<number | "all">("all");
  const [alertScope, setAlertScope] = useState<"mine" | "all">(code === "system_admin" ? "all" : "mine");

  const [showIdentify, setShowIdentify] = useState(false);
  const [viewRisk, setViewRisk] = useState<ProjectRisk | null>(null);
  const [updateRisk, setUpdateRisk] = useState<ProjectRisk | null>(null);

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
    personnelApi
      .getAssignments({ active: true })
      .then((a) => alive && setAssignments(a))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    riskApi
      .getRegister()
      .then((r) => alive && setRisks(r))
      .catch(() => {
        if (!alive) return;
        setRisks([]);
        notify.error("Could not load the risk register.");
      });
    riskApi
      .getDashboard()
      .then((d) => alive && setDashboard(d))
      .catch(() => alive && setDashboard(null));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const names = useMemo(() => {
    const m = new Map<number, string>();
    projects?.forEach((p) => m.set(p.lead_detail.id, p.lead_detail.email));
    assignments.forEach((a) => m.set(a.user_detail.id, a.user_detail.email));
    risks?.forEach((r) => m.set(r.owner, r.owner_email));
    if (user) m.set(user.pk, user.email);
    return m;
  }, [projects, assignments, risks, user]);
  const nameOf = (id: number) => names.get(id) ?? `User #${id}`;

  const ownerOptions = (projectId: number) => {
    const m = new Map<number, string>();
    const p = projects?.find((x) => x.id === projectId);
    if (p) m.set(p.lead_detail.id, `${p.lead_detail.email} · Project Leader`);
    assignments.filter((a) => a.project === projectId).forEach((a) => m.has(a.user_detail.id) || m.set(a.user_detail.id, `${a.user_detail.email}${a.role_label ? ` · ${a.role_label}` : ""}`));
    if (user && !m.has(user.pk)) m.set(user.pk, `${user.email} · You`);
    return [...m].map(([id, label]) => ({ id, label }));
  };

  const projectOf = (id: number) => projects?.find((p) => p.id === id);
  const projectLabel = (id: number) => projectOf(id)?.project_code ?? `Project #${id}`;
  const changed = () => setReloadKey((k) => k + 1);

  const all = useMemo(() => risks ?? [], [risks]);
  const visible = all.filter(
    (r) =>
      (filterProject === "all" || r.project === filterProject) &&
      (filterLevel === "all" || r.level === filterLevel) &&
      (filterStatus === "all" || r.status === filterStatus) &&
      (filterCat === "all" || r.category === filterCat),
  );
  const heatRisks = all.filter((r) => r.status !== "closed" && (heatProject === "all" || r.project === heatProject));
  const active = all.filter((r) => r.status !== "closed");
  const riskProjects = [...new Set(visible.map((r) => r.project))];
  const activeProjects = [...new Set(active.map((r) => r.project))];

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    dashboard?.flagged_projects.forEach((p) => {
      if (p.risk_level === "low") return;
      const raised = FLAG_ORDER.filter((k) => p.flags[k].flagged).map((k) => FLAG_LABELS[k]);
      list.push({ key: `f${p.project}`, level: p.risk_level, source: "Early-warning flags", projectId: p.project, score: p.risk_score, title: raised.join(", "), detail: p.recommended_action });
    });
    all.forEach((r) => {
      if (r.status === "closed" || r.level === "low") return;
      list.push({ key: `r${r.id}`, level: r.level, source: "Risk register", projectId: r.project, score: r.score, title: r.description, detail: LEVEL_META[r.level].action, risk: r });
    });
    return list.sort((a, b) => b.score - a.score);
  }, [dashboard, all]);
  const myAlerts = code === "system_admin" ? alerts : alerts.filter((a) => ALERT_ROUTING[a.level].roles.includes(code));
  const shownAlerts = alertScope === "mine" ? myAlerts : alerts;

  if (projects === null || risks === null) return <SkeletonRows />;

  const kpis = [
    { label: "Open Risks", val: all.filter((r) => r.status === "open").length, color: "#dc2626", bg: "#fee2e2" },
    { label: "Critical", val: active.filter((r) => r.level === "critical").length, color: "#dc2626", bg: "#fecaca" },
    { label: "Escalated", val: all.filter((r) => r.status === "escalated").length, color: "#7c3aed", bg: "#ede9fe" },
    { label: "Mitigating", val: all.filter((r) => r.status === "mitigating").length, color: "#0891b2", bg: "#e0f2fe" },
    { label: "Flagged Projects", val: dashboard ? dashboard.flagged_projects.length : "—", color: "#ea580c", bg: "#ffedd5" },
  ];

  const tabs: [Tab, string, number | null][] = [
    ["register", "Risk Register", all.length],
    ["heatmap", "Heat Map", null],
    ["mitigation", "Mitigation Plan", null],
    ["flags", "Early-Warning Flags", dashboard ? dashboard.flagged_projects.length : null],
    ["alerts", "Alert Inbox", myAlerts.length],
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: k.bg }}>
            <p className="text-3xl font-black" style={{ color: k.color }}>{k.val}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: k.color }}>{k.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex items-center justify-between px-2 border-b flex-wrap" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex flex-wrap">
            {tabs.map(([k, l, n]) => (
              <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
                {l}
                {n !== null && n > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full" style={{ fontSize: "9px", background: k === "alerts" ? "#fee2e2" : "#f1f5f9", color: k === "alerts" ? "#dc2626" : "#64748b" }}>{n}</span>
                )}
              </button>
            ))}
          </div>
          {canManage && (
            <button onClick={() => setShowIdentify(true)} disabled={projects.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold mr-2 my-1.5 disabled:opacity-40" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
              + Identify Risk
            </button>
          )}
        </div>

        <div className="p-5">
          {tab === "register" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <select value={filterProject} onChange={(e) => setFilterProject(e.target.value === "all" ? "all" : Number(e.target.value))} className={selCls} style={selSt}>
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_code}</option>
                  ))}
                </select>
                <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value as RiskLevel | "all")} className={selCls} style={selSt}>
                  <option value="all">All Levels</option>
                  {(Object.keys(LEVEL_META) as RiskLevel[]).map((k) => (
                    <option key={k} value={k}>{LEVEL_META[k].label}</option>
                  ))}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as RiskRegisterStatus | "all")} className={selCls} style={selSt}>
                  <option value="all">All Statuses</option>
                  {(Object.keys(STATUS_META) as RiskRegisterStatus[]).map((k) => (
                    <option key={k} value={k}>{STATUS_META[k].label}</option>
                  ))}
                </select>
                <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as RiskCategory | "all")} className={selCls} style={selSt}>
                  <option value="all">All Categories</option>
                  {(Object.keys(CAT_META) as RiskCategory[]).map((k) => (
                    <option key={k} value={k}>{CAT_META[k].icon} {CAT_META[k].label}</option>
                  ))}
                </select>
                <p className="text-xs self-center" style={{ color: "#94a3b8" }}>{visible.length} risk{visible.length !== 1 ? "s" : ""}</p>
              </div>

              {all.length === 0 ? (
                <NoActualData message="No risks registered yet." hint={canManage ? "Use “+ Identify Risk” to add the first entry." : undefined} />
              ) : visible.length === 0 ? (
                <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc" }}>
                  <p className="text-sm" style={{ color: "#94a3b8" }}>No risks match the current filters.</p>
                </div>
              ) : (
                <>
                  {riskProjects.map((pid) => {
                    const projRisks = visible.filter((r) => r.project === pid);
                    const hasCritical = projRisks.some((r) => r.level === "critical" && r.status !== "closed");
                    return (
                      <div key={pid}>
                        <div className="flex items-center gap-3 mb-3">
                          <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#0d2a5e" }}>{projectLabel(pid)}</p>
                          <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{projectOf(pid)?.title}</p>
                          {hasCritical && <span className="text-xs px-2 py-0.5 rounded-full font-bold shrink-0" style={{ background: "#fee2e2", color: "#dc2626" }}>⚠️ Critical risks</span>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {projRisks.map((r) => (
                            <RiskCard key={r.id} risk={r} nameOf={nameOf} canManage={canManage} onView={() => setViewRisk(r)} onUpdate={() => setUpdateRisk(r)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Risk Register Table</p>
                    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["ID", "Project", "Risk", "Category", "L", "I", "Score", "Level", "Owner", "Status", "Mitigation", "Updated"].map((h) => (
                              <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((r) => (
                            <tr key={r.id} className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={() => setViewRisk(r)}>
                              <td className="px-3 py-2 font-mono font-bold whitespace-nowrap" style={{ color: "#0d2a5e" }}>R-{r.id}</td>
                              <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "#64748b" }}>{projectLabel(r.project)}</td>
                              <td className="px-3 py-2 max-w-xs truncate" style={{ color: "#334155" }}>{r.description}</td>
                              <td className="px-3 py-2"><CatChip category={r.category} /></td>
                              <td className="px-3 py-2 font-mono font-bold text-center" style={{ color: "#0891b2" }}>{r.likelihood}</td>
                              <td className="px-3 py-2 font-mono font-bold text-center" style={{ color: "#7c3aed" }}>{r.impact}</td>
                              <td className="px-3 py-2 font-mono font-black text-center" style={{ color: LEVEL_META[r.level].color }}>{r.score}</td>
                              <td className="px-3 py-2"><LevelBadge level={r.level} /></td>
                              <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#334155" }}>{nameOf(r.owner)}</td>
                              <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                              <td className="px-3 py-2" style={{ color: r.mitigation ? "#059669" : "#dc2626" }}>{r.mitigation ? "Defined" : "Not defined"}</td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "#94a3b8" }}>{fmtDate(r.updated_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "heatmap" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Project:</p>
                <select value={heatProject} onChange={(e) => setHeatProject(e.target.value === "all" ? "all" : Number(e.target.value))} className={selCls} style={selSt}>
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_code}</option>
                  ))}
                </select>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{heatRisks.length} active risk{heatRisks.length !== 1 ? "s" : ""} (closed excluded) · cells show register IDs</p>
              </div>
              <RiskHeatMap risks={heatRisks} />
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mt-4">
                {(Object.keys(CAT_META) as RiskCategory[]).map((k) => {
                  const m = CAT_META[k];
                  return (
                    <div key={k} className="rounded-xl p-3" style={{ background: m.bg }}>
                      <p className="text-xl font-black" style={{ color: m.color }}>{heatRisks.filter((r) => r.category === k).length}</p>
                      <p className="text-xs font-semibold" style={{ color: m.color }}>{m.icon} {m.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "mitigation" && (
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Risk Mitigation Plans · active risks, highest score first</p>
              {activeProjects.length === 0 && <NoActualData message="No active risks in the register." />}
              {activeProjects.map((pid) => {
                const projRisks = active.filter((r) => r.project === pid).sort((a, b) => b.score - a.score);
                return (
                  <div key={pid} className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                    <div className="px-4 py-3" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <p className="text-sm font-black" style={{ color: "#0d2a5e" }}>{projectLabel(pid)} — {projectOf(pid)?.title}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>{projRisks.length} active risk{projRisks.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                      {projRisks.map((r) => (
                        <div key={r.id} className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <LevelBadge level={r.level} />
                              <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{r.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={r.status} />
                              {canManage && (
                                <button onClick={() => setUpdateRisk(r)} className="text-xs px-2 py-0.5 rounded-lg font-bold" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                                  Update
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
                              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Mitigation Actions</p>
                              <p className="text-xs whitespace-pre-line" style={{ color: "#334155" }}>{r.mitigation || "Not yet defined."}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: "#fff7ed" }}>
                              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#ea580c" }}>Required Response</p>
                              <p className="text-xs" style={{ color: "#334155" }}>{LEVEL_META[r.level].action}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <p className="text-xs" style={{ color: "#94a3b8" }}>
                              Owner: <span style={{ color: "#334155", fontWeight: 600 }}>{nameOf(r.owner)}</span>
                            </p>
                            <p className="text-xs" style={{ color: "#94a3b8" }}>Last updated: {fmtDate(r.updated_at)}</p>
                            <button onClick={() => setViewRisk(r)} className="text-xs font-semibold" style={{ color: "#0891b2" }}>View history →</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "flags" && <EarlyWarningPanel projects={projects} />}

          {tab === "alerts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  {(["medium", "high", "critical"] as const).map((k) => (
                    <span key={k} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: LEVEL_META[k].bg, color: LEVEL_META[k].color }}>
                      {LEVEL_META[k].label} → {ALERT_ROUTING[k].to}
                    </span>
                  ))}
                </div>
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#e2e8f0" }}>
                  {(
                    [
                      ["mine", `For my role (${myAlerts.length})`],
                      ["all", `All alerts (${alerts.length})`],
                    ] as const
                  ).map(([k, l]) => (
                    <button key={k} onClick={() => setAlertScope(k)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={alertScope === k ? { background: "white", color: "#0d2a5e" } : { color: "#64748b" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {shownAlerts.length === 0 ? (
                <NoActualData message={alertScope === "mine" ? "No alerts routed to your role." : "No medium, high or critical risks right now."} />
              ) : (
                <div className="space-y-2">
                  {shownAlerts.map((a) => {
                    const lm = LEVEL_META[a.level];
                    return (
                      <div
                        key={a.key}
                        className={`rounded-xl p-4 flex items-start gap-3 ${a.risk ? "cursor-pointer hover:shadow-sm" : ""}`}
                        style={{ background: "white", border: `1px solid ${lm.color}40`, borderLeft: `4px solid ${lm.color}` }}
                        onClick={() => a.risk && setViewRisk(a.risk)}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black" style={{ background: lm.bg, color: lm.color }}>{a.score}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <LevelBadge level={a.level} />
                            <p className="text-xs font-black" style={{ color: "#0d2a5e" }}>{projectLabel(a.projectId)}</p>
                            <span className="text-xs" style={{ color: "#94a3b8" }}>· {a.source}</span>
                          </div>
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: "#334155" }}>{a.title}</p>
                          <p className="text-xs mt-1 font-semibold" style={{ color: lm.color }}>{a.detail} · routed to {ALERT_ROUTING[a.level].to}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showIdentify && (
        <IdentifyRiskModal
          projects={projects}
          defaultProject={filterProject === "all" ? null : filterProject}
          ownerOptions={ownerOptions}
          currentUserId={user?.pk ?? null}
          onSaved={changed}
          onClose={() => setShowIdentify(false)}
        />
      )}
      {viewRisk && (
        <RiskDetailModal
          risk={viewRisk}
          projectLabel={projectLabel(viewRisk.project)}
          nameOf={nameOf}
          canManage={canManage}
          onUpdate={() => {
            setUpdateRisk(viewRisk);
            setViewRisk(null);
          }}
          onClose={() => setViewRisk(null)}
        />
      )}
      {updateRisk && <UpdateRiskModal risk={updateRisk} onSaved={changed} onClose={() => setUpdateRisk(null)} />}
    </div>
  );
}

export default function RisksPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Risk Management">
        <RisksContent />
      </AppShell>
    </ProtectedRoute>
  );
}
