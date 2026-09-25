import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import type { CollaborationRow, ProjectAssignment, StaffProfile } from "../types/personnel";
import type { Project, Study } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { Field, KpiCard, Pill, SectionCard, SkeletonRows, TableHead } from "../components/common/proto";
import {
  BTN_GHOST_STYLE,
  BTN_PRIMARY,
  BTN_PRIMARY_STYLE,
  BTN_SOFT,
  BTN_SOFT_STYLE,
  INPUT_CLS,
  INPUT_STYLE,
  invalidStyle,
} from "../lib/protoStyles";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const MANAGE_CODES = ["system_admin", "crc_chair", "drd", "riuh"];
const LEVELS = [1, 2, 3];
const LEVEL_COLORS: Record<number, string> = { 1: "#0891b2", 2: "#1a3f7a", 3: "#0d2a5e" };

type View = "personnel" | "assignments" | "collaboration";

const today = () => new Date().toLocaleDateString("en-CA");

interface Person {
  id: number;
  email: string;
  level: number | undefined;
  profile: StaffProfile | undefined;
  assignments: ProjectAssignment[];
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 pb-4"
      style={{ background: "rgba(13,42,94,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: "#0d2a5e" }}>
          <p className="text-white font-bold">{title}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">{children}</div>
        <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: "#e2e8f0" }}>{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

function StaffContent() {
  const { user } = useAuth();
  const canManage = !!user?.role && MANAGE_CODES.includes(user.role.code);

  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collab, setCollab] = useState<CollaborationRow[] | null>(null);
  const [crossOnly, setCrossOnly] = useState(false);
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<View>("personnel");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const [showLevel, setShowLevel] = useState(false);
  const [levelForm, setLevelForm] = useState({ user: "", staff_level: "" });
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ user: "", target: "project", project: "", study: "", role_label: "", department: "", start_date: today() });
  const [studies, setStudies] = useState<Study[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDept, setEditingDept] = useState<{ id: number; value: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([personnelApi.getStaffProfiles(), personnelApi.getAssignments(), researchApi.getProjects()])
      .then(([p, a, pr]) => {
        if (!active) return;
        setProfiles(p);
        setAssignments(a);
        setProjects(pr);
      })
      .catch(() => active && notify.error("Could not load staff records. Check your connection and refresh."))
      .finally(() => active && setIsLoading(false));
    if (canManage) {
      researchApi
        .getUsersByRole("project_staff")
        .then((u) => active && setStaffUsers(u))
        .catch(() => active && setStaffUsers([]));
    }
    return () => {
      active = false;
    };
  }, [canManage, reloadKey]);

  useEffect(() => {
    let active = true;
    personnelApi
      .getCollaboration({ cross_only: crossOnly })
      .then((c) => active && setCollab(c))
      .catch(() => active && setCollab([]));
    return () => {
      active = false;
    };
  }, [crossOnly, reloadKey]);

  const projectTitle = (id: number | null) => projects.find((p) => p.id === id)?.title ?? `#${id}`;
  const projectCode = (id: number | null) => projects.find((p) => p.id === id)?.project_code ?? `#${id}`;

  const people = useMemo<Person[]>(() => {
    const map = new Map<number, Person>();
    const add = (id: number, email: string) => {
      if (!map.has(id)) map.set(id, { id, email, level: undefined, profile: undefined, assignments: [] });
      return map.get(id)!;
    };
    profiles.forEach((p) => {
      const person = add(p.user, p.user_detail.email);
      person.profile = p;
      person.level = p.staff_level;
    });
    assignments.forEach((a) => add(a.user, a.user_detail.email).assignments.push(a));
    return [...map.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [profiles, assignments]);

  const q = search.toLowerCase();
  const filtered = people.filter(
    (p) => p.email.toLowerCase().includes(q) || p.assignments.some((a) => (a.role_label + a.department).toLowerCase().includes(q)),
  );
  const selected = people.find((p) => p.id === selectedId) ?? null;
  const unprofiled = staffUsers.filter((u) => !profiles.some((p) => p.user === u.id));
  const visibleAssignments = activeOnly ? assignments.filter((a) => a.is_active) : assignments;

  const pickProject = async (value: string) => {
    setAssignForm((f) => ({ ...f, project: value, study: "" }));
    try {
      setStudies(value ? await researchApi.getStudies(Number(value)) : []);
    } catch {
      setStudies([]);
    }
  };

  const saveLevel = async () => {
    setAttempted(true);
    if (!levelForm.user || !levelForm.staff_level) {
      notify.error("Select a staff member and a level.");
      return;
    }
    setSaving(true);
    try {
      await personnelApi.createStaffProfile({ user: Number(levelForm.user), staff_level: Number(levelForm.staff_level) });
      notify.success("Staff level saved.");
      setShowLevel(false);
      setLevelForm({ user: "", staff_level: "" });
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not save the staff level."));
    } finally {
      setSaving(false);
    }
  };

  const changeLevel = async (profile: StaffProfile, level: number) => {
    try {
      const updated = await personnelApi.updateStaffProfile(profile.id, level);
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the staff level."));
    }
  };

  const assign = async () => {
    setAttempted(true);
    const targetId = assignForm.target === "project" ? assignForm.project : assignForm.study;
    if (!assignForm.user || !targetId || !assignForm.start_date) {
      notify.error("Staff member, project or study, and start date are required.");
      return;
    }
    setSaving(true);
    try {
      await personnelApi.createAssignment({
        user: Number(assignForm.user),
        project: assignForm.target === "project" ? Number(targetId) : null,
        study: assignForm.target === "study" ? Number(targetId) : null,
        role_label: assignForm.role_label || undefined,
        department: assignForm.department || undefined,
        start_date: assignForm.start_date,
      });
      notify.success("Staff assigned.");
      setShowAssign(false);
      setAssignForm({ user: "", target: "project", project: "", study: "", role_label: "", department: "", start_date: today() });
      setStudies([]);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not create the assignment."));
    } finally {
      setSaving(false);
    }
  };

  const endAssignment = async (a: ProjectAssignment) => {
    try {
      const updated = await personnelApi.updateAssignment(a.id, { end_date: today() });
      setAssignments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      notify.success("Assignment ended.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not end the assignment."));
    }
  };

  const saveDept = async () => {
    if (!editingDept) return;
    try {
      const updated = await personnelApi.updateAssignment(editingDept.id, { department: editingDept.value });
      setAssignments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingDept(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the department."));
    }
  };

  const assignmentTarget = (a: ProjectAssignment) => (a.project ? projectTitle(a.project) : `Study #${a.study}`);

  const deptCell = (a: ProjectAssignment) =>
    editingDept?.id === a.id ? (
      <div className="flex gap-1">
        <input className={INPUT_CLS + " py-1 text-xs"} style={INPUT_STYLE} value={editingDept.value} onChange={(e) => setEditingDept({ id: a.id, value: e.target.value })} />
        <button onClick={saveDept} className={BTN_SOFT} style={BTN_SOFT_STYLE}>Save</button>
      </div>
    ) : (
      <span className="flex items-center gap-1.5">
        {a.department || "—"}
        {canManage && a.is_active && (
          <button onClick={() => setEditingDept({ id: a.id, value: a.department })} className="text-xs font-bold" style={{ color: "#0891b2" }}>
            Edit
          </button>
        )}
      </span>
    );

  const views: { key: View; label: string }[] = [
    { key: "personnel", label: "Personnel" },
    { key: "assignments", label: "Assignments" },
    { key: "collaboration", label: "Cross-Department Collaboration" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Personnel" value={isLoading ? "…" : people.length} />
        <KpiCard label="Active Assignments" value={isLoading ? "…" : assignments.filter((a) => a.is_active).length} />
        <KpiCard label="Staff with Level" value={isLoading ? "…" : profiles.length} />
        <KpiCard label="Cross-Dept Projects" value={collab === null ? "…" : collab.filter((c) => c.is_cross_departmental).length} />
      </div>

      <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => {
              setView(v.key);
              setSelectedId(null);
            }}
            className="px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all"
            style={{ borderBottomColor: view === v.key ? "#0891b2" : "transparent", color: view === v.key ? "#0891b2" : "#64748b" }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view !== "collaboration" && (
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search personnel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 rounded-lg text-sm border outline-none w-full sm:w-[220px]"
              style={{ background: "white", borderColor: "#e2e8f0", color: "#334155" }}
            />
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAttempted(false);
                  setShowLevel(true);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "#e0eaf7", color: "#0d2a5e" }}
              >
                Set Staff Level
              </button>
              <button
                onClick={() => {
                  setAttempted(false);
                  setShowAssign(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ background: "#0891b2" }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Assign to Project
              </button>
            </div>
          )}
        </div>
      )}

      {view === "personnel" &&
        (isLoading ? (
          <SkeletonRows rows={3} />
        ) : selected ? (
          <div className="rounded-xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: "#e2e8f0" }}>
              <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-sm font-medium" style={{ color: "#0891b2" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back
              </button>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-6 items-start mb-6">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
                  style={{ background: LEVEL_COLORS[selected.level ?? 3] }}
                >
                  {selected.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold break-all" style={{ color: "#0d2a5e" }}>{selected.email}</h2>
                    {selected.assignments.some((a) => a.is_active) ? (
                      <Pill bg="#d1fae5" color="#166534">Active</Pill>
                    ) : (
                      <Pill>No active assignment</Pill>
                    )}
                  </div>
                  <p className="text-sm font-semibold mt-1" style={{ color: "#0891b2" }}>
                    {selected.level ? `Staff Level ${selected.level}` : "No staff level set"}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
                    {[...new Set(selected.assignments.map((a) => a.department).filter(Boolean))].join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#64748b" }}>Staff Level (Manual classification)</p>
                  {selected.profile && canManage ? (
                    <div className="flex gap-2">
                      {LEVELS.map((l) => (
                        <button
                          key={l}
                          onClick={() => changeLevel(selected.profile!, l)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={selected.level === l ? { background: LEVEL_COLORS[l], color: "white" } : { background: "white", color: "#475569", border: "1px solid #e2e8f0" }}
                        >
                          Level {l}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "#334155" }}>{selected.level ? `Level ${selected.level}` : "Not set"}</p>
                  )}
                </div>
                <div className="rounded-xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#64748b" }}>Project Assignments ({selected.assignments.length})</p>
                  {selected.assignments.length === 0 ? (
                    <p className="text-sm" style={{ color: "#94a3b8" }}>No project assignments.</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.assignments.map((a) => (
                        <div key={a.id} className="rounded-lg p-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-mono font-semibold" style={{ color: "#0891b2" }}>{a.project ? projectCode(a.project) : `Study #${a.study}`}</p>
                              <p className="text-xs font-medium mt-0.5 line-clamp-2" style={{ color: "#334155" }}>{assignmentTarget(a)}</p>
                              <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                                {a.role_label || "Project Staff"} · {a.start_date} → {a.end_date ?? "present"}
                              </p>
                            </div>
                            {a.is_active ? <Pill bg="#d1fae5" color="#166534">Active</Pill> : <Pill>Ended</Pill>}
                          </div>
                          {canManage && a.is_active && (
                            <button onClick={() => endAssignment(a)} className="mt-2 text-xs font-bold" style={{ color: "#dc2626" }}>
                              End assignment
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <NoActualData hint={canManage ? 'Use "Assign to Project" to add project personnel.' : undefined} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((person) => {
              const active = person.assignments.filter((a) => a.is_active);
              const depts = [...new Set(person.assignments.map((a) => a.department).filter(Boolean))];
              return (
                <div
                  key={person.id}
                  onClick={() => setSelectedId(person.id)}
                  className="rounded-xl p-5 cursor-pointer transition-all hover:shadow-md hover:border-[#0891b2]"
                  style={{ background: "white", border: "1px solid #e2e8f0" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ background: LEVEL_COLORS[person.level ?? 3] }}
                    >
                      {person.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate" style={{ color: "#0d2a5e" }}>{person.email}</p>
                      </div>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: "#0891b2" }}>
                        {person.level ? `Staff Level ${person.level}` : "No level set"}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "#64748b" }}>{active[0]?.role_label || "Project Staff"}</p>
                      <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{depts.join(" · ") || "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "#f1f5f9" }}>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>
                      {active.length} active assignment{active.length !== 1 ? "s" : ""}
                    </p>
                    {active.length > 0 ? <Pill bg="#d1fae5" color="#166534">Active</Pill> : <Pill>Inactive</Pill>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {view === "assignments" && (
        <SectionCard
          title="Assignments"
          aside={
            <select
              value={activeOnly ? "active" : "all"}
              onChange={(e) => setActiveOnly(e.target.value === "active")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
              style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
            >
              <option value="active">Active only</option>
              <option value="all">All assignments</option>
            </select>
          }
        >
          {isLoading ? (
            <SkeletonRows />
          ) : visibleAssignments.length === 0 ? (
            <div className="p-4"><NoActualData /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <TableHead cols={["Staff", "Level", "Assigned To", "Role", "Department", "Period", ...(canManage ? [""] : [])]} />
                <tbody>
                  {visibleAssignments
                    .filter((a) => a.user_detail.email.toLowerCase().includes(q))
                    .map((a) => {
                      const level = profiles.find((p) => p.user === a.user)?.staff_level;
                      return (
                        <tr key={a.id} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                          <td className="px-4 py-2.5 font-semibold" style={{ color: "#0d2a5e" }}>{a.user_detail.email}</td>
                          <td className="px-4 py-2.5" style={{ color: "#475569" }}>{level ? `Level ${level}` : "—"}</td>
                          <td className="px-4 py-2.5" style={{ color: "#334155" }}>{assignmentTarget(a)}</td>
                          <td className="px-4 py-2.5" style={{ color: "#475569" }}>{a.role_label || "—"}</td>
                          <td className="px-4 py-2.5" style={{ color: "#475569" }}>{deptCell(a)}</td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: "#64748b" }}>{a.start_date} → {a.end_date ?? "present"}</td>
                          {canManage && (
                            <td className="px-4 py-2.5 text-right">
                              {a.is_active && (
                                <button onClick={() => endAssignment(a)} className={BTN_SOFT} style={{ background: "#fee2e2", color: "#dc2626" }}>
                                  End
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {view === "collaboration" && (
        <SectionCard
          title="Cross-Departmental Collaboration"
          aside={
            <button
              onClick={() => setCrossOnly((v) => !v)}
              className={BTN_SOFT}
              style={crossOnly ? { background: "#faf5ff", color: "#6b21a8" } : BTN_GHOST_STYLE}
            >
              {crossOnly ? "Showing cross-department only" : "Show cross-department only"}
            </button>
          }
        >
          {collab === null ? (
            <SkeletonRows />
          ) : collab.length === 0 ? (
            <div className="p-4"><NoActualData hint="Departments come from each active assignment." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <TableHead cols={["Project", "Title", "Departments", "Count", "Collaboration"]} />
                <tbody>
                  {collab.map((c) => (
                    <tr key={c.project} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                      <td className="px-4 py-2.5 font-mono font-bold" style={{ color: "#0891b2" }}>{c.project_code}</td>
                      <td className="px-4 py-2.5" style={{ color: "#334155" }}>{c.title}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {c.departments.length ? c.departments.map((d) => <Pill key={d} bg="#e0eaf7" color="#0d2a5e">{d}</Pill>) : <span style={{ color: "#94a3b8" }}>—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono" style={{ color: "#0d2a5e" }}>{c.department_count}</td>
                      <td className="px-4 py-2.5">
                        {c.is_cross_departmental ? <Pill bg="#faf5ff" color="#6b21a8">Cross-departmental</Pill> : <Pill>Single department</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {showLevel && (
        <Modal
          title="Set Staff Level"
          onClose={() => setShowLevel(false)}
          footer={
            <>
              <button onClick={() => setShowLevel(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
              <button onClick={saveLevel} disabled={saving} className={BTN_PRIMARY + " text-sm"} style={BTN_PRIMARY_STYLE}>{saving ? "Saving…" : "Save Level"}</button>
            </>
          }
        >
          <Field label="Project Staff" required>
            <select className={INPUT_CLS} style={invalidStyle(attempted && !levelForm.user)} value={levelForm.user} onChange={(e) => setLevelForm((f) => ({ ...f, user: e.target.value }))}>
              <option value="">{unprofiled.length ? "Select staff without a level" : "All visible project staff already have a level"}</option>
              {unprofiled.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </Field>
          <Field label="Level" required>
            <select className={INPUT_CLS} style={invalidStyle(attempted && !levelForm.staff_level)} value={levelForm.staff_level} onChange={(e) => setLevelForm((f) => ({ ...f, staff_level: e.target.value }))}>
              <option value="">Select level</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>Level {l}</option>
              ))}
            </select>
          </Field>
        </Modal>
      )}

      {showAssign && (
        <Modal
          title="Assign to Project"
          onClose={() => setShowAssign(false)}
          footer={
            <>
              <button onClick={() => setShowAssign(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
              <button onClick={assign} disabled={saving} className={BTN_PRIMARY + " text-sm"} style={BTN_PRIMARY_STYLE}>{saving ? "Assigning…" : "Assign Staff"}</button>
            </>
          }
        >
          <Field label="Project Staff" required>
            <select className={INPUT_CLS} style={invalidStyle(attempted && !assignForm.user)} value={assignForm.user} onChange={(e) => setAssignForm((f) => ({ ...f, user: e.target.value }))}>
              <option value="">{staffUsers.length ? "Select staff" : "No project staff available to you"}</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assign To">
              <select className={INPUT_CLS} style={INPUT_STYLE} value={assignForm.target} onChange={(e) => setAssignForm((f) => ({ ...f, target: e.target.value, study: "" }))}>
                <option value="project">A project</option>
                <option value="study">A study</option>
              </select>
            </Field>
            <Field label="Project" required>
              <select className={INPUT_CLS} style={invalidStyle(attempted && !assignForm.project)} value={assignForm.project} onChange={(e) => pickProject(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
                ))}
              </select>
            </Field>
          </div>
          {assignForm.target === "study" && (
            <Field label="Study" required>
              <select className={INPUT_CLS} style={invalidStyle(attempted && !assignForm.study)} value={assignForm.study} onChange={(e) => setAssignForm((f) => ({ ...f, study: e.target.value }))}>
                <option value="">{studies.length ? "Select study" : "No studies for this project"}</option>
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role Label">
              <input className={INPUT_CLS} style={INPUT_STYLE} value={assignForm.role_label} onChange={(e) => setAssignForm((f) => ({ ...f, role_label: e.target.value }))} placeholder="e.g. Research Assistant" />
            </Field>
            <Field label="Department">
              <input className={INPUT_CLS} style={INPUT_STYLE} value={assignForm.department} onChange={(e) => setAssignForm((f) => ({ ...f, department: e.target.value }))} placeholder="Defaults to the user's office" />
            </Field>
          </div>
          <Field label="Start Date" required>
            <input type="date" className={INPUT_CLS} style={invalidStyle(attempted && !assignForm.start_date)} value={assignForm.start_date} onChange={(e) => setAssignForm((f) => ({ ...f, start_date: e.target.value }))} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Personnel Coordination">
        <StaffContent />
      </AppShell>
    </ProtectedRoute>
  );
}
