import { useEffect, useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { personnelApi } from "../lib/personnelApi";
import { monitoringApi } from "../lib/monitoringApi";
import { outputsApi } from "../lib/outputsApi";
import { budgetApi } from "../lib/budgetApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE } from "../lib/projectStatus";
import {
  PRIORITY_AREA_LABELS,
  RESEARCH_TYPE_LABELS,
  SDG_LABELS,
  SECTOR_LABELS,
  TYPOLOGY_LABELS,
} from "../lib/projectOptions";
import type {
  FundingType,
  Milestone,
  MilestoneStatus,
  Program,
  Project,
  ProjectStatusHistory,
  RecordStatus,
  Study,
} from "../types/research";
import type { AdminUser } from "../types/auth";
import type { ProjectAssignment } from "../types/personnel";
import type { ProjectMonitoringStatus, TerminalReport } from "../types/monitoring";
import type { ExpectedVsActual, ProjectOutcome } from "../types/outputs";
import type { LineItemBudget } from "../types/budget";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { EmptyOption } from "../components/common/EmptyOption";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DetailTab = "overview" | "registration" | "team" | "workplan" | "impact" | "history" | "closure";

const REGISTRATION_ROLE_CODES = ["system_admin", "crc_chair"];
const MILESTONE_ROLE_CODES = ["system_admin", "crc_chair", "program_leader", "project_leader", "study_leader"];

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Completed",
  delayed: "Delayed",
};

const MILESTONE_COLORS: Record<MilestoneStatus, { bar: string; bg: string; text: string }> = {
  done: { bar: "#16a34a", bg: "#dcfce7", text: "#166534" },
  in_progress: { bar: "#0891b2", bg: "#e0f2fe", text: "#164e63" },
  pending: { bar: "#cbd5e1", bg: "#f1f5f9", text: "#64748b" },
  delayed: { bar: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
};

const INPUT = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-[#0891b2]";
const INPUT_STYLE = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);

const lines = (s: string) =>
  s
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim())
    .filter(Boolean);

function monthsBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const s = new Date(a);
  const e = new Date(b);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const c = PROJECT_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#94a3b8" }}>{children}</p>;
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="text-sm font-semibold mt-1 leading-snug" style={{ color: "#1e293b" }}>{value || "—"}</p>
    </div>
  );
}

function NumberedList({ items, color = "#0891b2", empty }: { items: string[]; color?: string; empty: string }) {
  if (items.length === 0) return <p className="text-sm" style={{ color: "#94a3b8" }}>{empty}</p>;
  return (
    <ol className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          <span className="font-bold shrink-0" style={{ color }}>{i + 1}.</span>
          <span style={{ color: "#334155" }}>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="label-field">
      {children}
      {required && <span style={{ color: "#dc2626" }}> *</span>}
    </label>
  );
}

