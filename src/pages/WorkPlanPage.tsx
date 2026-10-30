import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { personnelApi } from "../lib/personnelApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE } from "../lib/projectStatus";
import type { Lead, Milestone, MilestoneStatus, Project, ProjectTeamMember } from "../types/research";
import type { ProjectAssignment, Task } from "../types/personnel";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../context/AuthContext";
import { TASK_EVENTS, useRealtime } from "../hooks/useRealtime";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LatePill } from "../components/workplan/ActivityGantt";
import { STATUS_META, activityTaskCompletion, daysLate, nameOf } from "../lib/workplan";
import { plannedHoursLabel, workingDays } from "../lib/taskHours";
import { personName } from "../lib/roles";
import { registrationOpen, workAllowed } from "../lib/projectReview";

const ICON = "inline-block h-[1em] w-[1em] align-[-0.125em]";

type WPTab = "milestones" | "activities" | "deliverables";

const MILESTONE_ROLE_CODES = ["system_admin", "crc_chair", "project_leader"];

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

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

const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  delayed: "Delayed",
};

const MILESTONE_COLORS: Record<MilestoneStatus, { bar: string; bg: string; text: string }> = {
  done: { bar: "#16a34a", bg: "#dcfce7", text: "#166534" },
  in_progress: { bar: "#0891b2", bg: "#e0f2fe", text: "#164e63" },
  pending: { bar: "#cbd5e1", bg: "#f1f5f9", text: "#64748b" },
  delayed: { bar: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
};

function MilestonesDeliverables({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Milestones & Deliverables</p>
      <div className="space-y-3">
        {milestones.map((ms, idx) => {
          const c = MILESTONE_COLORS[ms.status];
          const barColor = ms.progress_pct === 100 ? "#059669" : ms.status === "pending" ? "#0891b2" : c.bar;
          return (
            <div
              key={ms.id}
              className="rounded-xl p-4"
              style={{ background: "white", border: `1px solid ${ms.status === "in_progress" ? "#bae6fd" : "#e2e8f0"}` }}
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-bold font-mono" style={{ color: "#0891b2" }}>MS-{String(idx + 1).padStart(2, "0")}</span>
                <span className="text-xs font-semibold" style={{ color: "#1e293b" }}>{ms.title}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: c.bg, color: c.text }}>
                  {MILESTONE_STATUS_LABELS[ms.status]}
                </span>
              </div>
              {ms.objective && <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>Objective: {ms.objective}</p>}
              <div className="flex flex-wrap gap-4 mt-2 text-xs" style={{ color: "#94a3b8" }}>
                <span>Start: <strong style={{ color: "#475569" }}>{ms.start_date ?? "—"}</strong></span>
                <span>Due: <strong style={{ color: "#475569" }}>{ms.target_date}</strong></span>
                <span>Responsible: <strong style={{ color: "#475569" }}>{ms.responsible_detail ? personName(ms.responsible_detail) : "—"}</strong></span>
              </div>
              {ms.deliverable && (
                <div className="mt-2 p-2.5 rounded-lg text-xs" style={{ background: "#f0f9ff", color: "#0369a1" }}>
                  <span className="font-semibold">Deliverable: </span>
                  {ms.deliverable}
                </div>
              )}
              {(ms.tasks_total > 0 || ms.status !== "pending") && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
                    <div className="h-full rounded-full" style={{ width: `${ms.progress_pct}%`, background: barColor }} />
                  </div>
                  <span className="text-xs font-mono font-bold whitespace-nowrap" style={{ color: barColor }}>
                    {ms.tasks_total > 0 && `${ms.tasks_done}/${ms.tasks_total} tasks · `}
                    {ms.progress_pct}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {milestones.length === 0 && <p className="text-sm" style={{ color: "#94a3b8" }}>No milestones yet.</p>}
      </div>
    </div>
  );
}

interface TeamRow {
  key: string;
  name: string;
  role: string;
  user: number | null;
}

function TeamTaskCompletion({ rows, tasks }: { rows: TeamRow[]; tasks: Task[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Team Task Completion</p>
        <p className="text-xs mt-1" style={{ color: "#64748b" }}>Share of tasks done on the activities assigned to each Co-Project Leader and Project Staff.</p>
      </div>
      {rows.length === 0 ? (
        <NoActualData hint="No Co-Project Leaders or Project Staff on this project yet." />
      ) : (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          {rows.map((r) => {
            const { done, total, pct } = r.user === null ? { done: 0, total: 0, pct: 0 } : activityTaskCompletion(tasks, r.user);
            const detail = r.user === null ? "No system account" : total ? `${done} of ${total} task${total !== 1 ? "s" : ""} done` : "No tasks assigned";
            return (
              <div key={r.key} className="flex items-center gap-3" title={`${r.name}: ${detail}`}>
                <div className="shrink-0" style={{ width: "200px" }}>
                  <p className="text-xs font-semibold truncate" style={{ color: "#334155" }}>{r.name}</p>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>{r.role}</p>
                </div>
                <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: "#e2e8f0" }}>
                  <div className="h-full rounded" style={{ width: `${pct}%`, background: "#0891b2" }} />
                </div>
                <div className="shrink-0 text-right" style={{ width: "130px" }}>
                  <p className="text-xs font-mono font-bold" style={{ color: "#1e293b" }}>{total ? `${pct}%` : "—"}</p>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>{detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const { user } = useAuth();
  const roleCode = user?.role?.code ?? "";
  const canEditPlan = canEdit && registrationOpen(project.review_status);
  const canAddTask = canEdit && workAllowed(project.review_status);
  const [tab, setTab] = useState<WPTab>("milestones");
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [delayed, setDelayed] = useState<Milestone[] | null>(null);
  const [team, setTeam] = useState<ProjectAssignment[]>([]);
  const [teamRows, setTeamRows] = useState<ProjectTeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  useRealtime(TASK_EVENTS, (msg) => {
    if (!msg.project || msg.project === project.id) setReloadKey((k) => k + 1);
  });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
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
    researchApi
      .getTeamMembers(project.id)
      .then((t) => active && setTeamRows(t))
      .catch(() => undefined);
    personnelApi
      .getTasks({ project: project.id })
      .then((t) => active && setTasks(t))
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
  // Responsible Personnel (#13): project lead, team members registered with an account, and assigned staff.
  const people: Lead[] = [
    project.lead_detail,
    ...teamRows.filter((t) => t.user !== null).map((t) => ({ id: t.user as number, email: "", full_name: t.name })),
    ...team.map((a) => a.user_detail),
  ].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  const activityRows = delayedOnly ? [...(delayed ?? [])].sort((a, b) => seqOf(a.id) - seqOf(b.id)) : sorted;
  const completionRows: TeamRow[] = [
    ...teamRows.filter((t) => t.member_role === "co_leader").map((t) => ({ key: `t${t.id}`, name: t.name, role: "Co-Project Leader", user: t.user })),
    ...teamRows.filter((t) => t.member_role === "member").map((t) => ({ key: `t${t.id}`, name: t.name, role: "Project Staff", user: t.user })),
    ...team.map((a) => ({ key: `a${a.id}`, name: nameOf(a.user_detail), role: "Project Staff", user: a.user })),
  ]
    .filter((r, i, arr) => r.user === null || arr.findIndex((x) => x.user === r.user) === i)
    .filter((r) => roleCode !== "project_staff" || r.user === user?.pk);

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

  const tabs: { key: WPTab; label: string }[] = [
    { key: "milestones", label: "Milestones & Deliverables" },
    { key: "activities", label: "Activities" },
    { key: "deliverables", label: "Deliverables" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
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
              {tab === "milestones" && <MilestonesDeliverables milestones={milestones} />}

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
                      {canEditPlan && (
                        <button onClick={() => openEdit("new")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                          + Add Activity
                        </button>
                      )}
                    </div>
                  </div>
                  {activityRows.length === 0 ? (
                    <NoActualData message={delayedOnly ? "No delayed activities" : "No actual data"} hint={canEditPlan && !delayedOnly ? 'Click "Add Activity" to capture the inception work plan.' : undefined} />
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
                              canEdit={canEditPlan}
                              canAddTask={canAddTask}
                              taskNote={canEdit && !canAddTask ? "Tasks can be added once the Budget Officer certifies the LIB." : undefined}
                              onEdit={() => openEdit(m)}
                              people={people}
                              onTasksChanged={() => setReloadKey((k) => k + 1)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === "deliverables" && <TeamTaskCompletion rows={completionRows} tasks={tasks} />}
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
                  <option key={p.id} value={p.id}>{nameOf(p)}</option>
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

const TASK_STATUS_LABEL: Record<string, string> = { pending: "Pending", in_progress: "In Progress", for_review: "For Review", blocked: "Blocked", done: "Done" };

/** The personnel tasks (activities) under one milestone, with "Add task" for leaders (client meeting 2026-10-01, #14). */
function MilestoneTasks({
  milestone,
  canAdd,
  note,
  people,
  onChanged,
}: {
  milestone: Milestone;
  canAdd: boolean;
  note?: string;
  people: Lead[];
  onChanged: () => void;
}) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);
  const emptyForm = { title: "", assignee: "", start_date: milestone.start_date ?? "", due_date: milestone.target_date };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    personnelApi
      .getTasks({ project: milestone.project, milestone: milestone.id })
      .then((t) => active && setTasks(t))
      .catch(() => active && setTasks([]));
    return () => {
      active = false;
    };
  }, [milestone.id, milestone.project, reload]);

  const minDate = milestone.start_date ?? undefined;
  const maxDate = milestone.target_date;
  const outside = (d: string) => !!d && ((!!minDate && d < minDate) || d > maxDate);
  const outOfRange = outside(form.start_date) || outside(form.due_date);
  const hasWorkingDay = workingDays(form.start_date, form.due_date) > 0;

  const save = async () => {
    if (!form.title.trim() || !form.assignee || !form.start_date || !form.due_date) {
      notify.error("Task title, assignee, Start Date and End Date are required.");
      return;
    }
    if (outOfRange) {
      notify.error(`The dates must be within the activity's planned dates (${minDate ?? "start"} to ${maxDate}).`);
      return;
    }
    if (!hasWorkingDay) {
      notify.error(plannedHoursLabel(form.start_date, form.due_date));
      return;
    }
    setSaving(true);
    try {
      await personnelApi.createTask({
        project: milestone.project,
        milestone: milestone.id,
        title: form.title.trim(),
        assignee: Number(form.assignee),
        start_date: form.start_date,
        due_date: form.due_date,
      });
      notify.success("Task added. The assignee was e-mailed.");
      setForm(emptyForm);
      setAdding(false);
      setReload((k) => k + 1);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not add the task."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Tasks under this activity</p>
        {canAdd && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors hover:bg-[#c7d8ef]" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
            + Add task
          </button>
        )}
        {!canAdd && note && <p className="text-xs" style={{ color: "#94a3b8" }}>{note}</p>}
      </div>
      {tasks === null ? (
        <p className="text-xs" style={{ color: "#94a3b8" }}>Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-xs" style={{ color: "#94a3b8" }}>No tasks yet. The activity stays Not Started until a task reaches 100%.</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                <td className="py-1.5 pr-2 font-semibold" style={{ color: "#0d2a5e" }}>
                  <Link to={`/tasks?project=${t.project}&task=${t.id}`} className="hover:underline">{t.title}</Link>
                </td>
                <td className="py-1.5 pr-2" style={{ color: "#475569" }}>{nameOf(t.assignee_detail)}</td>
                <td className="py-1.5 pr-2 font-mono" style={{ color: "#64748b" }}>{t.due_date ?? "—"}</td>
                <td className="py-1.5 pr-2" style={{ color: t.status === "done" ? "#059669" : "#0369a1" }}>{TASK_STATUS_LABEL[t.status] ?? t.status}</td>
                <td className="py-1.5 font-mono font-bold text-right" style={{ color: "#0d2a5e" }}>{t.progress_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {adding && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
          <input className={inputCls + " md:col-span-2"} style={inputSt} placeholder="Task title, e.g. Survey Barangay 1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className={inputCls} style={inputSt} value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
            <option value="">Assignee…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{nameOf(p)}</option>
            ))}
          </select>
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            {(
              [
                ["start_date", "Start Date"],
                ["due_date", "End Date"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="text-xs font-semibold" style={{ color: "#64748b" }}>
                {label}
                <input
                  type="date"
                  className={inputCls + " mt-1"}
                  style={{ ...inputSt, borderColor: outside(form[field]) ? "#dc2626" : "#e2e8f0" }}
                  value={form[field]}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <p className="md:col-span-4 text-xs font-semibold" style={{ color: form.start_date && form.due_date && !hasWorkingDay ? "#dc2626" : "#0369a1" }}>
            {plannedHoursLabel(form.start_date, form.due_date)}
          </p>
          <p className="md:col-span-4 text-xs" style={{ color: outOfRange ? "#dc2626" : "#94a3b8" }}>
            Dates must be within the planned dates: {minDate ?? "—"} → {maxDate}
          </p>
          <div className="md:col-span-4 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer disabled:opacity-60" style={{ background: "#0d2a5e" }}>
              {saving ? "Adding…" : "Add task"}
            </button>
          </div>
        </div>
      )}
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
  canAddTask,
  taskNote,
  onEdit,
  people,
  onTasksChanged,
}: {
  m: Milestone;
  seq: number;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  canAddTask: boolean;
  taskNote?: string;
  onEdit: () => void;
  people: Lead[];
  onTasksChanged: () => void;
}) {
  return (
    <>
      <tr className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={onToggle}>
        <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color: "#94a3b8" }}>A-{String(seq).padStart(2, "0")}</td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <ChevronRight size={10} strokeWidth={2.5} color="#94a3b8" className="shrink-0 transition-transform" aria-hidden="true" />
            <p className="text-xs font-semibold" style={{ color: "#0d2a5e" }}>{m.title}</p>
          </div>
          {m.tasks_total > 0 && (
            <div className="flex items-center gap-2 mt-1 ml-4">
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
                <div className="h-full rounded-full" style={{ width: `${m.progress_pct}%`, background: m.progress_pct === 100 ? "#059669" : "#0891b2" }} />
              </div>
              <span className="text-[11px]" style={{ color: "#64748b" }}>
                {m.tasks_done}/{m.tasks_total} tasks · {m.progress_pct}%
              </span>
            </div>
          )}
        </td>
        <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: "#64748b" }}>
          <p>{m.start_date ?? "—"}</p>
          <p style={{ color: "#94a3b8" }}>→ {m.target_date}</p>
        </td>
        <td className="px-3 py-2.5 text-xs" style={{ color: "#475569" }}>{nameOf(m.responsible_detail)}</td>
        <td className="px-3 py-2.5">
          <span
            className="text-xs font-semibold rounded-full px-2 py-1 whitespace-nowrap"
            style={{ background: STATUS_META[m.status].bg, color: STATUS_META[m.status].text }}
            title="Follows the tasks: Not Started until one reaches 100%, Done when all have."
          >
            {STATUS_META[m.status].label}
          </span>
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
            <MilestoneTasks milestone={m} canAdd={canAddTask} note={taskNote} people={people} onChanged={onTasksChanged} />
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
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}><TriangleAlert className={ICON} aria-hidden="true" /> No Work Plan yet</span>
                      )}
                      {s.late > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#991b1b" }}>{s.late} delayed</span>
                      )}
                    </div>
                    <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{proj.title}</p>
                    <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                      PI: {nameOf(proj.lead_detail)}
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
