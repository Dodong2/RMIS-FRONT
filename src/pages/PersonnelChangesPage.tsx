import { useEffect, useState } from "react";
import { personnelApi } from "../lib/personnelApi";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { researchApi } from "../lib/researchApi";
import { assignmentsQuery, personnelChangesQuery, programsQuery, queryKeys, usersByRoleQuery, useProjects } from "../lib/queries";
import { errorMessage } from "../lib/errorMessage";
import type {
  ChangeStatus,
  ChangeType,
  PersonnelChange,
} from "../types/personnel";
import type { Study } from "../types/research";
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
import { personName } from "../lib/roles";
import { UserSelect } from "../components/common/UserPicker";

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

  const queryClient = useQueryClient();
  const changesQ = useQuery(personnelChangesQuery);
  const programsQ = useQuery(programsQuery);
  const projectsQ = useProjects();
  const changes = changesQ.data ?? [];
  const programs = programsQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const [studies, setStudies] = useState<Study[]>([]);
  const assignments = useQuery({ ...assignmentsQuery({ active: true }), enabled: canManage }).data ?? [];
  const isLoading = changesQ.isPending || programsQ.isPending || projectsQ.isPending;
  const loadFailed = changesQ.isError || programsQ.isError || projectsQ.isError;
  const [attempted, setAttempted] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const candidateRole = form.change_type === "staff" ? "project_staff" : LEAD_ROLE_BY_RECORD[form.record_type];
  const candidatesQ = useQuery({ ...usersByRoleQuery(candidateRole), enabled: canManage, placeholderData: keepPreviousData });
  const candidates = candidatesQ.isError ? [] : (candidatesQ.data ?? []);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clearanceForm, setClearanceForm] = useState({ items: "", par_number: "", remarks: "" });
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

  const load = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.personnelChanges });
    queryClient.invalidateQueries({ queryKey: queryKeys.programs });
    queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects });
  };

  useEffect(() => {
    if (loadFailed) notify.error("Could not load personnel changes. Check your connection and refresh.");
  }, [loadFailed]);

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

  const createMutation = useMutation({
    mutationFn: (outgoing: number) =>
      personnelApi.createChange({
        change_type: form.change_type,
        program: form.change_type === "leader" && form.record_type === "program" ? Number(form.program) : null,
        project: form.change_type === "leader" && form.record_type === "project" ? Number(form.project) : null,
        study: form.change_type === "leader" && form.record_type === "study" ? Number(form.study) : null,
        assignment: form.change_type === "staff" ? Number(form.assignment) : null,
        outgoing,
        incoming: Number(form.incoming),
        reason: form.reason,
      }),
    onSuccess: () => {
      setAttempted(false);
      notify.success("Personnel change initiated. Property clearance is now required.");
      setForm(EMPTY_FORM);
      setStudies([]);
      load();
    },
    onError: (err) => notify.error(errorMessage(err, "Could not initiate the personnel change.")),
  });
  const isCreating = createMutation.isPending;

  const handleCreate = () => {
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
      outgoing = currentLead() ?? undefined;
      if (!outgoing) {
        notify.error("Select the project or study to change the leader of. A study with no leader yet has no leader to hand over.");
        return;
      }
    }

    createMutation.mutate(outgoing);
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
    queryClient.setQueryData<PersonnelChange[]>(queryKeys.personnelChanges, (prev) => prev?.map((c) => (c.id === updated.id ? updated : c)));

  const clearanceMutation = useMutation({
    mutationFn: (v: { id: number; acknowledge: boolean }) => personnelApi.updateClearance(v.id, { ...clearanceForm, acknowledge: v.acknowledge }),
    onSuccess: (updated, v) => {
      replaceChange(updated);
      notify.success(v.acknowledge ? "Clearance signed off." : "Clearance details saved.");
    },
    onError: (err) => notify.error(errorMessage(err, "Could not update the clearance.")),
  });
  const completeMutation = useMutation({
    mutationFn: (id: number) => personnelApi.completeChange(id),
    onSuccess: (updated) => {
      replaceChange(updated);
      notify.success("Personnel change completed.");
      load();
    },
    onError: (err) => notify.error(errorMessage(err, "Could not complete the personnel change.")),
  });
  const isSaving = clearanceMutation.isPending || completeMutation.isPending;

  const handleClearance = (acknowledge: boolean) => {
    if (!selected) return;
    setAttemptedSignOff(acknowledge);
    if (acknowledge && !clearanceForm.par_number.trim()) {
      notify.error("PAR number is required to sign off the clearance.");
      return;
    }
    clearanceMutation.mutate({ id: selected.id, acknowledge });
  };

  const handleComplete = () => {
    if (!selected) return;
    completeMutation.mutate(selected.id);
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
                    <option value="project">Project</option>
                    <option value="study">Study</option>
                  </select>
                </Field>
                {form.record_type === "program" ? (
                  <Field label="Program" required>
                    <select className={INPUT_CLS} style={invalidStyle(attempted && !form.program)} value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))}>
                      <option value="">{programs.length ? "Select program" : "No programs registered yet"}</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.title} — {personName(p.lead_detail)}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Project" required>
                    <select className={INPUT_CLS} style={invalidStyle(attempted && !form.project)} value={form.project} onChange={(e) => handleProjectPick(e.target.value)}>
                      <option value="">{projects.length ? "Select project" : "No projects registered yet"}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.project_code} — {personName(p.lead_detail)}</option>
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
                        <option key={s.id} value={s.id}>{s.title} — {s.lead_detail ? personName(s.lead_detail) : "no study leader"}</option>
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
                    <option key={a.id} value={a.id}>{personName(a.user_detail)} — {a.project ? projectTitle(a.project) : `Study #${a.study}`}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Incoming" required>
              <UserSelect
                users={candidates}
                value={form.incoming}
                onChange={(incoming) => setForm((f) => ({ ...f, incoming }))}
                placeholder={candidates.length ? "Search replacement by name or e-mail" : "No eligible users available"}
                invalid={attempted && !form.incoming}
              />
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
                    <td className="px-4 py-2.5" style={{ color: "#475569" }}>{personName(c.outgoing_detail)}</td>
                    <td className="px-4 py-2.5" style={{ color: "#475569" }}>{personName(c.incoming_detail)}</td>
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
