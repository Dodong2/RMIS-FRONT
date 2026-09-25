import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import type {
  ProjectAssignment,
  Task,
  TaskPriority,
  TaskStatus,
  TaskUpdate,
  TaskUpdateKind,
  WorkloadRow,
} from "../types/personnel";
import type { Lead, Project, Study } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const TASK_ASSIGNER_CODES = ["system_admin", "crc_chair", "drd", "riuh", "program_leader", "project_leader", "study_leader"];

const STATUS_META: Record<TaskStatus, { label: string; bg: string; text: string; dot: string; col: string }> = {
  pending: { label: "To Do", bg: "#f1f5f9", text: "#475569", dot: "#94a3b8", col: "#e2e8f0" },
  in_progress: { label: "In Progress", bg: "#e0f2fe", text: "#0369a1", dot: "#0891b2", col: "#bae6fd" },
  for_review: { label: "For Review", bg: "#faf5ff", text: "#6b21a8", dot: "#a855f7", col: "#e9d5ff" },
  done: { label: "Completed", bg: "#d1fae5", text: "#166534", dot: "#22c55e", col: "#bbf7d0" },
  blocked: { label: "Blocked", bg: "#fee2e2", text: "#991b1b", dot: "#ef4444", col: "#fecaca" },
};

const PRIORITY_META: Record<TaskPriority, { label: string; bg: string; text: string; icon: string }> = {
  critical: { label: "Critical", bg: "#fee2e2", text: "#991b1b", icon: "🔴" },
  high: { label: "High", bg: "#fff7ed", text: "#c2410c", icon: "🟠" },
  medium: { label: "Medium", bg: "#fef3c7", text: "#92400e", icon: "🟡" },
  low: { label: "Low", bg: "#f0fdf4", text: "#166534", icon: "🟢" },
};

const KIND_META: Record<TaskUpdateKind, { label: string; bg: string; text: string }> = {
  update: { label: "Update", bg: "#e0f2fe", text: "#0369a1" },
  comment: { label: "Comment", bg: "#f1f5f9", text: "#475569" },
  blocker: { label: "Blocker", bg: "#fee2e2", text: "#991b1b" },
  completion: { label: "Completion", bg: "#d1fae5", text: "#166534" },
};

const KANBAN_COLS: TaskStatus[] = ["pending", "in_progress", "for_review", "blocked", "done"];
const ASSIGNEE_STATUSES: TaskStatus[] = ["in_progress", "blocked", "for_review"];
const PRIORITY_ORDER: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

const initials = (email: string) => email.slice(0, 2).toUpperCase();
const num = (v: string | number | null | undefined) => Number(v ?? 0);

function isOverdue(t: Task, now: number) {
  return !!t.due_date && t.status !== "done" && new Date(t.due_date).getTime() < now - 86400000;
}

function PriorityBadge({ p }: { p: TaskPriority }) {
  const m = PRIORITY_META[p];
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.text }}>{m.icon} {m.label}</span>;
}

function StatusBadge({ s }: { s: TaskStatus }) {
  const m = STATUS_META[s];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function HoursBar({ estimated, logged }: { estimated: number; logged: number }) {
  const pct = estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;
  const over = estimated > 0 && logged > estimated;
  return (
    <div className="flex-1">
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "#ef4444" : "#0891b2" }} />
      </div>
      <p className="text-xs mt-0.5" style={{ color: over ? "#dc2626" : "#94a3b8" }}>
        {logged}h logged / {estimated ? `${estimated}h est.` : "no estimate"}
      </p>
    </div>
  );
}

