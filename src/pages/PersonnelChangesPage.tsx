import { useEffect, useState } from "react";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type {
  ChangeStatus,
  ChangeType,
  PersonnelChange,
  ProjectAssignment,
} from "../types/personnel";
import type { Program, Project, Study } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
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
import { notify } from "../lib/notify";

const MANAGE_CODES = ["system_admin", "crc_chair", "drd", "riuh"];
const CLEARANCE_CODES = [...MANAGE_CODES, "procurement_officer_lib"];

const STATUS_LABELS: Record<ChangeStatus, string> = {
  initiated: "Initiated",
  clearance_pending: "Clearance Pending",
  cleared: "Cleared",
  completed: "Completed",
};

const LEAD_ROLE_BY_RECORD = {
  program: "program_leader",
  project: "project_leader",
  study: "study_leader",
} as const;

type RecordType = keyof typeof LEAD_ROLE_BY_RECORD;

const EMPTY_FORM = {
  change_type: "leader" as ChangeType,
  record_type: "project" as RecordType,
  program: "",
  project: "",
  study: "",
  assignment: "",
  incoming: "",
  reason: "",
};

function PersonnelChangesContent() {
  const { user } = useAuth();
  const canManage = !!user?.role && MANAGE_CODES.includes(user.role.code);
  const canClear = !!user?.role && CLEARANCE_CODES.includes(user.role.code);

  const [changes, setChanges] = useState<PersonnelChange[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [candidates, setCandidates] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attempted, setAttempted] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clearanceForm, setClearanceForm] = useState({ items: "", par_number: "", remarks: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [attemptedSignOff, setAttemptedSignOff] = useState(false);

  const selected = changes.find((c) => c.id === selectedId) ?? null;

  const projectTitle = (id: number | null) => projects.find((p) => p.id === id)?.title ?? `#${id}`;

  const targetLabel = (c: PersonnelChange) => {
    if (c.program) return `Program: ${programs.find((p) => p.id === c.program)?.title ?? `#${c.program}`}`;
    if (c.project) return `Project: ${projectTitle(c.project)}`;
    if (c.study) return `Study #${c.study}`;
    const a = assignments.find((x) => x.id === c.assignment);
    if (a?.project) return `Assignment: ${projectTitle(a.project)}`;
    return `Assignment #${c.assignment}`;
  };

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    Promise.all([personnelApi.getChanges(), researchApi.getPrograms(), researchApi.getProjects()])
      .then(([changeList, programList, projectList]) => {
        if (!active) return;
        setChanges(changeList);
        setPrograms(programList);
        setProjects(projectList);
      })
      .catch(() => active && notify.error("Could not load personnel changes. Check your connection and refresh."))
      .finally(() => active && setIsLoading(false));
    if (canManage) {
      personnelApi
        .getAssignments({ active: true })
        .then((a) => active && setAssignments(a))
        .catch(() => active && setAssignments([]));
    }
    return () => {
      active = false;
    };
  }, [canManage, reloadKey]);

  useEffect(() => {
    if (!canManage) return;
    const code = form.change_type === "staff" ? "project_staff" : LEAD_ROLE_BY_RECORD[form.record_type];
    let cancelled = false;
    researchApi
      .getUsersByRole(code)
      .then((users) => {
        if (!cancelled) setCandidates(users);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, form.change_type, form.record_type]);

  const handleProjectPick = async (value: string) => {
    setForm((f) => ({ ...f, project: value, study: "" }));
    if (form.record_type !== "study") return;
    try {
      setStudies(await researchApi.getStudies(Number(value)));
    } catch {
      setStudies([]);
    }
  };

  const currentLead = () => {
    if (form.record_type === "program") return programs.find((p) => String(p.id) === form.program)?.lead;
    if (form.record_type === "project") return projects.find((p) => String(p.id) === form.project)?.lead;
    return studies.find((s) => String(s.id) === form.study)?.lead;
  };

  const handleCreate = async () => {
    setAttempted(true);
    if (!form.incoming || !form.reason.trim()) {
      notify.error("Incoming person and reason are required.");
      return;
    }

    let outgoing: number | undefined;
    if (form.change_type === "staff") {
      outgoing = assignments.find((a) => String(a.id) === form.assignment)?.user;
      if (!form.assignment || !outgoing) {
        notify.error("Select the assignment to change.");
        return;
      }
    } else {
      outgoing = currentLead();
      if (!outgoing) {
        notify.error("Select the program, project, or study to change the leader of.");
        return;
      }
    }

    setIsCreating(true);
    try {
      await personnelApi.createChange({
        change_type: form.change_type,
        program: form.change_type === "leader" && form.record_type === "program" ? Number(form.program) : null,
        project: form.change_type === "leader" && form.record_type === "project" ? Number(form.project) : null,
        study: form.change_type === "leader" && form.record_type === "study" ? Number(form.study) : null,
        assignment: form.change_type === "staff" ? Number(form.assignment) : null,
        outgoing,
        incoming: Number(form.incoming),
        reason: form.reason,
      });
      setAttempted(false);
      notify.success("Personnel change initiated. Property clearance is now required.");
      setForm(EMPTY_FORM);
      setStudies([]);
      load();
    } catch (err) {
      notify.error(errorMessage(err, "Could not initiate the personnel change."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelect = (c: PersonnelChange) => {
    setSelectedId(c.id);
    setAttemptedSignOff(false);
    setClearanceForm({
      items: c.clearance.items,
      par_number: c.clearance.par_number,
      remarks: c.clearance.remarks,
    });
  };

  const replaceChange = (updated: PersonnelChange) =>
    setChanges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  const handleClearance = async (acknowledge: boolean) => {
    if (!selected) return;
    setAttemptedSignOff(acknowledge);
    if (acknowledge && !clearanceForm.par_number.trim()) {
      notify.error("PAR number is required to sign off the clearance.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await personnelApi.updateClearance(selected.id, {
        ...clearanceForm,
        acknowledge,
      });
      replaceChange(updated);
      notify.success(acknowledge ? "Clearance signed off." : "Clearance details saved.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the clearance."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const updated = await personnelApi.completeChange(selected.id);
      replaceChange(updated);
      notify.success("Personnel change completed.");
      load();
    } catch (err) {
      notify.error(errorMessage(err, "Could not complete the personnel change."));
    } finally {
      setIsSaving(false);
    }
  };

  const clearanceLocked = selected?.status === "cleared" || selected?.status === "completed";

  const statusPill = (s: ChangeStatus) => {
    const m: Record<ChangeStatus, [string, string]> = {
      initiated: ["#e0f2fe", "#0369a1"],
      clearance_pending: ["#fef3c7", "#92400e"],
      cleared: ["#faf5ff", "#6b21a8"],
      completed: ["#d1fae5", "#166534"],
    };
    return <Pill bg={m[s][0]} color={m[s][1]}>{STATUS_LABELS[s]}</Pill>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Changes" value={isLoading ? "…" : changes.length} />
        <KpiCard label="Clearance Pending" value={isLoading ? "…" : changes.filter((c) => c.status === "initiated" || c.status === "clearance_pending").length} color="#92400e" />
        <KpiCard label="Cleared" value={isLoading ? "…" : changes.filter((c) => c.status === "cleared").length} color="#6b21a8" />
        <KpiCard label="Completed" value={isLoading ? "…" : changes.filter((c) => c.status === "completed").length} color="#166534" />
      </div>

      <div className="rounded-xl p-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
        Replace a leader or project staff. The outgoing person's property clearance (PAR) must be signed off before the change takes effect.
      </div>

      {canManage && (
        <SectionCard title="Initiate a Change">
          <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Change Type">
              <select className={INPUT_CLS} style={INPUT_STYLE} value={form.change_type} onChange={(e) => setForm({ ...EMPTY_FORM, change_type: e.target.value as ChangeType })}>
                <option value="leader">Leader</option>
                <option value="staff">Project Staff</option>
              </select>
            </Field>

            {form.change_type === "leader" ? (
              <>
                <Field label="Applies To">
                  <select
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    value={form.record_type}
                    onChange={(e) => setForm((f) => ({ ...f, record_type: e.target.value as RecordType, program: "", project: "", study: "", incoming: "" }))}
                  >
                    <option value="program">Program</option>
                    <option value="project">Project</option>
                    <option value="study">Study</option>
                  </select>
                </Field>
                {form.record_type === "program" ? (
                  <Field label="Program" required>
                    <select className={INPUT_CLS} style={invalidStyle(attempted && !form.program)} value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))}>
                      <option value="">{programs.length ? "Select program" : "No programs registered yet"}</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.title} — {p.lead_detail.email}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Project" required>
                    <select className={INPUT_CLS} style={invalidStyle(attempted && !form.project)} value={form.project} onChange={(e) => handleProjectPick(e.target.value)}>
                      <option value="">{projects.length ? "Select project" : "No projects registered yet"}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.project_code} — {p.lead_detail.email}</option>
                      ))}
                    </select>
                  </Field>
                )}
                {form.record_type === "study" && (
                  <Field label="Study" required>
                    <select
                      className={INPUT_CLS}
                      style={invalidStyle(attempted && !form.study)}
                      value={form.study}
                      disabled={studies.length === 0}
                      onChange={(e) => setForm((f) => ({ ...f, study: e.target.value }))}
                    >
                      <option value="">{studies.length ? "Select study" : "No studies for this project"}</option>
                      {studies.map((s) => (
                        <option key={s.id} value={s.id}>{s.title} — {s.lead_detail.email}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            ) : (
              <Field label="Active Assignment" required>
                <select className={INPUT_CLS} style={invalidStyle(attempted && !form.assignment)} value={form.assignment} onChange={(e) => setForm((f) => ({ ...f, assignment: e.target.value }))}>
                  <option value="">Select assignment</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>{a.user_detail.email} — {a.project ? projectTitle(a.project) : `Study #${a.study}`}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Incoming" required>
              <select className={INPUT_CLS} style={invalidStyle(attempted && !form.incoming)} value={form.incoming} onChange={(e) => setForm((f) => ({ ...f, incoming: e.target.value }))}>
                <option value="">{candidates.length ? "Select replacement" : "No eligible users available"}</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </Field>
            <Field label="Reason" required className="sm:col-span-2">
              <input
                className={INPUT_CLS}
                style={invalidStyle(attempted && !form.reason.trim())}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Why is this change needed?"
              />
            </Field>
          </div>
          <div className="px-5 pb-5 flex justify-end">
            <button onClick={handleCreate} disabled={isCreating} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isCreating ? "Initiating…" : "+ Initiate Change"}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="All Changes">
        {isLoading ? (
          <SkeletonRows />
        ) : changes.length === 0 ? (
          <div className="p-4"><NoActualData hint="Leader and staff replacements will appear here." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <TableHead cols={["Type", "Applies To", "Outgoing", "Incoming", "Status", ""]} />
              <tbody>
                {changes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t hover:bg-slate-50 cursor-pointer"
                    style={{ borderColor: "#f1f5f9", background: c.id === selectedId ? "#f0f9ff" : undefined }}
                    onClick={() => handleSelect(c)}
                  >
                    <td className="px-4 py-2.5 capitalize font-semibold" style={{ color: "#0d2a5e" }}>{c.change_type}</td>
                    <td className="px-4 py-2.5" style={{ color: "#334155" }}>{targetLabel(c)}</td>
                    <td className="px-4 py-2.5" style={{ color: "#475569" }}>{c.outgoing_detail.email}</td>
                    <td className="px-4 py-2.5" style={{ color: "#475569" }}>{c.incoming_detail.email}</td>
                    <td className="px-4 py-2.5">{statusPill(c.status)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button className={BTN_SOFT} style={BTN_SOFT_STYLE}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {selected && (
        <SectionCard title={`Change #${selected.id} — ${targetLabel(selected)}`} aside={statusPill(selected.status)}>
          <div className="p-5 space-y-4">
            <p className="text-sm" style={{ color: "#475569" }}>{selected.reason}</p>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Property Clearance (PAR)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="PAR Number" required>
                <input
                  className={INPUT_CLS}
                  style={invalidStyle(attemptedSignOff && !clearanceForm.par_number.trim())}
                  value={clearanceForm.par_number}
                  onChange={(e) => setClearanceForm((f) => ({ ...f, par_number: e.target.value }))}
                  disabled={!canClear || clearanceLocked}
                />
              </Field>
              <Field label="Property Items to Return">
                <input
                  className={INPUT_CLS}
                  style={INPUT_STYLE}
                  value={clearanceForm.items}
                  onChange={(e) => setClearanceForm((f) => ({ ...f, items: e.target.value }))}
                  disabled={!canClear || clearanceLocked}
                />
              </Field>
              <Field label="Remarks">
                <input
                  className={INPUT_CLS}
                  style={INPUT_STYLE}
                  value={clearanceForm.remarks}
                  onChange={(e) => setClearanceForm((f) => ({ ...f, remarks: e.target.value }))}
                  disabled={!canClear || clearanceLocked}
                />
              </Field>
            </div>
            {selected.clearance.acknowledged_at && (
              <p className="text-xs" style={{ color: "#059669" }}>Signed off {new Date(selected.clearance.acknowledged_at).toLocaleString()}</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {canClear && !clearanceLocked && (
                <>
                  <button onClick={() => handleClearance(false)} disabled={isSaving} className={BTN_SOFT} style={BTN_GHOST_STYLE}>Save Details</button>
                  <button onClick={() => handleClearance(true)} disabled={isSaving} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>Sign Off Clearance</button>
                </>
              )}
              {canManage && selected.status === "cleared" && (
                <button onClick={handleComplete} disabled={isSaving} className={BTN_PRIMARY} style={{ background: "#059669" }}>Complete Change</button>
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default function PersonnelChangesPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Personnel Changes">
        <PersonnelChangesContent />
      </AppShell>
    </ProtectedRoute>
  );
}
