import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { personnelApi } from "../lib/personnelApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE } from "../lib/projectStatus";
import { WORK_PLAN_VERSIONS } from "../mocks/workPlan";
import type { Milestone, MilestoneStatus, Project } from "../types/research";
import type { ProjectAssignment } from "../types/personnel";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type WPTab = "gantt" | "activities" | "deliverables" | "versions";

const MILESTONE_ROLE_CODES = ["system_admin", "crc_chair", "program_leader", "project_leader", "study_leader"];

const STATUS_META: Record<MilestoneStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: "Not Started", bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  in_progress: { label: "In Progress", bg: "#e0f2fe", text: "#0369a1", dot: "#0891b2" },
  done: { label: "Completed", bg: "#d1fae5", text: "#166534", dot: "#059669" },
  delayed: { label: "Delayed", bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

const DAY = 86400000;

function daysLate(m: Milestone, now: number) {
  if (m.status === "done") return 0;
  const d = Math.floor((now - new Date(m.target_date).getTime()) / DAY);
  return d > 0 ? d : 0;
}

function summarize(ms: Milestone[], now: number) {
  const total = ms.length;
  const done = ms.filter((m) => m.status === "done").length;
  const late = ms.filter((m) => m.status === "delayed" || daysLate(m, now) > 0).length;
  const due = ms.filter((m) => new Date(m.target_date).getTime() <= now).length;
  const planned = total ? Math.round((due / total) * 100) : 0;
  const actual = total ? Math.round((done / total) * 100) : 0;
  return { total, done, late, planned, actual };
}

function ProgressBar({ planned, actual, height = 6 }: { planned: number; actual: number; height?: number }) {
  return (
    <div className="space-y-1">
      <div className="relative rounded-full overflow-hidden" style={{ height, background: "#f1f5f9" }}>
        <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${planned}%`, background: "#0d2a5e" }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${actual}%`, background: actual >= planned ? "#059669" : "#0891b2" }} />
      </div>
      <div className="flex justify-between text-xs" style={{ color: "#94a3b8" }}>
        <span>Planned: <strong style={{ color: "#0d2a5e" }}>{planned}%</strong></span>
        <span>Actual: <strong style={{ color: actual >= planned ? "#059669" : "#0891b2" }}>{actual}%</strong></span>
      </div>
    </div>
  );
}

function LatePill({ days }: { days: number }) {
  if (days === 0) return <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#f1f5f9", color: "#64748b" }}>—</span>;
  return (
    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "#fee2e2", color: "#991b1b" }}>
      {days}d late
    </span>
  );
}

function StatusDot({ status }: { status: MilestoneStatus }) {
  const sm = STATUS_META[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sm.dot }} />
      <span className="text-xs font-semibold" style={{ color: sm.text }}>{sm.label}</span>
    </div>
  );
}