function LifecyclePipeline({ project, terminal }: { project: Project; terminal: TerminalReport | null | undefined }) {
  const stages = [
    { label: "NTP Issued", done: !!project.ntp_date || !!project.ntp_number },
    { label: "Ongoing", done: project.status !== "active" || !!project.start_date },
    { label: "Terminal Report", done: !!terminal },
    { label: "Certified", done: !!terminal?.is_certified },
    { label: "Completed", done: project.status === "completed" || project.status === "archived" },
    { label: "Closed", done: project.status === "archived" },
  ];
  const lastDone = stages.reduce((last, st, i) => (st.done ? i : last), -1);
  const currentIdx = lastDone + 1;
  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {stages.map((stage, idx) => {
        const done = idx <= lastDone;
        const active = idx === currentIdx;
        return (
          <div key={stage.label} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                style={{
                  background: done ? "#0d2a5e" : active ? "#0891b2" : "white",
                  borderColor: done ? "#0d2a5e" : active ? "#0891b2" : "#e2e8f0",
                  color: done || active ? "white" : "#94a3b8",
                }}
              >
                {done ? (
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <p
                className="text-xs font-semibold whitespace-nowrap"
                style={{ color: done ? "#0d2a5e" : active ? "#0891b2" : "#94a3b8", fontSize: "10px" }}
              >
                {stage.label}
              </p>
            </div>
            {idx < stages.length - 1 && (
              <div className="w-8 h-px mx-0.5 mt-[-10px]" style={{ background: done ? "#0d2a5e" : "#e2e8f0" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function GanttChart({ project, milestones, now }: { project: Project; milestones: Milestone[]; now: number }) {
  if (milestones.length === 0) return <p className="text-sm py-4 text-center" style={{ color: "#94a3b8" }}>No milestones defined yet.</p>;
  const dates = milestones.flatMap((m) => [m.start_date, m.target_date]).filter(Boolean) as string[];
  const start = new Date(project.start_date ?? dates.sort()[0]);
  const end = new Date(project.target_end_date ?? dates.sort().slice(-1)[0]);
  const totalMs = Math.max(1, end.getTime() - start.getTime());
  const toPercent = (d: string) => Math.max(0, Math.min(100, ((new Date(d).getTime() - start.getTime()) / totalMs) * 100));
  const todayPct = Math.max(0, Math.min(100, ((now - start.getTime()) / totalMs) * 100));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex text-xs mb-2" style={{ color: "#94a3b8" }}>
          <div className="w-52 shrink-0" />
          <div className="flex-1 relative h-5">
            {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
              <span key={q} className="absolute font-semibold" style={{ left: `${i * 25}%`, transform: "translateX(-50%)" }}>{q}</span>
            ))}
          </div>
        </div>
        {milestones.map((ms) => {
          const left = toPercent(ms.start_date ?? ms.target_date);
          const width = Math.max(1, toPercent(ms.target_date) - left);
          const c = MILESTONE_COLORS[ms.status];
          return (
            <div key={ms.id} className="flex items-center mb-1.5">
              <div className="w-52 shrink-0 pr-4">
                <p className="text-xs font-medium truncate" style={{ color: "#334155" }}>{ms.title}</p>
              </div>
              <div className="flex-1 relative h-6 rounded" style={{ background: "#f1f5f9" }}>
                <div className="absolute top-1 bottom-1 rounded" style={{ left: `${left}%`, width: `${width}%`, background: c.bar }} />
                <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${todayPct}%`, background: "#ef4444", opacity: 0.7 }} />
              </div>
            </div>
          );
        })}
        <div className="flex">
          <div className="w-52 shrink-0" />
          <div className="flex-1 relative h-4">
            <div className="absolute flex items-center" style={{ left: `${todayPct}%`, transform: "translateX(-50%)" }}>
              <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectDetailContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleCode = user?.role?.code ?? "";
  const canRegister = REGISTRATION_ROLE_CODES.includes(roleCode);
  const canManageMilestones = MILESTONE_ROLE_CODES.includes(roleCode);
  const projectId = Number(id);

  const [tab, setTab] = useState<DetailTab>("overview");
  const [now] = useState(() => Date.now());
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);
  const [project, setProject] = useState<Project | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [team, setTeam] = useState<ProjectAssignment[]>([]);
  const [history, setHistory] = useState<ProjectStatusHistory[] | null | undefined>(undefined);
  const [status, setStatus] = useState<ProjectMonitoringStatus | null | undefined>(undefined);
  const [terminal, setTerminal] = useState<TerminalReport | null | undefined>(undefined);
  const [expected, setExpected] = useState<ExpectedVsActual | null>(null);
  const [outcomes, setOutcomes] = useState<ProjectOutcome[]>([]);
  const [budgets, setBudgets] = useState<LineItemBudget[]>([]);
  const [studyLeaders, setStudyLeaders] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [studyDialogOpen, setStudyDialogOpen] = useState(false);
  const [studyForm, setStudyForm] = useState({ title: "", lead: "" });
  const [attemptedStudy, setAttemptedStudy] = useState(false);
  const [isCreatingStudy, setIsCreatingStudy] = useState(false);

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", start_date: "", target_date: "", objective: "", deliverable: "" });
  const [attemptedMilestone, setAttemptedMilestone] = useState(false);
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [updatingMilestone, setUpdatingMilestone] = useState<number | null>(null);

  const [closureStatus, setClosureStatus] = useState<RecordStatus | "">("");
  const [closureRemarks, setClosureRemarks] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (Number.isNaN(projectId)) return;
    let active = true;
    const guard = <T,>(fn: (v: T) => void) => (v: T) => {
      if (active) fn(v);
    };
    Promise.all([researchApi.getProject(projectId), researchApi.getStudies(projectId), researchApi.getMilestones(projectId)])
      .then(
        guard(([proj, studyList, milestoneList]: [Project, Study[], Milestone[]]) => {
          setProject(proj);
          setStudies(studyList);
          setMilestones(milestoneList);
          if (proj.program) {
            researchApi
              .getPrograms()
              .then(guard((ps: Program[]) => setProgram(ps.find((p) => p.id === proj.program) ?? null)))
              .catch(() => undefined);
          }
        }),
      )
      .catch(guard(() => notify.error("Could not load this project. Check your connection and refresh.")))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    researchApi.getStatusHistory(projectId).then(guard(setHistory)).catch(guard(() => setHistory(null)));
    monitoringApi.getProjectStatus(projectId).then(guard(setStatus)).catch(guard(() => setStatus(null)));
    monitoringApi
      .getTerminalReports({ project: projectId })
      .then(guard((r: TerminalReport[]) => setTerminal(r[0] ?? null)))
      .catch(guard(() => setTerminal(null)));
    personnelApi.getAssignments({ project: projectId, active: true }).then(guard(setTeam)).catch(() => undefined);
    outputsApi.getExpectedVsActual(projectId).then(guard(setExpected)).catch(() => undefined);
    outputsApi.getOutcomes({ project: projectId }).then(guard(setOutcomes)).catch(() => undefined);
    budgetApi.getBudgets(projectId).then(guard(setBudgets)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projectId, reloadKey]);

  useEffect(() => {
    if (!canRegister) return;
    researchApi.getUsersByRole("study_leader").then(setStudyLeaders).catch(() => undefined);
  }, [canRegister]);

  const handleCreateStudy = async () => {
    setAttemptedStudy(true);
    if (!studyForm.title || !studyForm.lead) {
      notify.error("Study title and lead are required.");
      return;
    }
    setIsCreatingStudy(true);
    try {
      await researchApi.createStudy({ project: projectId, title: studyForm.title, lead: Number(studyForm.lead) });
      setAttemptedStudy(false);
      notify.success("Study added.");
      setStudyForm({ title: "", lead: "" });
      setStudyDialogOpen(false);
      load();
    } catch (err) {
      notify.error(errorMessage(err, "Could not add the study."));
    } finally {
      setIsCreatingStudy(false);
    }
  };

  const handleCreateMilestone = async () => {
    setAttemptedMilestone(true);
    if (!milestoneForm.title || !milestoneForm.target_date) {
      notify.error("Milestone title and target date are required.");
      return;
    }
    setIsCreatingMilestone(true);
    try {
      await researchApi.createMilestone({
        project: projectId,
        title: milestoneForm.title,
        target_date: milestoneForm.target_date,
        start_date: milestoneForm.start_date || undefined,
        objective: milestoneForm.objective || undefined,
        deliverable: milestoneForm.deliverable || undefined,
      });
      setAttemptedMilestone(false);
      notify.success("Milestone added.");
      setMilestoneForm({ title: "", start_date: "", target_date: "", objective: "", deliverable: "" });
      setMilestoneDialogOpen(false);
      load();
    } catch (err) {
      notify.error(errorMessage(err, "Could not add the milestone."));
    } finally {
      setIsCreatingMilestone(false);
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: number, next: string) => {
    setUpdatingMilestone(milestoneId);
    try {
      await researchApi.updateMilestoneStatus(milestoneId, next);
      load();
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the milestone status."));
    } finally {
      setUpdatingMilestone(null);
    }
  };

  const handleClosure = async () => {
    if (!closureStatus) {
      notify.error("Choose the new project status first.");
      return;
    }
    setIsClosing(true);
    try {
      await researchApi.updateProject(projectId, { status: closureStatus, status_remarks: closureRemarks });
      notify.success(`Project marked ${PROJECT_STATUS_LABELS[closureStatus]}.`);
      setClosureStatus("");
      setClosureRemarks("");
      load();
    } catch (err) {
      notify.error(errorMessage(err, "Could not change the project status."));
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-56 rounded-2xl animate-pulse" style={{ background: "white", border: "1px solid #e2e8f0" }} />
        <div className="h-80 rounded-2xl animate-pulse" style={{ background: "white", border: "1px solid #e2e8f0" }} />
      </div>
    );
  }
  if (!project) return <NoActualData message="Project not found" />;

  const libTotal = budgets.filter((b) => b.is_current).reduce((s, b) => s + Number(b.total_amount), 0);
  const duration = monthsBetween(project.start_date, project.target_end_date);
  const teamSize = team.length + 1;
  const phys = status?.deliverables_pct ?? null;
  const fin = status?.budget_used_pct ?? null;
  const recordedOutcomes = outcomes.filter((o) => o.kind === "outcome").map((o) => o.description);
  const recordedImpacts = outcomes.filter((o) => o.kind === "impact").map((o) => o.description);

  const tabs: { key: DetailTab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📋" },
    { key: "registration", label: "Registration Info", icon: "📝" },
    { key: "team", label: "Team", icon: "👥" },
    { key: "workplan", label: "Work Plan", icon: "📅" },
    { key: "impact", label: "Impact", icon: "🌱" },
    { key: "history", label: "History", icon: "🕑" },
    { key: "closure", label: "Closure", icon: "🔒" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Project List
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-mono font-semibold" style={{ color: "#64748b" }}>{project.project_code}</span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.15)", color: "#67e8f9" }}>
                  {project.project_code}
                </span>
                {project.research_type && (
                  <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(168,196,232,0.9)" }}>
                    {RESEARCH_TYPE_LABELS[project.research_type]}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(168,196,232,0.9)" }}>
                  {FUNDING_LABELS[project.funding_type]}
                </span>
              </div>
              <h2 className="text-white font-bold text-lg leading-snug max-w-2xl">{project.title}</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(168,196,232,0.8)" }}>
                {[program?.title ?? "Stand-alone project", project.implementing_unit, project.campus].filter(Boolean).join(" · ")}
              </p>
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {[
              { label: "Total Project Cost", val: project.total_cost ? peso(Number(project.total_cost)) : "—", mono: true },
              { label: "Line-Item Budget", val: libTotal > 0 ? peso(libTotal) : "—", mono: true },
              { label: "Duration", val: duration ? `${duration} months` : "—" },
              { label: "Team Size", val: `${teamSize} member${teamSize !== 1 ? "s" : ""}` },
            ].map((k) => (
              <div key={k.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                <p className="text-xs" style={{ color: "rgba(168,196,232,0.6)" }}>{k.label}</p>
                <p className={`font-bold mt-0.5 text-sm ${k.mono ? "font-mono" : ""}`} style={{ color: "white" }}>{k.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {(
              [
                ["Physical Progress (deliverables)", phys, "#67e8f9"],
                ["Financial Utilization", fin, "#a78bfa"],
              ] as const
            ).map(([label, pct, color]) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(168,196,232,0.7)" }}>
                  <span>{label}</span>
                  <span className="font-mono">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-b overflow-x-auto" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
          <p className="text-xs font-mono mb-2" style={{ color: "#94a3b8" }}>Project Lifecycle — from Notice to Proceed</p>
          <LifecyclePipeline project={project} terminal={terminal} />
        </div>

        <div className="flex overflow-x-auto border-b" style={{ borderColor: "#e2e8f0" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2"
              style={{ borderBottomColor: tab === t.key ? "#0891b2" : "transparent", color: tab === t.key ? "#0891b2" : "#64748b" }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "overview" && (
            <div className="space-y-6">
              <div>
                <SectionHeader>Project Description</SectionHeader>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: project.description ? "#334155" : "#94a3b8" }}>
                  {project.description || "No description recorded yet."}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <InfoCard label="Project Leader / PI" value={project.lead_detail.email} />
                <InfoCard label="Funding Type" value={FUNDING_LABELS[project.funding_type]} />
                <InfoCard label="Cooperating Agencies" value={project.cooperating_agencies} />
                <InfoCard label="Research Program" value={program?.title ?? "Stand-alone"} />
                <InfoCard label="Project Period" value={`${project.start_date ?? "—"} – ${project.target_end_date ?? "—"}`} />
                <InfoCard label="REI Thrust" value={project.rei_thrust} />
              </div>
              <div>
                <SectionHeader>Specific Objectives</SectionHeader>
                <NumberedList items={lines(project.objectives)} empty="No objectives defined yet." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionHeader>Studies</SectionHeader>
                  {canRegister && (
                    <button onClick={() => setStudyDialogOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#0891b2" }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Add Study
                    </button>
                  )}
                </div>
                {studies.length === 0 ? (
                  <p className="text-sm" style={{ color: "#94a3b8" }}>
                    No studies yet. Every project needs at least one study for its technical/scholarly components.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {studies.map((s) => (
                      <div key={s.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#0d2a5e" }}>{s.title}</p>
                          <p className="text-xs" style={{ color: "#94a3b8" }}>Study Leader: {s.lead_detail.email}</p>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "registration" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <InfoCard label="Research Category" value={project.research_type ? RESEARCH_TYPE_LABELS[project.research_type] : ""} />
                <InfoCard label="Proposal Type" value={project.is_continuing ? "Continuing" : "New Proposal"} />
                <InfoCard
                  label="Sector"
                  value={project.sector === "others" ? project.sector_other : project.sector ? SECTOR_LABELS[project.sector] : ""}
                />
                <InfoCard label="Priority Area" value={project.research_priority_area ? PRIORITY_AREA_LABELS[project.research_priority_area] : ""} />
                <InfoCard label="Typology" value={project.research_typology.map((t) => TYPOLOGY_LABELS[t]).join(", ")} />
                <InfoCard label="Dry / Wet Research" value={project.is_dry_research ? "Dry research" : "Wet research"} />
                <InfoCard label="Total Project Cost" value={project.total_cost ? peso(Number(project.total_cost)) : ""} />
                <InfoCard label="Campus" value={project.campus} />
                <InfoCard label="Implementing Unit" value={project.implementing_unit} />
              </div>
              <div>
                <SectionHeader>Approval Information (read-only reference)</SectionHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <InfoCard label="NTP / Approval Reference No." value={project.ntp_number} />
                  <InfoCard label="NTP Date" value={project.ntp_date ?? ""} />
                  <InfoCard label="TOE Signed" value={project.toe_signed_date ?? ""} />
                  <InfoCard label="Proposal Submitted" value={project.proposal_submitted_on ?? ""} />
                  <InfoCard label="Proposal Reviewed" value={project.proposal_reviewed_on ?? ""} />
                  <InfoCard label="Proposal Approved" value={project.proposal_approved_on ?? ""} />
                  <InfoCard label="Reviewing / Approving Body" value={project.reviewing_body} />
                </div>
              </div>
              <div>
                <SectionHeader>Target Beneficiaries</SectionHeader>
                {lines(project.beneficiaries).length === 0 ? (
                  <p className="text-sm" style={{ color: "#94a3b8" }}>No beneficiaries recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {lines(project.beneficiaries).map((b, i) => (
                      <div key={i} className="rounded-xl p-3 flex items-start gap-3" style={{ background: "#faf5ff", border: "1px solid #e9d5ff" }}>
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "#7c3aed" }} />
                        <p className="text-xs" style={{ color: "#334155" }}>{b}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <SectionHeader>Sustainable Development Goals</SectionHeader>
                <div className="flex flex-wrap gap-1.5">
                  {project.sdgs.length === 0 ? (
                    <span className="text-sm" style={{ color: "#94a3b8" }}>—</span>
                  ) : (
                    project.sdgs.map((n) => (
                      <span key={n} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                        SDG {n} — {SDG_LABELS[n]}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "team" && (
            <div className="space-y-4">
              <SectionHeader>Project Team Members</SectionHeader>
              <div className="space-y-3">
                {[
                  { key: "lead", email: project.lead_detail.email, role: "Project Leader", sub: "Lead proponent", color: "#0d2a5e" },
                  ...team.map((a) => ({
                    key: String(a.id),
                    email: a.user_detail.email,
                    role: a.role_label || "Project Staff",
                    sub: [a.department, a.study ? studies.find((s) => s.id === a.study)?.title : null, `since ${a.start_date}`]
                      .filter(Boolean)
                      .join(" · "),
                    color: "#0891b2",
                  })),
                ].map((m) => (
                  <div key={m.key} className="rounded-xl p-4 flex items-start gap-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: m.color }}>
                      {m.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate" style={{ color: "#0d2a5e" }}>{m.email}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: m.color + "20", color: m.color }}>{m.role}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{m.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/staff")} className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#0891b2" }}>
                Manage assignments in Personnel Coordination →
              </button>
            </div>
          )}

          {tab === "workplan" && (
            <div className="space-y-6">
              <div>
                <SectionHeader>Gantt Timeline</SectionHeader>
                <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <GanttChart project={project} milestones={milestones} now={now} />
                </div>
              </div>
              <div>
                <SectionHeader>Milestones & Deliverables</SectionHeader>
                <div className="space-y-3">
                  {milestones.map((ms, idx) => {
                    const c = MILESTONE_COLORS[ms.status];
                    return (
                      <div
                        key={ms.id}
                        className="rounded-xl p-4"
                        style={{ background: "white", border: `1px solid ${ms.status === "in_progress" ? "#bae6fd" : "#e2e8f0"}` }}
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold font-mono" style={{ color: "#0891b2" }}>MS-{String(idx + 1).padStart(2, "0")}</span>
                          <span className="text-xs font-semibold" style={{ color: "#1e293b" }}>{ms.title}</span>
                          <span className="ml-auto">
                            {canManageMilestones ? (
                              <Select value={ms.status} onValueChange={(v) => handleMilestoneStatusChange(ms.id, v)} disabled={updatingMilestone === ms.id}>
                                <SelectTrigger className="h-7 w-36 rounded-full text-xs font-semibold border-0" style={{ background: c.bg, color: c.text }}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(MILESTONE_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: c.bg, color: c.text }}>
                                {MILESTONE_STATUS_LABELS[ms.status]}
                              </span>
                            )}
                          </span>
                        </div>
                        {ms.objective && <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>Objective: {ms.objective}</p>}
                        <div className="flex flex-wrap gap-4 mt-2 text-xs" style={{ color: "#94a3b8" }}>
                          <span>Start: <strong style={{ color: "#475569" }}>{ms.start_date ?? "—"}</strong></span>
                          <span>Due: <strong style={{ color: "#475569" }}>{ms.target_date}</strong></span>
                          <span>Responsible: <strong style={{ color: "#475569" }}>{ms.responsible_detail?.email ?? "—"}</strong></span>
                        </div>
                        {ms.deliverable && (
                          <div className="mt-2 p-2.5 rounded-lg text-xs" style={{ background: "#f0f9ff", color: "#0369a1" }}>
                            <span className="font-semibold">Deliverable: </span>
                            {ms.deliverable}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {milestones.length === 0 && <p className="text-sm" style={{ color: "#94a3b8" }}>No milestones yet.</p>}
                  {canManageMilestones && (
                    <button
                      onClick={() => setMilestoneDialogOpen(true)}
                      className="w-full py-3 rounded-xl border-2 border-dashed text-xs font-semibold hover:border-[#0891b2] hover:text-[#0891b2]"
                      style={{ borderColor: "#e2e8f0", color: "#94a3b8" }}
                    >
                      + Add Milestone
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "impact" && (
            <div className="space-y-4">
              <SectionHeader>Impact Framework — Theory of Change</SectionHeader>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {["Activities", "Outputs", "Outcomes", "Impacts"].map((label, i) => (
                  <div key={label} className="flex items-center gap-1 shrink-0">
                    <div className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: "#0d2a5e", color: "white" }}>{label}</div>
                    {i < 3 && (
                      <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                        <path d="M0 6h12M8 1l7 5-7 5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Target Beneficiaries", items: lines(project.beneficiaries), color: "#7c3aed", bg: "#faf5ff" },
                  {
                    title: "Expected Outputs (6Ps)",
                    items: (expected?.by_category ?? [])
                      .filter((c) => c.target > 0)
                      .map((c) => `${c.label}: ${c.actual}/${c.target}${c.met ? " ✓" : ""}`),
                    color: "#0891b2",
                    bg: "#f0f9ff",
                  },
                  {
                    title: "Anticipated Outcomes",
                    items: [...lines(project.expected_outcomes), ...recordedOutcomes.map((o) => `Recorded: ${o}`)],
                    color: "#059669",
                    bg: "#f0fdf4",
                  },
                  {
                    title: "Long-term Impacts",
                    items: [...lines(project.expected_impacts), ...recordedImpacts.map((o) => `Recorded: ${o}`)],
                    color: "#d97706",
                    bg: "#fffbeb",
                  },
                ].map((sec) => (
                  <div key={sec.title} className="rounded-xl p-4" style={{ background: sec.bg, border: `1px solid ${sec.color}20` }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: sec.color }}>{sec.title}</p>
                    {sec.items.length === 0 ? (
                      <p className="text-xs" style={{ color: "#94a3b8" }}>No actual data</p>
                    ) : (
                      <ul className="space-y-2">
                        {sec.items.map((item, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: "#334155" }}>
                            <span className="mt-0.5 shrink-0 font-bold" style={{ color: sec.color }}>{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-4">
              <SectionHeader>Registration & Project History</SectionHeader>
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-px" style={{ background: "#e2e8f0" }} />
                <ul className="space-y-4">
                  {[
                    ...(history ?? []).map((h) => ({
                      id: `h${h.id}`,
                      tag: `${PROJECT_STATUS_LABELS[h.from_status]} → ${PROJECT_STATUS_LABELS[h.to_status]}`,
                      title: PROJECT_STATUS_LABELS[h.to_status],
                      date: h.changed_at.slice(0, 10),
                      remarks: h.remarks,
                      actor: h.changed_by_email,
                    })),
                    {
                      id: "created",
                      tag: "Registered",
                      title: "Project registered in RMIS",
                      date: project.created_at.slice(0, 10),
                      remarks: project.ntp_number ? `NTP ${project.ntp_number}` : "",
                      actor: "",
                    },
                  ].map((entry, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <li key={entry.id} className="relative flex gap-4 pl-8">
                        <div
                          className="absolute left-0 w-7 h-7 rounded-full flex items-center justify-center border-2"
                          style={{ background: isFirst ? "#0d2a5e" : "white", borderColor: isFirst ? "#0d2a5e" : "#e2e8f0" }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ background: isFirst ? "white" : "#cbd5e1" }} />
                        </div>
                        <div
                          className="flex-1 rounded-xl p-4"
                          style={{ background: isFirst ? "#f0f9ff" : "#f8fafc", border: `1px solid ${isFirst ? "#bae6fd" : "#e2e8f0"}` }}
                        >
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <span
                                className="inline-block text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                                style={{ background: isFirst ? "#0d2a5e" : "#e2e8f0", color: isFirst ? "white" : "#475569" }}
                              >
                                {entry.tag}
                              </span>
                              <p className="text-sm font-semibold mt-1" style={{ color: "#1e293b" }}>{entry.title}</p>
                            </div>
                            <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>{entry.date}</p>
                          </div>
                          {entry.remarks && <p className="text-xs mt-2 leading-relaxed" style={{ color: "#64748b" }}>{entry.remarks}</p>}
                          {entry.actor && <p className="text-xs mt-1 font-medium" style={{ color: "#0891b2" }}>by {entry.actor}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {tab === "closure" && (
            <div className="space-y-5">
              <SectionHeader>Project Completion & Closure</SectionHeader>
              {project.status === "archived" && (
                <div className="rounded-xl p-4" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="18" height="18" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <p className="font-bold text-sm" style={{ color: "#166534" }}>Project Officially Closed</p>
                  </div>
                  <p className="text-xs" style={{ color: "#166534" }}>
                    {history?.find((h) => h.to_status === "archived")?.remarks || "No closure remarks recorded."}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard label="Current Status" value={PROJECT_STATUS_LABELS[project.status]} />
                <InfoCard
                  label="Terminal Report"
                  value={terminal === undefined ? "…" : !terminal ? "Not submitted" : terminal.is_certified ? "Certified" : "Submitted, not certified"}
                />
                <InfoCard label="Deliverables" value={phys === null ? "—" : `${Math.round(phys)}%`} />
                <InfoCard label="Budget Utilization" value={fin === null ? "—" : `${Math.round(fin)}%`} />
              </div>
              {canRegister ? (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>Change Project Status</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label required>New Status</Label>
                      <select
                        value={closureStatus}
                        onChange={(e) => setClosureStatus(e.target.value as RecordStatus | "")}
                        className={INPUT}
                        style={INPUT_STYLE}
                      >
                        <option value="">Select…</option>
                        {(["active", "completed", "archived"] as const)
                          .filter((s) => s !== project.status)
                          .map((s) => (
                            <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                          ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Remarks</Label>
                      <input
                        value={closureRemarks}
                        onChange={(e) => setClosureRemarks(e.target.value)}
                        placeholder="Recorded in the project history"
                        className={INPUT}
                        style={INPUT_STYLE}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleClosure}
                    disabled={isClosing}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#0d2a5e" }}
                  >
                    {isClosing ? "Saving…" : "Save Status Change"}
                  </button>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "#94a3b8" }}>Only the System Admin or CRC Chairperson can close a project.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={studyDialogOpen} onOpenChange={setStudyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "#0d2a5e" }}>Add a Study</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label required>Title</Label>
              <input
                aria-invalid={attemptedStudy && !studyForm.title.trim()}
                value={studyForm.title}
                onChange={(e) => setStudyForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Study title"
                className={INPUT}
                style={{ ...INPUT_STYLE, borderColor: attemptedStudy && !studyForm.title.trim() ? "#dc2626" : "#e2e8f0" }}
              />
            </div>
            <div>
              <Label required>Study Leader</Label>
              <Select value={studyForm.lead} onValueChange={(v) => setStudyForm((s) => ({ ...s, lead: v }))}>
                <SelectTrigger className="w-full rounded-xl" aria-invalid={attemptedStudy && !studyForm.lead}>
                  <SelectValue placeholder="Select leader" />
                </SelectTrigger>
                <SelectContent>
                  {studyLeaders.length === 0 && <EmptyOption message="No active study leaders yet" />}
                  {studyLeaders.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={handleCreateStudy}
              disabled={isCreatingStudy}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#0d2a5e" }}
            >
              {isCreatingStudy ? "Adding…" : "Add Study"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "#0d2a5e" }}>Add a Work Plan Milestone</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label required>Title</Label>
              <input
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, title: e.target.value }))}
                placeholder="Milestone title"
                className={INPUT}
                style={{ ...INPUT_STYLE, borderColor: attemptedMilestone && !milestoneForm.title.trim() ? "#dc2626" : "#e2e8f0" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <input
                  type="date"
                  value={milestoneForm.start_date}
                  onChange={(e) => setMilestoneForm((m) => ({ ...m, start_date: e.target.value }))}
                  className={INPUT}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <Label required>Target Date</Label>
                <input
                  type="date"
                  value={milestoneForm.target_date}
                  onChange={(e) => setMilestoneForm((m) => ({ ...m, target_date: e.target.value }))}
                  className={INPUT}
                  style={{ ...INPUT_STYLE, borderColor: attemptedMilestone && !milestoneForm.target_date ? "#dc2626" : "#e2e8f0" }}
                />
              </div>
            </div>
            <div>
              <Label>Objective</Label>
              <input
                value={milestoneForm.objective}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, objective: e.target.value }))}
                placeholder="Which project objective this serves"
                className={INPUT}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <Label>Deliverable</Label>
              <input
                value={milestoneForm.deliverable}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, deliverable: e.target.value }))}
                placeholder="What is produced when this is done"
                className={INPUT}
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={handleCreateMilestone}
              disabled={isCreatingMilestone}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#0d2a5e" }}
            >
              {isCreatingMilestone ? "Adding…" : "Add Milestone"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Project Management">
        <ProjectDetailContent />
      </AppShell>
    </ProtectedRoute>
  );
}
