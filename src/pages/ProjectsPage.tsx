import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { personnelApi } from "../lib/personnelApi";
import { monitoringApi } from "../lib/monitoringApi";
import { RESEARCH_TYPE_LABELS } from "../lib/projectOptions";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE } from "../lib/projectStatus";
import type { Milestone, Program, Project, FundingType, RecordStatus } from "../types/research";
import type { ProjectAssignment } from "../types/personnel";
import type { ProjectMonitoringStatus } from "../types/monitoring";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { notify } from "../lib/notify";

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const REGISTRATION_ROLE_CODES = ["system_admin", "crc_chair", "drd", "riuh", "program_leader", "project_leader", "study_leader"];

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);

function StatusBadge({ status }: { status: RecordStatus }) {
  const c = PROJECT_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

function ProgressBar({ label, pct, color }: { label: string; pct: number | null | undefined; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span className="font-mono font-bold" style={{ color }}>
          {pct === undefined ? "…" : pct === null ? "—" : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: color }} />
      </div>
    </div>
  );
}

function ProjectsContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRegister = !!user?.role && REGISTRATION_ROLE_CODES.includes(user.role.code);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [statuses, setStatuses] = useState<Record<number, ProjectMonitoringStatus | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<RecordStatus | "all">("all");
  const [filterType, setFilterType] = useState<FundingType | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([researchApi.getPrograms(), researchApi.getProjects()])
      .then(([programList, projectList]) => {
        if (!active) return;
        setPrograms(programList);
        setProjects(projectList);
        projectList.forEach((p) =>
          monitoringApi
            .getProjectStatus(p.id)
            .then((st) => active && setStatuses((s) => ({ ...s, [p.id]: st })))
            .catch(() => active && setStatuses((s) => ({ ...s, [p.id]: null }))),
        );
      })
      .catch(() => active && notify.error("Could not load projects. Check your connection and refresh."))
      .finally(() => active && setIsLoading(false));
    researchApi
      .getMilestones()
      .then((m) => active && setMilestones(m))
      .catch(() => undefined);
    personnelApi
      .getAssignments({ active: true })
      .then((a) => active && setAssignments(a))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const counts = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const q = search.toLowerCase();
  const visible = projects.filter((p) => {
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchType = filterType === "all" || p.funding_type === filterType;
    const matchSearch =
      p.title.toLowerCase().includes(q) ||
      p.project_code.toLowerCase().includes(q) ||
      p.implementing_unit.toLowerCase().includes(q) ||
      p.cooperating_agencies.toLowerCase().includes(q);
    return matchStatus && matchType && matchSearch;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-xl" style={{ color: "#0d2a5e" }}>Research Projects</h2>
          <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
            {projects.length} registered project{projects.length !== 1 ? "s" : ""} · {programs.length} program
            {programs.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canRegister && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/programs/new")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "#e0eaf7", color: "#0d2a5e" }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Register Program
            </button>
            <button
              onClick={() => navigate("/projects/new")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #0d2a5e, #1a3f7a)" }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Register Approved Project
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(["all", "active", "completed", "archived"] as const).map((s) => {
          const isAll = s === "all";
          const count = isAll ? projects.length : counts[s] ?? 0;
          const active = filterStatus === s;
          const c = isAll ? { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" } : PROJECT_STATUS_STYLE[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="rounded-xl p-3 text-left transition-all hover:shadow-sm"
              style={{
                background: active ? (isAll ? "#0d2a5e" : c.bg) : "white",
                border: `2px solid ${active ? (isAll ? "#0d2a5e" : c.dot) : "#e2e8f0"}`,
              }}
            >
              <p className="text-lg font-black" style={{ color: active ? (isAll ? "white" : c.text) : "#0d2a5e" }}>{count}</p>
              <p className="text-xs font-semibold mt-0.5 leading-tight" style={{ color: active ? (isAll ? "rgba(255,255,255,0.7)" : c.text) : "#94a3b8" }}>
                {isAll ? "All" : PROJECT_STATUS_LABELS[s]}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search projects, codes, units, agencies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 rounded-xl text-sm border outline-none w-full sm:w-[280px]"
            style={{ background: "white", borderColor: "#e2e8f0", color: "#334155" }}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FundingType | "all")}
          className="px-3 py-2 rounded-xl text-sm border outline-none"
          style={{ background: "white", borderColor: "#e2e8f0", color: "#334155" }}
        >
          <option value="all">All Funding Types</option>
          {Object.entries(FUNDING_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "white", border: "1px solid #e2e8f0" }} />)
        ) : projects.length === 0 ? (
          <NoActualData hint={canRegister ? 'Click "Register Approved Project" once a project has its Notice to Proceed.' : undefined} />
        ) : visible.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-semibold" style={{ color: "#64748b" }}>No projects match your filters.</p>
          </div>
        ) : (
          visible.map((proj) => {
            const ms = milestones.filter((m) => m.project === proj.id);
            const msDone = ms.filter((m) => m.status === "done").length;
            const team = assignments.filter((a) => a.project === proj.id).length + 1;
            const program = programs.find((p) => p.id === proj.program);
            const st = statuses[proj.id];
            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:border-[#0891b2] hover:-translate-y-px"
                style={{ background: "white", border: "1px solid #e2e8f0" }}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                        {proj.project_code}
                      </span>
                      <StatusBadge status={proj.status} />
                      {proj.research_type && (
                        <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
                          {RESEARCH_TYPE_LABELS[proj.research_type]}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
                        {FUNDING_LABELS[proj.funding_type]}
                      </span>
                      {proj.campus && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0891b2" }}>
                          {proj.campus}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm leading-snug" style={{ color: "#0d2a5e" }}>{proj.title}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs" style={{ color: "#64748b" }}>
                      <span>
                        PI: <strong>{proj.lead_detail.email}</strong>
                      </span>
                      {proj.implementing_unit && (
                        <>
                          <span>·</span>
                          <span>{proj.implementing_unit}</span>
                        </>
                      )}
                      {proj.cooperating_agencies && (
                        <>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: "#0891b2" }}>{proj.cooperating_agencies}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs" style={{ color: "#94a3b8" }}>Total Project Cost</p>
                    <p className="text-lg font-black font-mono" style={{ color: "#0d2a5e" }}>
                      {proj.total_cost ? peso(Number(proj.total_cost)) : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p style={{ color: "#94a3b8" }}>Period</p>
                    <p className="font-semibold" style={{ color: "#334155" }}>
                      {proj.start_date ?? "—"} – {proj.target_end_date ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "#94a3b8" }}>Milestones</p>
                    <p className="font-semibold" style={{ color: "#334155" }}>{msDone}/{ms.length} done</p>
                  </div>
                  <div>
                    <p style={{ color: "#94a3b8" }}>Research Program</p>
                    <p className="font-semibold truncate" style={{ color: "#334155", maxWidth: "160px" }}>{program?.title ?? "Stand-alone"}</p>
                  </div>
                  <div>
                    <p style={{ color: "#94a3b8" }}>Team</p>
                    <p className="font-semibold" style={{ color: "#334155" }}>
                      {team} member{team !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ProgressBar label="Physical Progress (deliverables)" pct={st === undefined ? undefined : st?.deliverables_pct ?? null} color="#0891b2" />
                  <ProgressBar label="Financial Utilization" pct={st === undefined ? undefined : st?.budget_used_pct ?? null} color="#7c3aed" />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "#f1f5f9", background: "#f8fafc" }}>
          <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>Research Programs</p>
          <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{programs.length}</span>
        </div>
        {isLoading ? (
          <div className="p-5">
            <div className="h-10 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
          </div>
        ) : programs.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm" style={{ color: "#94a3b8" }}>
            No programs yet. Register one once two or more related projects need grouping.
          </p>
        ) : (
          <ul>
            {programs.map((p) => (
              <li key={p.id} className="px-5 py-3 flex flex-wrap items-center gap-3 border-b" style={{ borderColor: "#f8fafc" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1e293b" }}>{p.title}</p>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    {FUNDING_LABELS[p.funding_type]} · {p.lead_detail.email} · {projects.filter((x) => x.program === p.id).length} project(s)
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Project Management">
        <ProjectsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