function Gantt({ milestones, project, now }: { milestones: Milestone[]; project: Project; now: number }) {
  if (milestones.length === 0) return <p className="text-sm py-4 text-center" style={{ color: "#94a3b8" }}>No activities defined yet.</p>;
  const dates = milestones.flatMap((m) => [m.start_date, m.target_date]).filter(Boolean).sort() as string[];
  const start = new Date(project.start_date ?? dates[0]).getTime();
  const end = new Date(project.target_end_date ?? dates[dates.length - 1]).getTime();
  const total = Math.max(1, end - start);
  const toPct = (d: string) => Math.max(0, Math.min(100, ((new Date(d).getTime() - start) / total) * 100));
  const todayPct = Math.max(0, Math.min(100, ((now - start) / total) * 100));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="flex text-xs mb-2">
          <div className="shrink-0 font-bold uppercase tracking-wide" style={{ width: "220px", color: "#94a3b8" }}>Activity</div>
          <div className="shrink-0 text-center font-mono" style={{ width: "110px", color: "#94a3b8" }}>Responsible</div>
          <div className="flex-1 relative h-5">
            {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
              <span key={q} className="absolute font-semibold" style={{ left: `${i * 25}%`, transform: "translateX(-50%)", color: "#94a3b8" }}>{q}</span>
            ))}
            <span className="absolute font-bold" style={{ left: `${todayPct}%`, transform: "translateX(-50%)", color: "#ef4444", top: 0, fontSize: "9px" }}>▼</span>
          </div>
          <div className="shrink-0 text-center font-bold uppercase tracking-wide" style={{ width: "80px", color: "#94a3b8" }}>Variance</div>
        </div>
        {milestones.map((m, i) => {
          const left = toPct(m.start_date ?? m.target_date);
          const width = Math.max(0.5, toPct(m.target_date) - left);
          const sc = STATUS_META[m.status].dot;
          return (
            <div key={m.id} className="flex items-center mb-2">
              <div className="shrink-0 pr-2" style={{ width: "220px" }}>
                <p className="text-xs font-semibold truncate" style={{ color: "#334155" }}>{i + 1}. {m.title}</p>
              </div>
              <div className="shrink-0 text-center px-1 truncate" style={{ width: "110px" }}>
                <p className="text-xs truncate" style={{ color: "#64748b" }}>{m.responsible_detail?.email.split("@")[0] ?? "—"}</p>
              </div>
              <div className="flex-1 relative" style={{ height: "28px" }}>
                <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${todayPct}%`, background: "#ef4444", opacity: 0.5 }} />
                <div className="absolute rounded" style={{ top: "4px", bottom: "4px", left: `${left}%`, width: `${width}%`, border: `1.5px solid ${sc}`, background: sc + "18" }} />
                {m.status === "done" && (
                  <div className="absolute rounded" style={{ top: "8px", bottom: "8px", left: `${left}%`, width: `${width}%`, background: sc }} />
                )}
              </div>
              <div className="shrink-0 flex justify-center" style={{ width: "80px" }}>
                <LatePill days={daysLate(m, now)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FormState {
  title: string;
  start_date: string;
  target_date: string;
  objective: string;
  deliverable: string;
  responsible: string;
}

const EMPTY_FORM: FormState = { title: "", start_date: "", target_date: "", objective: "", deliverable: "", responsible: "" };

function WorkPlanDetail({
  project,
  canEdit,
  now,
  onBack,
}: {
  project: Project;
  canEdit: boolean;
  now: number;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<WPTab>("gantt");
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [delayed, setDelayed] = useState<Milestone[] | null>(null);
  const [team, setTeam] = useState<ProjectAssignment[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let active = true;
    researchApi
      .getMilestones(project.id)
      .then((m) => active && setMilestones(m))
      .catch(() => active && setMilestones([]));
    personnelApi
      .getAssignments({ project: project.id, active: true })
      .then((a) => active && setTeam(a))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id, reloadKey]);

  useEffect(() => {
    if (!delayedOnly) return;
    let active = true;
    researchApi
      .getMilestones(project.id, { delayed: true })
      .then((m) => active && setDelayed(m))
      .catch(() => active && setDelayed([]));
    return () => {
      active = false;
    };
  }, [delayedOnly, project.id, reloadKey]);

  const sorted = useMemo(
    () => [...(milestones ?? [])].sort((a, b) => (a.start_date ?? a.target_date).localeCompare(b.start_date ?? b.target_date)),
    [milestones],
  );
  const seqOf = (id: number) => sorted.findIndex((m) => m.id === id) + 1;
  const s = summarize(sorted, now);
  const people = [project.lead_detail, ...team.map((a) => a.user_detail)].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  const activityRows = delayedOnly ? [...(delayed ?? [])].sort((a, b) => seqOf(a.id) - seqOf(b.id)) : sorted;
  const deliverables = sorted.filter((m) => m.deliverable.trim());

  const openEdit = (m: Milestone | "new") => {
    setAttempted(false);
    setForm(
      m === "new"
        ? EMPTY_FORM
        : {
            title: m.title,
            start_date: m.start_date ?? "",
            target_date: m.target_date,
            objective: m.objective,
            deliverable: m.deliverable,
            responsible: m.responsible ? String(m.responsible) : "",
          },
    );
    setEditing(m);
  };

  const save = async () => {
    setAttempted(true);
    if (!form.title.trim() || !form.target_date) {
      notify.error("Activity title and target date are required.");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      target_date: form.target_date,
      start_date: form.start_date || null,
      objective: form.objective,
      deliverable: form.deliverable,
      responsible: form.responsible ? Number(form.responsible) : null,
    };
    try {
      if (editing === "new") {
        await researchApi.createMilestone({ project: project.id, ...payload, start_date: payload.start_date ?? undefined });
        notify.success("Activity added.");
      } else if (editing) {
        await researchApi.updateMilestone(editing.id, payload);
        notify.success("Activity updated.");
      }
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not save the activity."));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (m: Milestone, status: string) => {
    setUpdating(m.id);
    try {
      await researchApi.updateMilestone(m.id, { status });
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the status."));
    } finally {
      setUpdating(null);
    }
  };

  const tabs: { key: WPTab; label: string }[] = [
    { key: "gantt", label: "Gantt Chart" },
    { key: "activities", label: "Activities" },
    { key: "deliverables", label: "Deliverables" },
    { key: "versions", label: "Version History" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Work Plans
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-mono font-semibold" style={{ color: "#64748b" }}>{project.project_code}</span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.15)", color: "#67e8f9" }}>
                  {project.project_code}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: PROJECT_STATUS_STYLE[project.status].bg, color: PROJECT_STATUS_STYLE[project.status].text }}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </div>
              <p className="text-white font-black text-lg leading-snug max-w-2xl">{project.title}</p>
              <p className="text-sm mt-1" style={{ color: "rgba(168,196,232,0.7)" }}>
                {[project.implementing_unit, project.start_date && `${project.start_date} – ${project.target_end_date ?? "—"}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => openEdit("new")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Activity
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              { label: "Activities", val: String(s.total) },
              { label: "Completed", val: String(s.done) },
              { label: "Delayed / Overdue", val: String(s.late) },
              { label: "Planned (due by today)", val: `${s.planned}%` },
              { label: "Actual (completed)", val: `${s.actual}%` },
            ].map((k) => (
              <div key={k.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                <p className="text-xs" style={{ color: "rgba(168,196,232,0.6)" }}>{k.label}</p>
                <p className="font-black text-lg mt-0.5 font-mono" style={{ color: "white" }}>{milestones === null ? "…" : k.val}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(168,196,232,0.7)" }}>
              <span>Overall Work Plan Progress</span>
              <span className="font-mono">Planned {s.planned}% · Actual {s.actual}%</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
              <div className="absolute inset-y-0 left-0 rounded-full opacity-40" style={{ width: `${s.planned}%`, background: "#67e8f9" }} />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.actual}%`, background: s.actual >= s.planned ? "#4ade80" : "#67e8f9" }} />
            </div>
          </div>
        </div>

        <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all"
              style={{ borderBottomColor: tab === t.key ? "#0891b2" : "transparent", color: tab === t.key ? "#0891b2" : "#64748b" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {milestones === null ? (
            <div className="h-40 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
          ) : (
            <>
              {tab === "gantt" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Activity Gantt Chart</p>
                    <div className="flex items-center gap-3 ml-auto text-xs">
                      {[
                        { color: "rgba(0,0,0,0.15)", label: "Planned (outline)" },
                        { color: "#059669", label: "Completed" },
                        { color: "#ef4444", label: "Today" },
                      ].map((l) => (
                        <div key={l.label} className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ background: l.color, border: `1.5px solid ${l.color}` }} />
                          <span style={{ color: "#94a3b8" }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <Gantt milestones={sorted} project={project} now={now} />
                  </div>
                </div>
              )}

              {tab === "activities" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Activities & Milestones</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDelayedOnly((v) => !v)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={delayedOnly ? { background: "#fee2e2", color: "#991b1b" } : { background: "#f1f5f9", color: "#64748b" }}
                      >
                        {delayedOnly ? "Showing delayed only" : "Show delayed only"}
                      </button>
                      {canEdit && (
                        <button onClick={() => openEdit("new")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                          + Add Activity
                        </button>
                      )}
                    </div>
                  </div>
                  {activityRows.length === 0 ? (
                    <NoActualData message={delayedOnly ? "No delayed activities" : "No actual data"} hint={canEdit && !delayedOnly ? 'Click "Add Activity" to capture the inception work plan.' : undefined} />
                  ) : (
                    <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                      <table className="w-full">
                        <thead>
                          <tr style={{ background: "#f0f4f8" }}>
                            {["ID", "Activity / Milestone", "Planned Dates", "Responsible", "Status", "Variance", "Actions"].map((h) => (
                              <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activityRows.map((m) => (
                            <ActivityRow
                              key={m.id}
                              m={m}
                              seq={seqOf(m.id)}
                              now={now}
                              expanded={expanded === m.id}
                              onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
                              canEdit={canEdit}
                              updating={updating === m.id}
                              onEdit={() => openEdit(m)}
                              onStatus={(st) => changeStatus(m, st)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === "deliverables" && (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Project Deliverables Register</p>
                  {deliverables.length === 0 ? (
                    <NoActualData hint="Deliverables are recorded on each activity." />
                  ) : (
                    <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: "#f0f4f8" }}>
                            {["#", "Deliverable", "Source Activity", "Responsible", "Due", "Activity Status"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {deliverables.map((m, i) => (
                            <tr key={m.id} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                              <td className="px-4 py-2.5 text-xs font-mono font-bold" style={{ color: "#94a3b8" }}>{String(i + 1).padStart(2, "0")}</td>
                              <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#1e293b" }}>{m.deliverable}</td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                                  A-{String(seqOf(m.id)).padStart(2, "0")}
                                </span>
                                <span className="text-xs ml-2" style={{ color: "#64748b" }}>{m.title.length > 40 ? `${m.title.slice(0, 40)}…` : m.title}</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs" style={{ color: "#475569" }}>{m.responsible_detail?.email ?? "—"}</td>
                              <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#475569" }}>{m.target_date}</td>
                              <td className="px-4 py-2.5"><StatusDot status={m.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-4 py-2 text-xs" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", color: "#94a3b8" }}>
                        {deliverables.length} deliverable{deliverables.length !== 1 ? "s" : ""} across {sorted.length} activities
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "versions" && (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Work Plan Version History</p>
                  {sorted.length === 0 ? (
                    <NoActualData hint="Versions start once the inception work plan has activities." />
                  ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: "#e2e8f0" }} />
                    <div className="space-y-4">
                      {[...WORK_PLAN_VERSIONS].reverse().map((v, idx) => {
                        const isFirst = idx === 0;
                        const cc =
                          v.changeType === "initial"
                            ? { bg: "#e0eaf7", text: "#0d2a5e" }
                            : v.changeType === "revision"
                              ? { bg: "#faf5ff", text: "#7c3aed" }
                              : { bg: "#fef3c7", text: "#92400e" };
                        return (
                          <div key={v.version} className="relative flex gap-5 pl-10">
                            <div
                              className="absolute left-0.5 w-7 h-7 rounded-full flex items-center justify-center border-2 font-black text-xs"
                              style={{ background: isFirst ? "#0d2a5e" : "white", borderColor: isFirst ? "#0d2a5e" : "#e2e8f0", color: isFirst ? "white" : "#94a3b8" }}
                            >
                              {v.version}
                            </div>
                            <div className="flex-1 rounded-xl p-4" style={{ background: isFirst ? "#f0f9ff" : "#f8fafc", border: `1px solid ${isFirst ? "#bae6fd" : "#e2e8f0"}` }}>
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm" style={{ color: "#0d2a5e" }}>v{v.version}</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cc.bg, color: cc.text }}>
                                    {v.changeType.charAt(0).toUpperCase() + v.changeType.slice(1)}
                                  </span>
                                  <span
                                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={v.status === "approved" ? { background: "#d1fae5", color: "#166534" } : { background: "#fef3c7", color: "#92400e" }}
                                  >
                                    {v.status === "approved" ? "Approved" : "Submitted"}
                                  </span>
                                </div>
                                <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>{v.createdAt}</p>
                              </div>
                              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#334155" }}>{v.revisionRemarks}</p>
                              <div className="flex flex-wrap gap-4 mt-2 text-xs" style={{ color: "#94a3b8" }}>
                                <span>Submitted by: <strong style={{ color: "#475569" }}>{v.revisedBy}</strong></span>
                                {v.approvedAt && (
                                  <span>
                                    Approved: <strong style={{ color: "#059669" }}>{v.approvedAt}</strong> by {v.approvedBy}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "#0d2a5e" }}>{editing === "new" ? "Add Activity" : "Edit Activity"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="label-field">Activity / Milestone Title <span style={{ color: "#dc2626" }}>*</span></label>
              <input className={inputCls} style={{ ...inputSt, borderColor: attempted && !form.title.trim() ? "#dc2626" : "#e2e8f0" }} value={form.title} onChange={set("title")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Planned Start</label>
                <input type="date" className={inputCls} style={inputSt} value={form.start_date} onChange={set("start_date")} />
              </div>
              <div>
                <label className="label-field">Planned End <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  type="date"
                  className={inputCls}
                  style={{ ...inputSt, borderColor: attempted && !form.target_date ? "#dc2626" : "#e2e8f0" }}
                  value={form.target_date}
                  onChange={set("target_date")}
                />
              </div>
            </div>
            <div>
              <label className="label-field">Responsible Personnel</label>
              <select className={inputCls} style={inputSt} value={form.responsible} onChange={set("responsible")}>
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Linked Objective</label>
              <input className={inputCls} style={inputSt} value={form.objective} onChange={set("objective")} placeholder="Which project objective this serves" />
            </div>
            <div>
              <label className="label-field">Deliverable</label>
              <input className={inputCls} style={inputSt} value={form.deliverable} onChange={set("deliverable")} placeholder="What is produced when this is done" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
              {saving ? "Saving…" : "Save Activity"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityRow({
  m,
  seq,
  now,
  expanded,
  onToggle,
  canEdit,
  updating,
  onEdit,
  onStatus,
}: {
  m: Milestone;
  seq: number;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  updating: boolean;
  onEdit: () => void;
  onStatus: (s: string) => void;
}) {
  return (
    <>
      <tr className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={onToggle}>
        <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color: "#94a3b8" }}>A-{String(seq).padStart(2, "0")}</td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <svg className="shrink-0 transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} width="10" height="10" fill="none" stroke="#94a3b8" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" />
            </svg>
            <p className="text-xs font-semibold" style={{ color: "#0d2a5e" }}>{m.title}</p>
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: "#64748b" }}>
          <p>{m.start_date ?? "—"}</p>
          <p style={{ color: "#94a3b8" }}>→ {m.target_date}</p>
        </td>
        <td className="px-3 py-2.5 text-xs" style={{ color: "#475569" }}>{m.responsible_detail?.email ?? "—"}</td>
        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          {canEdit ? (
            <select
              value={m.status}
              disabled={updating}
              onChange={(e) => onStatus(e.target.value)}
              className="text-xs font-semibold rounded-full px-2 py-1 border-0 outline-none"
              style={{ background: STATUS_META[m.status].bg, color: STATUS_META[m.status].text }}
            >
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          ) : (
            <StatusDot status={m.status} />
          )}
        </td>
        <td className="px-3 py-2.5"><LatePill days={daysLate(m, now)} /></td>
        <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <button onClick={onEdit} className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: "#f1f5f9", color: "#64748b" }}>
              Edit
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: "#f8fafc" }}>
          <td />
          <td colSpan={6} className="px-3 py-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Linked Objective</p>
                <p style={{ color: "#334155" }}>{m.objective || "—"}</p>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Deliverable</p>
                <p style={{ color: "#334155" }}>{m.deliverable || "—"}</p>
              </div>
              <div>
                {m.remarks ? (
                  <div className="p-2 rounded-lg" style={{ background: "#fef3c7" }}>
                    <p className="font-bold uppercase tracking-wide mb-0.5" style={{ color: "#92400e" }}>Remarks</p>
                    <p style={{ color: "#78350f" }}>{m.remarks}</p>
                  </div>
                ) : (
                  <p style={{ color: "#94a3b8" }}>No remarks.</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function WorkPlanContent() {
  const { user } = useAuth();
  const canEdit = MILESTONE_ROLE_CODES.includes(user?.role?.code ?? "");
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    researchApi
      .getProjects()
      .then((p) => active && setProjects(p))
      .catch(() => {
        if (!active) return;
        setProjects([]);
        notify.error("Could not load projects. Check your connection and refresh.");
      });
    researchApi
      .getMilestones()
      .then((m) => active && setMilestones(m))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const selectedId = Number(params.get("project"));
  const selected = projects?.find((p) => p.id === selectedId);
  if (selected) {
    return <WorkPlanDetail project={selected} canEdit={canEdit} now={now} onBack={() => setParams({})} />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="font-black text-lg" style={{ color: "#0d2a5e" }}>Project Work Plans</p>
        <p className="text-xs" style={{ color: "#94a3b8" }}>
          {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="space-y-3">
        {projects === null ? (
          [0, 1].map((i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "white", border: "1px solid #e2e8f0" }} />)
        ) : projects.length === 0 ? (
          <NoActualData />
        ) : (
          projects.map((proj) => {
            const ms = milestones.filter((m) => m.project === proj.id);
            const s = summarize(ms, now);
            const hasWP = ms.length > 0;
            return (
              <div
                key={proj.id}
                onClick={() => setParams({ project: String(proj.id) })}
                className="rounded-2xl p-5 transition-all hover:shadow-lg cursor-pointer hover:border-[#0891b2] hover:-translate-y-px"
                style={{ background: "white", border: `1px solid ${hasWP ? "#e2e8f0" : "#fde68a"}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0369a1" }}>{proj.project_code}</span>
                      {hasWP ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#d1fae5", color: "#166534" }}>
                          {s.total} activit{s.total === 1 ? "y" : "ies"}
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>⚠ No Work Plan yet</span>
                      )}
                      {s.late > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#991b1b" }}>{s.late} delayed</span>
                      )}
                    </div>
                    <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{proj.title}</p>
                    <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                      PI: {proj.lead_detail.email}
                      {proj.implementing_unit ? ` · ${proj.implementing_unit}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {hasWP ? (
                      <>
                        <p className="text-2xl font-black font-mono" style={{ color: s.actual >= s.planned ? "#059669" : "#0891b2" }}>{s.actual}%</p>
                        <p className="text-xs" style={{ color: "#94a3b8" }}>completed</p>
                      </>
                    ) : canEdit ? (
                      <span className="px-3 py-2 rounded-xl text-xs font-bold text-white inline-block" style={{ background: "#0d2a5e" }}>
                        + Create Work Plan
                      </span>
                    ) : null}
                  </div>
                </div>
                {hasWP && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-xs">
                      <p style={{ color: "#94a3b8" }}>Activities</p>
                      <p className="font-bold text-base" style={{ color: "#0d2a5e" }}>
                        {s.done}/{s.total} <span className="text-xs font-normal" style={{ color: "#94a3b8" }}>done</span>
                      </p>
                    </div>
                    <div className="text-xs">
                      <p style={{ color: "#94a3b8" }}>Deliverables</p>
                      <p className="font-bold text-base" style={{ color: "#0d2a5e" }}>{ms.filter((m) => m.deliverable.trim()).length}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs mb-1" style={{ color: "#94a3b8" }}>Progress</p>
                      <ProgressBar planned={s.planned} actual={s.actual} height={8} />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function WorkPlanPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Work Plan">
        <WorkPlanContent />
      </AppShell>
    </ProtectedRoute>
  );
}
