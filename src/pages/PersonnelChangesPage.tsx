import { useEffect, useState } from "react";
import { ArrowRightLeft, Plus } from "lucide-react";
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
import { FormAlert } from "../components/common/FormAlert";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clearanceForm, setClearanceForm] = useState({ items: "", par_number: "", remarks: "" });
  const [isSaving, setIsSaving] = useState(false);

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

  const load = async () => {
    setIsLoading(true);
    try {
      const [changeList, programList, projectList] = await Promise.all([
        personnelApi.getChanges(),
        researchApi.getPrograms(),
        researchApi.getProjects(),
      ]);
      setChanges(changeList);
      setPrograms(programList);
      setProjects(projectList);
      setError("");
    } catch {
      setError("Could not load personnel changes. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }

    if (canManage) {
      try {
        setAssignments(await personnelApi.getAssignments({ active: true }));
      } catch {
        setAssignments([]);
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

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
    setError("");
    setSuccess("");
    if (!form.incoming || !form.reason.trim()) {
      setError("Incoming person and reason are required.");
      return;
    }

    let outgoing: number | undefined;
    if (form.change_type === "staff") {
      outgoing = assignments.find((a) => String(a.id) === form.assignment)?.user;
      if (!form.assignment || !outgoing) {
        setError("Select the assignment to change.");
        return;
      }
    } else {
      outgoing = currentLead();
      if (!outgoing) {
        setError("Select the program, project, or study to change the leader of.");
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
      setSuccess("Personnel change initiated. Property clearance is now required.");
      setForm(EMPTY_FORM);
      setStudies([]);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not initiate the personnel change."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelect = (c: PersonnelChange) => {
    setSelectedId(c.id);
    setClearanceForm({
      items: c.clearance.items,
      par_number: c.clearance.par_number,
      remarks: c.clearance.remarks,
    });
    setError("");
    setSuccess("");
  };

  const replaceChange = (updated: PersonnelChange) =>
    setChanges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  const handleClearance = async (acknowledge: boolean) => {
    if (!selected) return;
    setError("");
    setSuccess("");
    if (acknowledge && !clearanceForm.par_number.trim()) {
      setError("PAR number is required to sign off the clearance.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await personnelApi.updateClearance(selected.id, {
        ...clearanceForm,
        acknowledge,
      });
      replaceChange(updated);
      setSuccess(acknowledge ? "Clearance signed off." : "Clearance details saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not update the clearance."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!selected) return;
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      const updated = await personnelApi.completeChange(selected.id);
      replaceChange(updated);
      setSuccess("Personnel change completed.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not complete the personnel change."));
    } finally {
      setIsSaving(false);
    }
  };

  const clearanceLocked = selected?.status === "cleared" || selected?.status === "completed";

  return (
    <div>
      <PageHeader
        title="Personnel changes"
        description="Replace a leader or project staff. Property clearance must be signed off before the change takes effect."
      />

      <FormAlert tone="error" message={error} className="mb-4" />
      <FormAlert tone="success" message={success} className="mb-4" />

      {canManage && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Initiate a Change</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">Change Type</Label>
              <Select
                value={form.change_type}
                onValueChange={(v) => setForm({ ...EMPTY_FORM, change_type: v as ChangeType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="staff">Project Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.change_type === "leader" ? (
              <>
                <div>
                  <Label className="mb-1 block text-xs">Applies To</Label>
                  <Select
                    value={form.record_type}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, record_type: v as RecordType, program: "", project: "", study: "", incoming: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="program">Program</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="study">Study</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.record_type === "program" ? (
                  <div>
                    <Label className="mb-1 block text-xs">Program</Label>
                    <Select value={form.program} onValueChange={(v) => setForm((f) => ({ ...f, program: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.title} — {p.lead_detail.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label className="mb-1 block text-xs">Project</Label>
                    <Select value={form.project} onValueChange={handleProjectPick}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.project_code} — {p.lead_detail.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.record_type === "study" && (
                  <div>
                    <Label className="mb-1 block text-xs">Study</Label>
                    <Select
                      value={form.study}
                      onValueChange={(v) => setForm((f) => ({ ...f, study: v }))}
                      disabled={studies.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select study" />
                      </SelectTrigger>
                      <SelectContent>
                        {studies.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.title} — {s.lead_detail.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <div>
                <Label className="mb-1 block text-xs">Active Assignment</Label>
                <Select value={form.assignment} onValueChange={(v) => setForm((f) => ({ ...f, assignment: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.user_detail.email} — {a.project ? projectTitle(a.project) : `Study #${a.study}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="mb-1 block text-xs">Incoming</Label>
              <Select value={form.incoming} onValueChange={(v) => setForm((f) => ({ ...f, incoming: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select replacement" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs">Reason</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Why is this change needed?"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={isCreating}>
              <Plus className="size-4" />
              {isCreating ? "Initiating..." : "Initiate Change"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">All Changes</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Type</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Outgoing</TableHead>
              <TableHead>Incoming</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={3} columns={6} />
            ) : changes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={<ArrowRightLeft className="size-7" />}
                    title="No personnel changes"
                    description="Leader and staff replacements will appear here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              changes.map((c) => (
                <TableRow key={c.id} data-state={c.id === selectedId ? "selected" : undefined}>
                  <TableCell className="capitalize">{c.change_type}</TableCell>
                  <TableCell>{targetLabel(c)}</TableCell>
                  <TableCell>{c.outgoing_detail.email}</TableCell>
                  <TableCell>{c.incoming_detail.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABELS[c.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => handleSelect(c)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {selected && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-navy">
              Change #{selected.id} — {targetLabel(selected)}
            </h3>
            <Badge variant="outline">{STATUS_LABELS[selected.status]}</Badge>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{selected.reason}</p>

          <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Property Clearance (PAR)
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">PAR Number</Label>
              <Input
                value={clearanceForm.par_number}
                onChange={(e) => setClearanceForm((f) => ({ ...f, par_number: e.target.value }))}
                disabled={!canClear || clearanceLocked}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Property Items to Return</Label>
              <Input
                value={clearanceForm.items}
                onChange={(e) => setClearanceForm((f) => ({ ...f, items: e.target.value }))}
                disabled={!canClear || clearanceLocked}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Remarks</Label>
              <Input
                value={clearanceForm.remarks}
                onChange={(e) => setClearanceForm((f) => ({ ...f, remarks: e.target.value }))}
                disabled={!canClear || clearanceLocked}
              />
            </div>
          </div>

          {selected.clearance.acknowledged_at && (
            <p className="mt-3 text-xs text-muted-foreground">
              Signed off {new Date(selected.clearance.acknowledged_at).toLocaleString()}
            </p>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {canClear && !clearanceLocked && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleClearance(false)} disabled={isSaving}>
                  Save Details
                </Button>
                <Button size="sm" onClick={() => handleClearance(true)} disabled={isSaving}>
                  Sign Off Clearance
                </Button>
              </>
            )}
            {canManage && selected.status === "cleared" && (
              <Button size="sm" onClick={handleComplete} disabled={isSaving}>
                Complete Change
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function PersonnelChangesPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Personnel changes">
        <PersonnelChangesContent />
      </AppShell>
    </ProtectedRoute>
  );
}