function Overlay({ children, onClose, width = "max-w-2xl" }: { children: React.ReactNode; onClose: () => void; width?: string }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 pb-4"
      style={{ background: "rgba(8,26,61,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-2xl shadow-2xl overflow-hidden animate-fade-in max-h-[92vh] flex flex-col`}
        style={{ background: "white" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-white/50 hover:text-white shrink-0 mt-0.5" aria-label="Close">
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

function TaskDetailModal({
  task,
  canAssign,
  isAssignee,
  onChanged,
  onDeleted,
  onClose,
}: {
  task: Task;
  canAssign: boolean;
  isAssignee: boolean;
  onChanged: (t: Task) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}) {
  const [updates, setUpdates] = useState<TaskUpdate[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<TaskUpdateKind>("update");
  const [hours, setHours] = useState("");
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [newDeliverable, setNewDeliverable] = useState("");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
    due_date: task.due_date ?? "",
    estimated_hours: task.estimated_hours ?? "",
    tags: task.tags.join(", "),
  });
  const canUpdate = canAssign || isAssignee;
  const allowedStatuses = canAssign ? (Object.keys(STATUS_META) as TaskStatus[]) : ASSIGNEE_STATUSES;
  const doneDels = task.deliverables.filter((d) => d.done).length;

  useEffect(() => {
    let active = true;
    personnelApi
      .getTaskUpdates(task.id)
      .then((u) => active && setUpdates(u))
      .catch(() => active && setUpdates([]));
    return () => {
      active = false;
    };
  }, [task.id, reloadKey]);

  const refreshTask = async () => {
    const [fresh] = await personnelApi.getTasks({ project: task.project }).then((ts) => ts.filter((t) => t.id === task.id));
    if (fresh) onChanged(fresh);
  };

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      await refreshTask();
      setReloadKey((k) => k + 1);
      if (ok) notify.success(ok);
    } catch (err) {
      notify.error(errorMessage(err, "The change could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    if (!note.trim()) return;
    setPosting(true);
    try {
      await personnelApi.postTaskUpdate(task.id, { note: note.trim(), kind, hours: hours || undefined });
      setNote("");
      setHours("");
      await refreshTask();
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not post the update."));
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = () =>
    run(async () => {
      await personnelApi.updateTask(task.id, {
        title: edit.title,
        description: edit.description,
        priority: edit.priority,
        due_date: edit.due_date || null,
        estimated_hours: edit.estimated_hours ? String(edit.estimated_hours) : null,
        tags: edit.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEditing(false);
    }, "Task updated.");

  const remove = async () => {
    setBusy(true);
    try {
      await personnelApi.deleteTask(task.id);
      notify.success("Task deleted.");
      onDeleted(task.id);
    } catch (err) {
      notify.error(errorMessage(err, "Could not delete the task."));
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="px-6 py-4 flex items-start justify-between gap-3 shrink-0" style={{ background: "#0d2a5e" }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono font-bold" style={{ color: "#67e8f9" }}>TASK-{String(task.id).padStart(3, "0")}</span>
            <PriorityBadge p={task.priority} />
            <StatusBadge s={task.status} />
          </div>
          <p className="text-white font-bold leading-snug">{task.title}</p>
        </div>
        <CloseX onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x" style={{ borderColor: "#e2e8f0" }}>
          <div className="md:col-span-2 p-5 space-y-4">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="label-field">Task Title</label>
                  <input className={inputCls} style={inputSt} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">Description</label>
                  <textarea rows={3} className={inputCls + " resize-none"} style={inputSt} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label-field">Priority</label>
                    <select className={inputCls} style={inputSt} value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value as TaskPriority })}>
                      {Object.entries(PRIORITY_META).map(([k, m]) => (
                        <option key={k} value={k}>{m.icon} {m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Due Date</label>
                    <input type="date" className={inputCls} style={inputSt} value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-field">Est. Hours</label>
                    <input type="number" min="0" step="0.5" className={inputCls} style={inputSt} value={edit.estimated_hours} onChange={(e) => setEdit({ ...edit, estimated_hours: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label-field">Tags (comma-separated)</label>
                  <input className={inputCls} style={inputSt} value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-xl text-xs font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
                  <button onClick={saveEdit} disabled={busy} className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>Save Changes</button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Description</p>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: task.description ? "#334155" : "#94a3b8" }}>
                  {task.description || "No description."}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Deliverables</p>
                <span className="text-xs font-mono font-bold" style={{ color: doneDels === task.deliverables.length ? "#059669" : "#0891b2" }}>
                  {doneDels}/{task.deliverables.length}
                </span>
              </div>
              {task.deliverables.length > 0 && (
                <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: "#f1f5f9" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(doneDels / task.deliverables.length) * 100}%`, background: doneDels === task.deliverables.length ? "#059669" : "#0891b2" }}
                  />
                </div>
              )}
              <div className="space-y-1">
                {task.deliverables.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 group">
                    <button
                      disabled={!canUpdate || busy}
                      onClick={() => run(() => personnelApi.setTaskDeliverableDone(d.id, !d.done))}
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: d.done ? "#059669" : "#e2e8f0" }}
                      aria-label={d.done ? "Mark not done" : "Mark done"}
                    >
                      {d.done && (
                        <svg width="8" height="8" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                    <p className="text-xs flex-1" style={{ color: d.done ? "#166534" : "#334155", textDecoration: d.done ? "line-through" : "none" }}>{d.text}</p>
                    {canAssign && (
                      <button onClick={() => run(() => personnelApi.deleteTaskDeliverable(d.id))} className="text-xs opacity-0 group-hover:opacity-100" style={{ color: "#dc2626" }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {task.deliverables.length === 0 && <p className="text-xs" style={{ color: "#94a3b8" }}>No deliverables listed.</p>}
              </div>
              {canAssign && (
                <div className="flex gap-2 mt-2">
                  <input
                    className={inputCls + " py-1.5 text-xs"}
                    style={inputSt}
                    value={newDeliverable}
                    onChange={(e) => setNewDeliverable(e.target.value)}
                    placeholder="Add a deliverable…"
                  />
                  <button
                    disabled={!newDeliverable.trim() || busy}
                    onClick={() =>
                      run(async () => {
                        await personnelApi.addTaskDeliverable(task.id, newDeliverable.trim());
                        setNewDeliverable("");
                      })
                    }
                    className="px-3 rounded-xl text-xs font-bold disabled:opacity-50"
                    style={{ background: "#e0eaf7", color: "#0d2a5e" }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f4f8", color: "#64748b" }}>#{tag}</span>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Updates &amp; Comments</p>
              <div className="space-y-3">
                {updates === null ? (
                  <div className="h-16 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
                ) : updates.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: "#94a3b8" }}>No updates yet.</p>
                ) : (
                  updates.map((u) => {
                    const cm = KIND_META[u.kind];
                    return (
                      <div key={u.id} className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: "#0d2a5e" }}>
                              {initials(u.author_email)}
                            </div>
                            <span className="text-xs font-bold truncate" style={{ color: "#0d2a5e" }}>{u.author_email}</span>
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: cm.bg, color: cm.text }}>{cm.label}</span>
                            {num(u.hours) > 0 && <span className="text-xs font-mono" style={{ color: "#0891b2" }}>+{num(u.hours)}h</span>}
                            {u.new_status && <StatusBadge s={u.new_status} />}
                          </div>
                          <span className="text-xs font-mono shrink-0" style={{ color: "#94a3b8" }}>{u.created_at.slice(0, 10)}</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{u.note}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {canUpdate && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {(Object.keys(KIND_META) as TaskUpdateKind[]).map((k) => {
                      const cm = KIND_META[k];
                      return (
                        <button
                          key={k}
                          onClick={() => setKind(k)}
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                          style={{
                            background: kind === k ? cm.bg : "#f1f5f9",
                            color: kind === k ? cm.text : "#94a3b8",
                            border: `1px solid ${kind === k ? cm.text + "30" : "#e2e8f0"}`,
                          }}
                        >
                          {cm.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className={inputCls + " resize-none"}
                    style={inputSt}
                    placeholder={`Post a ${KIND_META[kind].label.toLowerCase()}...`}
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className={inputCls + " w-32"}
                      style={inputSt}
                      placeholder="Hours worked"
                    />
                    <button
                      onClick={post}
                      disabled={!note.trim() || posting}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                      style={{ background: note.trim() ? "#0d2a5e" : "#94a3b8" }}
                    >
                      {posting ? "Posting…" : "Post"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4" style={{ background: "#f8fafc" }}>
            <div className="space-y-3">
              {[
                { label: "Assigned To", val: task.assignee_detail.email },
                { label: "Due Date", val: task.due_date ?? "—" },
                { label: "Started", val: task.started_at?.slice(0, 10) ?? "—" },
                { label: "Completed", val: task.completed_at?.slice(0, 10) ?? "—" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{item.label}</p>
                  <p className="text-sm font-semibold mt-0.5 break-all" style={{ color: "#1e293b" }}>{item.val}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Hours</p>
              <HoursBar estimated={num(task.estimated_hours)} logged={num(task.logged_hours)} />
            </div>

            {canAssign && task.status === "for_review" && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: "#faf5ff", border: "1px solid #e9d5ff" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#6b21a8" }}>Review Submission</p>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className={inputCls + " resize-none text-xs"}
                  style={inputSt}
                  placeholder="Remarks (optional)"
                />
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => run(() => personnelApi.reviewTask(task.id, "approve", remarks), "Task approved.")}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: "#059669" }}
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => run(() => personnelApi.reviewTask(task.id, "return", remarks), "Task returned.")}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: "#fee2e2", color: "#dc2626" }}
                  >
                    Return
                  </button>
                </div>
              </div>
            )}

            {canUpdate && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Change Status</p>
                <div className="space-y-1">
                  {allowedStatuses.map((key) => {
                    const m = STATUS_META[key];
                    return (
                      <button
                        key={key}
                        disabled={busy || task.status === key}
                        onClick={() => run(() => personnelApi.updateTaskStatus(task.id, key))}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: task.status === key ? m.bg : "white", color: m.text, border: `1px solid ${task.status === key ? m.dot : "#e2e8f0"}` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.dot }} />
                        {m.label}
                        {task.status === key && <span className="ml-auto text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {!canAssign && <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>Submit for review when done; a leader marks it completed.</p>}
              </div>
            )}

            {canAssign && !editing && (
              <div className="space-y-2">
                <button onClick={() => setEditing(true)} className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                  Edit Task
                </button>
                <button onClick={remove} disabled={busy} className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: "#fee2e2", color: "#dc2626" }}>
                  Delete Task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function CreateTaskModal({
  project,
  people,
  onCreated,
  onClose,
}: {
  project: Project;
  people: Lead[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [studies, setStudies] = useState<Study[]>([]);
  const [form, setForm] = useState({ title: "", description: "", assignee: "", study: "", priority: "medium", due_date: "", estimated_hours: "", tags: "" });
  const [deliverables, setDeliverables] = useState([""]);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let active = true;
    researchApi
      .getStudies(project.id)
      .then((s) => active && setStudies(s))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  const create = async () => {
    setAttempted(true);
    if (!form.title.trim() || !form.assignee) {
      notify.error("Task title and assignee are required.");
      return;
    }
    setSaving(true);
    try {
      const task = await personnelApi.createTask({
        project: project.id,
        study: form.study ? Number(form.study) : null,
        title: form.title,
        description: form.description || undefined,
        due_date: form.due_date || undefined,
        assignee: Number(form.assignee),
        priority: form.priority as TaskPriority,
        estimated_hours: form.estimated_hours || undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      await Promise.all(deliverables.map((d) => d.trim()).filter(Boolean).map((d) => personnelApi.addTaskDeliverable(task.id, d)));
      notify.success("Task assigned.");
      onCreated();
    } catch (err) {
      notify.error(errorMessage(err, "Could not create the task."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose} width="max-w-xl">
      <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ background: "#0d2a5e" }}>
        <div className="min-w-0">
          <p className="text-white font-bold">Create Task</p>
          <p className="text-white/50 text-xs mt-0.5 truncate">{project.project_code} · {project.title}</p>
        </div>
        <CloseX onClick={onClose} />
      </div>
      <div className="p-6 overflow-y-auto space-y-4">
        <div>
          <label className="label-field">Task Title <span style={{ color: "#dc2626" }}>*</span></label>
          <input
            className={inputCls}
            style={{ ...inputSt, borderColor: attempted && !form.title.trim() ? "#dc2626" : "#e2e8f0" }}
            value={form.title}
            onChange={set("title")}
            placeholder="Short, specific task title"
          />
        </div>
        <div>
          <label className="label-field">Description</label>
          <textarea rows={3} className={inputCls + " resize-none"} style={inputSt} value={form.description} onChange={set("description")} placeholder="Instructions, context, and acceptance criteria..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-field">Assign To <span style={{ color: "#dc2626" }}>*</span></label>
            <select className={inputCls} style={{ ...inputSt, borderColor: attempted && !form.assignee ? "#dc2626" : "#e2e8f0" }} value={form.assignee} onChange={set("assignee")}>
              <option value="">{people.length ? "— Select team member —" : "No one assigned to this project yet"}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Study</label>
            <select className={inputCls} style={inputSt} value={form.study} onChange={set("study")}>
              <option value="">Whole project</option>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Priority</label>
            <select className={inputCls} style={inputSt} value={form.priority} onChange={set("priority")}>
              {Object.entries(PRIORITY_META).map(([k, m]) => (
                <option key={k} value={k}>{m.icon} {m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Due Date</label>
            <input type="date" className={inputCls} style={inputSt} value={form.due_date} onChange={set("due_date")} />
          </div>
          <div>
            <label className="label-field">Estimated Hours</label>
            <input type="number" min="0" step="0.5" className={inputCls} style={inputSt} value={form.estimated_hours} onChange={set("estimated_hours")} placeholder="e.g. 8" />
          </div>
          <div>
            <label className="label-field">Tags (comma-separated)</label>
            <input className={inputCls} style={inputSt} value={form.tags} onChange={set("tags")} placeholder="e.g. data-analysis, field-work" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label-field mb-0">Deliverables</label>
            <button onClick={() => setDeliverables([...deliverables, ""])} className="text-xs font-semibold" style={{ color: "#0891b2" }}>+ Add</button>
          </div>
          <div className="space-y-2">
            {deliverables.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputCls + " flex-1"}
                  style={inputSt}
                  value={d}
                  onChange={(e) => {
                    const n = [...deliverables];
                    n[i] = e.target.value;
                    setDeliverables(n);
                  }}
                  placeholder={`Deliverable ${i + 1}...`}
                />
                {deliverables.length > 1 && (
                  <button onClick={() => setDeliverables(deliverables.filter((_, idx) => idx !== i))} className="px-2 rounded-xl text-xs" style={{ background: "#fee2e2", color: "#dc2626" }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t flex gap-3 shrink-0" style={{ borderColor: "#e2e8f0" }}>
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
        <button onClick={create} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
          {saving ? "Creating…" : "Create Task"}
        </button>
      </div>
    </Overlay>
  );
}

function KanbanCard({ task, now, onClick }: { task: Task; now: number; onClick: () => void }) {
  const sm = STATUS_META[task.status];
  const pm = PRIORITY_META[task.priority];
  const doneDels = task.deliverables.filter((d) => d.done).length;
  const overdue = isOverdue(task, now);
  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-3.5 cursor-pointer transition-all hover:shadow-md hover:border-[#0891b2] hover:-translate-y-px"
      style={{ background: "white", border: `1.5px solid ${sm.col}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono font-bold" style={{ color: "#94a3b8" }}>TASK-{String(task.id).padStart(3, "0")}</span>
        <span className="text-xs font-bold" style={{ color: pm.text }} title={pm.label}>{pm.icon}</span>
      </div>
      <p className="text-xs font-bold leading-snug mb-2" style={{ color: "#0d2a5e" }}>{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap mb-2.5">
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-black shrink-0" style={{ background: "#0d2a5e", fontSize: "9px" }}>
          {initials(task.assignee_detail.email)}
        </div>
        <span className="text-xs truncate" style={{ color: "#64748b" }}>{task.assignee_detail.email.split("@")[0]}</span>
        {overdue && <span className="text-xs font-bold ml-auto" style={{ color: "#dc2626" }}>⚠ Overdue</span>}
      </div>
      {task.deliverables.length > 0 && (
        <div className="mb-2">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${(doneDels / task.deliverables.length) * 100}%`, background: doneDels === task.deliverables.length ? "#059669" : "#0891b2" }}
            />
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{doneDels}/{task.deliverables.length} deliverables</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <HoursBar estimated={num(task.estimated_hours)} logged={num(task.logged_hours)} />
        {task.due_date && (
          <span className="text-xs font-mono shrink-0 ml-2" style={{ color: overdue ? "#dc2626" : "#94a3b8" }}>{task.due_date.slice(5)}</span>
        )}
      </div>
    </div>
  );
}

type BoardView = "kanban" | "list" | "workload" | "personnel";

function ProjectTaskBoard({
  project,
  canAssign,
  userId,
  now,
  onBack,
}: {
  project: Project;
  canAssign: boolean;
  userId: number | undefined;
  now: number;
  onBack: () => void;
}) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [overdueIds, setOverdueIds] = useState<Set<number> | null>(null);
  const [team, setTeam] = useState<ProjectAssignment[]>([]);
  const [workload, setWorkload] = useState<WorkloadRow[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<BoardView>("kanban");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");
  const [filterMember, setFilterMember] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    personnelApi
      .getTasks({ project: project.id })
      .then((t) => active && setTasks(t))
      .catch(() => active && setTasks([]));
    personnelApi
      .getAssignments({ project: project.id, active: true })
      .then((a) => active && setTeam(a))
      .catch(() => undefined);
    if (canAssign) {
      personnelApi
        .getWorkload({ project: project.id })
        .then((w) => active && setWorkload(w))
        .catch(() => active && setWorkload([]));
    }
    return () => {
      active = false;
    };
  }, [project.id, canAssign, reloadKey]);

  useEffect(() => {
    if (!overdueOnly) return;
    let active = true;
    personnelApi
      .getTasks({ project: project.id, overdue: true })
      .then((t) => active && setOverdueIds(new Set(t.map((x) => x.id))))
      .catch(() => active && setOverdueIds(new Set()));
    return () => {
      active = false;
    };
  }, [overdueOnly, project.id, reloadKey]);

  const people = useMemo(() => {
    const list: Lead[] = [...team.map((a) => a.user_detail), ...(tasks ?? []).map((t) => t.assignee_detail)];
    return list.filter((p, i) => list.findIndex((x) => x.id === p.id) === i);
  }, [team, tasks]);

  const all = tasks ?? [];
  const q = search.toLowerCase();
  const filtered = all.filter(
    (t) =>
      (filterPriority === "all" || t.priority === filterPriority) &&
      (filterMember === "all" || String(t.assignee) === filterMember) &&
      (!overdueOnly || (overdueIds?.has(t.id) ?? false)) &&
      (!q || t.title.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q))),
  );
  const counts = {
    total: all.length,
    open: all.filter((t) => t.status !== "done").length,
    completed: all.filter((t) => t.status === "done").length,
    review: all.filter((t) => t.status === "for_review").length,
    overdue: all.filter((t) => isOverdue(t, now)).length,
  };
  const selected = all.find((t) => t.id === selectedId) ?? null;

  const views: { key: BoardView; label: string }[] = [
    { key: "kanban", label: "Task Board" },
    { key: "list", label: "Task List" },
    ...(canAssign ? [{ key: "workload" as BoardView, label: "Workload" }] : []),
    { key: "personnel", label: "Personnel" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Projects
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-mono font-semibold" style={{ color: "#64748b" }}>{project.project_code}</span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded mb-2 inline-block" style={{ background: "rgba(255,255,255,0.15)", color: "#67e8f9" }}>
                {project.project_code}
              </span>
              <p className="text-white font-black text-lg leading-snug max-w-2xl">{project.title}</p>
              <p className="text-sm mt-1" style={{ color: "rgba(168,196,232,0.7)" }}>
                {[project.implementing_unit, `${team.length + 1} team member${team.length ? "s" : ""}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            {canAssign && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Task
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              { label: "Total Tasks", val: counts.total },
              { label: "Open", val: counts.open },
              { label: "For Review", val: counts.review },
              { label: "Completed", val: counts.completed },
              { label: "Overdue", val: counts.overdue },
            ].map((k) => (
              <div key={k.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                <p className="text-xs" style={{ color: "rgba(168,196,232,0.6)" }}>{k.label}</p>
                <p className="font-black text-2xl mt-0.5" style={{ color: "white" }}>{tasks === null ? "…" : k.val}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all"
              style={{ borderBottomColor: view === v.key ? "#0891b2" : "transparent", color: view === v.key ? "#0891b2" : "#64748b" }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {(view === "kanban" || view === "list") && (
            <div className="flex flex-wrap gap-2 mb-5">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks, tags…"
                  className="pl-7 pr-3 py-1.5 rounded-xl text-xs border outline-none"
                  style={{ background: "white", borderColor: "#e2e8f0", color: "#334155", width: "180px" }}
                />
              </div>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "all")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
                style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
              >
                <option value="all">All Priorities</option>
                {Object.entries(PRIORITY_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.icon} {m.label}</option>
                ))}
              </select>
              {canAssign && (
                <select
                  value={filterMember}
                  onChange={(e) => setFilterMember(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
                  style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
                >
                  <option value="all">All Members</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.email}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setOverdueOnly((v) => !v)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={overdueOnly ? { background: "#fff7ed", color: "#c2410c" } : { background: "#f1f5f9", color: "#64748b" }}
              >
                {overdueOnly ? "⚠ Overdue only" : "Show overdue only"}
              </button>
            </div>
          )}

          {tasks === null ? (
            <div className="h-40 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
          ) : (
            <>
              {view === "kanban" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {KANBAN_COLS.map((col) => {
                    const colTasks = filtered.filter((t) => t.status === col);
                    const sm = STATUS_META[col];
                    return (
                      <div key={col} className="space-y-2">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: sm.dot }} />
                            <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#334155" }}>{sm.label}</p>
                          </div>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.text }}>{colTasks.length}</span>
                        </div>
                        <div className="rounded-xl p-1.5 min-h-24 space-y-2" style={{ background: "#f8fafc" }}>
                          {colTasks.map((task) => (
                            <KanbanCard key={task.id} task={task} now={now} onClick={() => setSelectedId(task.id)} />
                          ))}
                          {colTasks.length === 0 && <p className="text-xs text-center py-6" style={{ color: "#cbd5e1" }}>No tasks</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view === "list" &&
                (filtered.length === 0 ? (
                  <NoActualData message={all.length ? "No tasks match your filters." : "No actual data"} />
                ) : (
                  <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "#f0f4f8" }}>
                          {["ID", "Task", "Assigned To", "Priority", "Due Date", "Status", "Deliverables", ""].map((h) => (
                            <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...filtered]
                          .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                          .map((task) => {
                            const pm = PRIORITY_META[task.priority];
                            const doneDels = task.deliverables.filter((d) => d.done).length;
                            const overdue = isOverdue(task, now);
                            return (
                              <tr key={task.id} className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={() => setSelectedId(task.id)}>
                                <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color: "#94a3b8" }}>T-{String(task.id).padStart(3, "0")}</td>
                                <td className="px-3 py-2.5">
                                  <p className="text-xs font-semibold" style={{ color: "#0d2a5e" }}>{task.title}</p>
                                  <div className="flex gap-1 mt-0.5">
                                    {task.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#f0f4f8", color: "#64748b" }}>#{tag}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: "#475569" }}>{task.assignee_detail.email}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className="text-xs font-bold" style={{ color: pm.text }}>{pm.icon} {pm.label}</span>
                                </td>
                                <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: overdue ? "#dc2626" : "#64748b", fontWeight: overdue ? "bold" : "normal" }}>
                                  {task.due_date ?? "—"}
                                  {overdue && " ⚠"}
                                </td>
                                <td className="px-3 py-2.5"><StatusBadge s={task.status} /></td>
                                <td className="px-3 py-2.5" style={{ minWidth: "110px" }}>
                                  {task.deliverables.length > 0 ? (
                                    <div>
                                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                                        <div className="h-full rounded-full" style={{ width: `${(doneDels / task.deliverables.length) * 100}%`, background: doneDels === task.deliverables.length ? "#059669" : "#0891b2" }} />
                                      </div>
                                      <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{doneDels}/{task.deliverables.length} del.</p>
                                    </div>
                                  ) : (
                                    <span style={{ color: "#cbd5e1" }}>—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => setSelectedId(task.id)} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#e0f2fe", color: "#0369a1" }}>View</button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ))}

              {view === "workload" &&
                (workload === null ? (
                  <div className="h-40 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
                ) : workload.length === 0 ? (
                  <NoActualData hint="Workload appears once tasks are assigned." />
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Project-Level Workload</p>
                    {workload.map((w) => {
                      const est = num(w.estimated_hours);
                      const logged = num(w.logged_hours);
                      const maxEst = Math.max(...workload.map((x) => num(x.estimated_hours)), 1);
                      const utilPct = est > 0 ? Math.min(100, Math.round((logged / est) * 100)) : 0;
                      return (
                        <div key={w.assignee} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0" style={{ background: "#0d2a5e" }}>
                              {initials(w.email)}
                            </div>
                            <p className="flex-1 min-w-0 text-sm font-bold truncate" style={{ color: "#0d2a5e" }}>{w.email}</p>
                            <div className="text-right shrink-0">
                              <p className="text-xl font-black font-mono" style={{ color: "#0d2a5e" }}>{w.open + w.done}</p>
                              <p className="text-xs" style={{ color: "#94a3b8" }}>tasks</p>
                            </div>
                          </div>
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1" style={{ color: "#94a3b8" }}>
                              <span>Hour utilization</span>
                              <span className="font-mono font-bold" style={{ color: logged > est ? "#dc2626" : "#0891b2" }}>{utilPct}%</span>
                            </div>
                            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                              <div className="absolute inset-y-0 left-0 rounded-full opacity-20" style={{ width: `${Math.round((est / maxEst) * 100)}%`, background: "#0d2a5e" }} />
                              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${utilPct}%`, background: logged > est ? "#ef4444" : "#0891b2" }} />
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{logged}h logged / {est}h estimated</p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { label: "Open", count: w.open, bg: "#e0f2fe", text: "#0369a1" },
                              { label: "Done", count: w.done, bg: "#d1fae5", text: "#166534" },
                              { label: "Overdue", count: w.overdue, bg: "#fee2e2", text: "#991b1b" },
                            ].map((stat) => (
                              <div key={stat.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: stat.bg }}>
                                <span className="text-sm font-black" style={{ color: stat.text }}>{stat.count}</span>
                                <span className="text-xs font-semibold" style={{ color: stat.text }}>{stat.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

              {view === "personnel" && (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Project Personnel</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { id: project.lead_detail.id, email: project.lead_detail.email, role: "Project Leader", dept: project.implementing_unit },
                      ...team.map((a) => ({ id: a.user_detail.id, email: a.user_detail.email, role: a.role_label || "Project Staff", dept: a.department })),
                    ].map((m, i) => {
                      const mine = all.filter((t) => t.assignee === m.id);
                      const logged = mine.reduce((s, t) => s + num(t.logged_hours), 0);
                      return (
                        <div key={`${m.id}-${i}`} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                          <div className="flex items-start gap-3 mb-3">
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm shrink-0"
                              style={{ background: "linear-gradient(135deg, #0d2a5e, #1a3f7a)" }}
                            >
                              {initials(m.email)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate" style={{ color: "#0d2a5e" }}>{m.email}</p>
                              <p className="text-xs font-semibold" style={{ color: "#0891b2" }}>{m.role}</p>
                              {m.dept && <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{m.dept}</p>}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {[
                              { label: "Tasks", val: mine.length, color: "#0d2a5e" },
                              { label: "Open", val: mine.filter((t) => t.status !== "done").length, color: "#0891b2" },
                              { label: "Done", val: mine.filter((t) => t.status === "done").length, color: "#059669" },
                            ].map((stat) => (
                              <div key={stat.label} className="rounded-xl p-2" style={{ background: "#f8fafc" }}>
                                <p className="text-lg font-black" style={{ color: stat.color }}>{stat.val}</p>
                                <p className="text-xs" style={{ color: "#94a3b8" }}>{stat.label}</p>
                              </div>
                            ))}
                          </div>
                          {logged > 0 && <p className="text-xs mt-2 text-center font-mono" style={{ color: "#94a3b8" }}>{logged}h logged this project</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && (
        <TaskDetailModal
          key={selected.id}
          task={selected}
          canAssign={canAssign}
          isAssignee={selected.assignee === userId}
          onChanged={(t) => setTasks((prev) => (prev ?? []).map((x) => (x.id === t.id ? t : x)))}
          onDeleted={(id) => {
            setSelectedId(null);
            setTasks((prev) => (prev ?? []).filter((x) => x.id !== id));
            setReloadKey((k) => k + 1);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
      {showCreate && (
        <CreateTaskModal
          project={project}
          people={[project.lead_detail, ...people.filter((p) => p.id !== project.lead_detail.id)]}
          onCreated={() => {
            setShowCreate(false);
            setReloadKey((k) => k + 1);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function TasksContent() {
  const { user } = useAuth();
  const canAssign = !!user?.role && TASK_ASSIGNER_CODES.includes(user.role.code);
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    Promise.all([researchApi.getProjects(), personnelApi.getTasks()])
      .then(([p, t]) => {
        if (!active) return;
        setProjects(p);
        setTasks(t);
      })
      .catch(() => {
        if (!active) return;
        setProjects([]);
        notify.error("Could not load tasks. Check your connection and refresh.");
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = projects?.find((p) => p.id === Number(params.get("project")));
  if (selected) {
    return <ProjectTaskBoard project={selected} canAssign={canAssign} userId={user?.pk} now={now} onBack={() => setParams({})} />;
  }

  const eligible = (projects ?? []).filter((p) => canAssign || tasks.some((t) => t.project === p.id));
  const kpis = {
    total: tasks.length,
    open: tasks.filter((t) => t.status !== "done").length,
    review: tasks.filter((t) => t.status === "for_review").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
    critical: tasks.filter((t) => t.priority === "critical" && t.status !== "done").length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Total Tasks", val: kpis.total, color: "#0d2a5e" },
          { label: "Open", val: kpis.open, color: "#0369a1" },
          { label: "For Review", val: kpis.review, color: "#6b21a8" },
          { label: "Blocked", val: kpis.blocked, color: "#991b1b" },
          { label: "Overdue", val: kpis.overdue, color: "#c2410c" },
          { label: "Critical Open", val: kpis.critical, color: "#991b1b" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{projects === null ? "…" : s.val}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-lg" style={{ color: "#0d2a5e" }}>{canAssign ? "Select Project" : "Your Assigned Work"}</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            {eligible.length} project{eligible.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="space-y-3">
          {projects === null ? (
            [0, 1].map((i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "white", border: "1px solid #e2e8f0" }} />)
          ) : eligible.length === 0 ? (
            <NoActualData hint={canAssign ? undefined : "No tasks have been assigned to you yet."} />
          ) : (
            eligible.map((proj) => {
              const projTasks = tasks.filter((t) => t.project === proj.id);
              const open = projTasks.filter((t) => t.status !== "done").length;
              const critical = projTasks.filter((t) => t.priority === "critical" && t.status !== "done").length;
              const overdue = projTasks.filter((t) => isOverdue(t, now)).length;
              return (
                <div
                  key={proj.id}
                  onClick={() => setParams({ project: String(proj.id) })}
                  className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:border-[#0891b2] hover:-translate-y-px"
                  style={{ background: "white", border: "1px solid #e2e8f0" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0369a1" }}>{proj.project_code}</span>
                        {proj.campus && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0891b2" }}>{proj.campus}</span>
                        )}
                        {critical > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#991b1b" }}>🔴 {critical} critical</span>
                        )}
                        {overdue > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fff7ed", color: "#c2410c" }}>⚠ {overdue} overdue</span>
                        )}
                      </div>
                      <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{proj.title}</p>
                      <p className="text-xs mt-1" style={{ color: "#64748b" }}>PI: {proj.lead_detail.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-3xl font-black" style={{ color: "#0d2a5e" }}>{projTasks.length}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>tasks</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Open", count: open, color: "#0369a1", bg: "#e0f2fe" },
                      { label: "For Review", count: projTasks.filter((t) => t.status === "for_review").length, color: "#6b21a8", bg: "#faf5ff" },
                      { label: "Blocked", count: projTasks.filter((t) => t.status === "blocked").length, color: "#991b1b", bg: "#fee2e2" },
                      { label: "Done", count: projTasks.filter((t) => t.status === "done").length, color: "#166534", bg: "#d1fae5" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl p-2.5 text-center" style={{ background: stat.bg }}>
                        <p className="text-lg font-black" style={{ color: stat.color }}>{stat.count}</p>
                        <p className="text-xs font-semibold" style={{ color: stat.color }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  {projTasks.length === 0 && canAssign && (
                    <p className="mt-3 text-xs text-center py-2 rounded-xl" style={{ background: "#fef3c7", color: "#92400e" }}>
                      No tasks yet — open the task board to create tasks
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Personnel & Tasks">
        <TasksContent />
      </AppShell>
    </ProtectedRoute>
  );
}
