import { useEffect, useMemo, useState } from "react";
import { complianceApi } from "../lib/complianceApi";
import { documentApi } from "../lib/documentApi";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type { ComplianceRequirement } from "../types/compliance";
import type { ProjectDocument } from "../types/document";
import type { ProjectAssignment } from "../types/personnel";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { Field, ProtoModal, SkeletonRows } from "../components/common/proto";
import { IntegrityRecords } from "../components/compliance/IntegrityRecords";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const ENCODE_ROLE_CODES = ["system_admin", "riuh", "program_leader", "project_leader", "study_leader"];
const MANAGE_ROLE_CODES = ["system_admin", "riuh"];
const DUE_SOON_DAYS = 7;
const DAY = 86400000;

type CompStatus = "compliant" | "submitted" | "overdue" | "due_soon" | "not_yet_due" | "returned" | "non_compliant";
type Decision = "compliant" | "returned" | "non_compliant";
type PageTab = "tracker" | "records";

const STATUS_META: Record<CompStatus, { label: string; bg: string; text: string; dot: string }> = {
  compliant: { label: "Compliant", bg: "#d1fae5", text: "#166534", dot: "#059669" },
  submitted: { label: "Submitted", bg: "#e0f2fe", text: "#0369a1", dot: "#0891b2" },
  due_soon: { label: "Due Soon", bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  overdue: { label: "Overdue", bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  not_yet_due: { label: "Not Yet Due", bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  returned: { label: "Returned", bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  non_compliant: { label: "Non-Compliant", bg: "#f5f3ff", text: "#6b21a8", dot: "#a855f7" },
};

const DECISION_META: Record<Decision, { label: string; color: string; bg: string; icon: string }> = {
  compliant: { label: "Mark Compliant", color: "#059669", bg: "#d1fae5", icon: "✅" },
  returned: { label: "Return for Revision", color: "#dc2626", bg: "#fee2e2", icon: "↩️" },
  non_compliant: { label: "Mark Non-Compliant", color: "#7c3aed", bg: "#faf5ff", icon: "⛔" },
};

const daysUntil = (date: string, now: number) => Math.round((new Date(date + "T00:00:00").getTime() - now) / DAY);

function statusOf(r: ComplianceRequirement, now: number): CompStatus {
  if (r.status === "compliant" || r.status === "non_compliant" || r.status === "submitted") return r.status;
  if (r.is_overdue) return "overdue";
  if (r.status === "returned") return "returned";
  return daysUntil(r.deadline, now) <= DUE_SOON_DAYS ? "due_soon" : "not_yet_due";
}

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function StatusBadge({ s }: { s: CompStatus }) {
  const m = STATUS_META[s];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function DaysLeft({ deadline, status, now }: { deadline: string; status: CompStatus; now: number }) {
  if (status === "compliant" || status === "non_compliant" || status === "submitted") return null;
  const diff = daysUntil(deadline, now);
  if (diff < 0) return <span className="text-xs font-bold" style={{ color: "#dc2626" }}>{Math.abs(diff)}d overdue</span>;
  if (diff === 0) return <span className="text-xs font-bold" style={{ color: "#d97706" }}>Due today</span>;
  return <span className="text-xs font-mono" style={{ color: diff <= DUE_SOON_DAYS ? "#d97706" : "#94a3b8" }}>{diff}d left</span>;
}

function DefineModal({ projects, onClose, onSaved }: { projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ project: projects[0] ? String(projects[0].id) : "", title: "", description: "", responsible: "", deadline: "" });
  const [team, setTeam] = useState<ProjectAssignment[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const project = projects.find((p) => String(p.id) === form.project);

  useEffect(() => {
    let active = true;
    if (!form.project) return;
    personnelApi
      .getAssignments({ project: Number(form.project), active: true })
      .then((a) => active && setTeam(a))
      .catch(() => active && setTeam([]));
    return () => {
      active = false;
    };
  }, [form.project]);

  const people = useMemo(() => {
    const list = [...(project ? [project.lead_detail] : []), ...team.map((a) => a.user_detail)];
    return list.filter((p, i) => list.findIndex((q) => q.id === p.id) === i);
  }, [project, team]);

  const save = async () => {
    setAttempted(true);
    if (!form.project || !form.title.trim() || !form.responsible || !form.deadline) {
      notify.error("Project, requirement, responsible person, and deadline are required.");
      return;
    }
    setSaving(true);
    try {
      await complianceApi.createRequirement({
        project: Number(form.project),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        responsible: Number(form.responsible),
        deadline: form.deadline,
      });
      notify.success("Compliance requirement defined.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not define this requirement."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Define Compliance Requirement"
      subtitle="Assign · Set deadline · Activate monitoring"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Creating…" : "Create Requirement"}
          </button>
        </>
      }
    >
      <Field label="Project" required>
        <select className={INPUT_CLS} style={invalidStyle(attempted && !form.project)} value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value, responsible: "" }))}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
          ))}
        </select>
      </Field>
      <Field label="Requirement Name" required>
        <input className={INPUT_CLS} style={invalidStyle(attempted && !form.title.trim())} value={form.title} onChange={set("title")} placeholder="e.g. Q4 Progress Report, Data Management Plan…" />
      </Field>
      <Field label="Description">
        <textarea rows={3} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={form.description} onChange={set("description")} placeholder="Detailed description of what must be submitted or accomplished…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Assigned To" required>
          <select className={INPUT_CLS} style={invalidStyle(attempted && !form.responsible)} value={form.responsible} onChange={set("responsible")}>
            <option value="">Select person</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.email}</option>
            ))}
          </select>
        </Field>
        <Field label="Deadline" required>
          <input type="date" className={INPUT_CLS} style={invalidStyle(attempted && !form.deadline)} value={form.deadline} onChange={set("deadline")} />
        </Field>
      </div>
      <p className="text-xs" style={{ color: "#94a3b8" }}>Assignable people are the project leader and the project's active team members.</p>
    </ProtoModal>
  );
}

function SubmitModal({ req, projectLabel, onClose, onSaved }: { req: ComplianceRequirement; projectLabel: string; onClose: () => void; onSaved: () => void }) {
  const [docs, setDocs] = useState<ProjectDocument[] | null>(null);
  const [document, setDocument] = useState(req.document ? String(req.document) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    documentApi
      .getDocuments({ project: req.project, current_only: true })
      .then((d) => active && setDocs(d))
      .catch(() => active && setDocs([]));
    return () => {
      active = false;
    };
  }, [req.project]);

  const save = async () => {
    setSaving(true);
    try {
      await complianceApi.submitRequirement(req.id, document ? Number(document) : null);
      notify.success("Requirement submitted for review.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit this requirement."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Submit Evidence"
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#6b21a8" }}>
            {saving ? "Submitting…" : "Submit for Review"}
          </button>
        </>
      }
    >
      <div className="rounded-xl p-3" style={{ background: "#f0f4f8" }}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Requirement</p>
        <p className="text-sm font-bold mt-0.5" style={{ color: "#0d2a5e" }}>{req.title}</p>
        <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{projectLabel} · Due {req.deadline}</p>
      </div>
      <Field label="Supporting Document (optional)">
        <select className={INPUT_CLS} style={INPUT_STYLE} value={document} onChange={(e) => setDocument(e.target.value)} disabled={docs === null}>
          <option value="">{docs === null ? "Loading documents…" : "No document attached"}</option>
          {(docs ?? []).map((d) => (
            <option key={d.id} value={d.id}>{d.file_name} (v{d.version_number})</option>
          ))}
        </select>
      </Field>
      <p className="text-xs" style={{ color: "#94a3b8" }}>
        Pick from this project's current documents. Upload new files in Document and Records Management first.
      </p>
    </ProtoModal>
  );
}

function ReviewModal({ req, responsible, onClose, onSaved }: { req: ComplianceRequirement; responsible: string; onClose: () => void; onSaved: () => void }) {
  const [action, setAction] = useState<Decision>("compliant");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const needsRemarks = action !== "compliant" && !remarks.trim();

  const save = async () => {
    if (needsRemarks) return;
    setSaving(true);
    try {
      await complianceApi.reviewRequirement(req.id, action, remarks.trim());
      notify.success(`Requirement ${action === "compliant" ? "marked compliant" : action === "returned" ? "returned for revision" : "marked non-compliant"}.`);
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not record the review."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Review Compliance"
      width="max-w-md"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={needsRemarks || saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: needsRemarks ? "#94a3b8" : DECISION_META[action].color }}>
            {saving ? "Saving…" : "Confirm"}
          </button>
        </>
      }
    >
      <div className="rounded-xl p-3" style={{ background: "#f0f4f8" }}>
        <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{req.title}</p>
        <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>Assigned to {responsible}</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#64748b" }}>Review Decision</p>
        <div className="space-y-2">
          {(Object.keys(DECISION_META) as Decision[]).map((a) => {
            const m = DECISION_META[a];
            return (
              <button
                key={a}
                onClick={() => setAction(a)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: action === a ? m.bg : "#f8fafc", color: m.color, border: `1.5px solid ${action === a ? m.color + "40" : "#e2e8f0"}` }}
              >
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: action === a ? m.color : "#cbd5e1" }}>
                  {action === a && <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />}
                </div>
                <span className="text-base">{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Remarks">
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          className={INPUT_CLS + " resize-none"}
          style={INPUT_STYLE}
          placeholder={action === "compliant" ? "Optional remarks…" : "Required — explain what needs to be corrected or why it is non-compliant…"}
        />
      </Field>
    </ProtoModal>
  );
}

function DetailModal({
  req,
  now,
  projectLabel,
  nameOf,
  canSubmit,
  canReview,
  onClose,
  onSubmit,
  onReview,
}: {
  req: ComplianceRequirement;
  now: number;
  projectLabel: string;
  nameOf: (id: number | null) => string;
  canSubmit: boolean;
  canReview: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onReview: () => void;
}) {
  const [tab, setTab] = useState<"info" | "evidence" | "history">("info");
  const [doc, setDoc] = useState<ProjectDocument | null>(null);
  const [docError, setDocError] = useState(false);
  const status = statusOf(req, now);

  useEffect(() => {
    let active = true;
    if (tab !== "evidence" || !req.document) return;
    documentApi
      .getDocument(req.document)
      .then((d) => active && setDoc(d))
      .catch(() => active && setDocError(true));
    return () => {
      active = false;
    };
  }, [tab, req.document]);

  const history = [
    { icon: "📋", label: "Requirement defined", color: "#0369a1", by: nameOf(req.created_by), at: req.created_at, note: `Assigned to ${nameOf(req.responsible)} · due ${req.deadline}` },
    ...(req.submitted_at ? [{ icon: "📎", label: "Evidence submitted", color: "#6b21a8", by: nameOf(req.responsible), at: req.submitted_at, note: req.document ? "Supporting document attached." : "Submitted without a document." }] : []),
    ...(req.reviewed_at
      ? [
          {
            icon: req.status === "compliant" ? "✅" : req.status === "returned" ? "↩️" : req.status === "non_compliant" ? "⛔" : "🔍",
            label: req.status === "compliant" ? "Marked compliant" : req.status === "non_compliant" ? "Marked non-compliant" : "Returned for revision",
            color: req.status === "compliant" ? "#166534" : req.status === "non_compliant" ? "#7c3aed" : "#c2410c",
            by: nameOf(req.reviewed_by),
            at: req.reviewed_at,
            note: req.review_remarks || "No remarks.",
          },
        ]
      : []),
  ];

  const headerBtn = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold";

  return (
    <ProtoModal
      width="max-w-2xl"
      onClose={onClose}
      title={
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge s={status} />
          </div>
          <p className="text-white font-black text-base leading-snug">{req.title}</p>
          <p className="text-xs mt-1 font-normal" style={{ color: "rgba(168,196,232,0.6)" }}>
            {projectLabel} · {nameOf(req.responsible)} · Due {req.deadline}
          </p>
          {(canSubmit || canReview) && (
            <div className="flex gap-2 mt-3">
              {canSubmit && (
                <button onClick={onSubmit} className={headerBtn} style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
                  📎 {req.status === "returned" ? "Resubmit Evidence" : "Submit Evidence"}
                </button>
              )}
              {canReview && (
                <button onClick={onReview} className={headerBtn} style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
                  🔍 Review
                </button>
              )}
            </div>
          )}
        </>
      }
    >
      <div className="flex border-b -mx-6 -mt-6 mb-2 px-2" style={{ borderColor: "#e2e8f0" }}>
        {(
          [
            ["info", "Details"],
            ["evidence", "Evidence"],
            ["history", "History"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Description</p>
            <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{req.description || "—"}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Assigned To", val: nameOf(req.responsible) },
              { label: "Deadline", val: req.deadline },
              { label: "Submitted", val: req.submitted_at ? fmtDateTime(req.submitted_at) : "Not yet submitted" },
              { label: "Reviewed", val: req.reviewed_at ? `${fmtDateTime(req.reviewed_at)} · ${nameOf(req.reviewed_by)}` : "Not yet reviewed" },
              { label: "Defined By", val: nameOf(req.created_by) },
              { label: "Status", val: STATUS_META[status].label },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{f.label}</p>
                <p className="text-sm font-semibold mt-0.5 break-words" style={{ color: "#0d2a5e" }}>{f.val}</p>
              </div>
            ))}
          </div>
          {req.review_remarks && (
            <div className="rounded-xl px-4 py-3" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
              <p className="text-xs font-bold" style={{ color: "#92400e" }}>Review Remarks</p>
              <p className="text-sm mt-0.5" style={{ color: "#78350f" }}>{req.review_remarks}</p>
            </div>
          )}
        </div>
      )}

      {tab === "evidence" &&
        (!req.document ? (
          <div className="text-center py-12 rounded-2xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p className="text-2xl mb-2">📎</p>
            <p className="text-sm font-semibold" style={{ color: "#64748b" }}>No evidence submitted yet.</p>
            {canSubmit && (
              <button onClick={onSubmit} className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#6b21a8" }}>
                Submit Evidence
              </button>
            )}
          </div>
        ) : docError ? (
          <NoActualData message="Could not load the attached document" />
        ) : !doc ? (
          <SkeletonRows rows={1} />
        ) : (
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#faf5ff" }}>📄</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold break-words" style={{ color: "#0d2a5e" }}>{doc.file_name}</p>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                v{doc.version_number} · {nameOf(doc.uploaded_by)} · {doc.uploaded_at.slice(0, 10)}
              </p>
            </div>
            {doc.download_url && (
              <button onClick={() => window.open(doc.download_url, "_blank", "noopener")} className="px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                View
              </button>
            )}
          </div>
        ))}

      {tab === "history" && (
        <div className="space-y-3">
          {history.map((h, idx) => (
            <div key={h.label + h.at} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ background: "#f0f4f8" }}>{h.icon}</div>
                {idx < history.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: "#e2e8f0" }} />}
              </div>
              <div className="flex-1 pb-3 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs font-black" style={{ color: h.color }}>{h.label}</span>
                  <span className="text-xs" style={{ color: "#94a3b8" }}>by {h.by}</span>
                  <span className="text-xs font-mono ml-auto shrink-0" style={{ color: "#94a3b8" }}>{fmtDateTime(h.at)}</span>
                </div>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "#334155" }}>{h.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProtoModal>
  );
}

function ComplianceContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canEncode = ENCODE_ROLE_CODES.includes(code);
  const canManage = MANAGE_ROLE_CODES.includes(code);
  const [now] = useState(() => Date.now());

  const [pageTab, setPageTab] = useState<PageTab>("tracker");
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [reqs, setReqs] = useState<ComplianceRequirement[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [statusFilter, setStatusFilter] = useState<CompStatus | "All">("All");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"define" | "submit" | "review" | null>(null);

  useEffect(() => {
    let active = true;
    researchApi
      .getProjects()
      .then((p) => active && setProjects(p))
      .catch(() => active && notify.error("Could not load projects."));
    personnelApi
      .getAssignments({ active: true })
      .then((a) => active && setAssignments(a))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    complianceApi
      .getRequirements()
      .then((r) => active && setReqs(r))
      .catch(() => {
        if (!active) return;
        setReqs([]);
        notify.error("Could not load compliance requirements.");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const names = useMemo(() => {
    const m = new Map<number, string>();
    projects.forEach((p) => m.set(p.lead_detail.id, p.lead_detail.email));
    assignments.forEach((a) => m.set(a.user_detail.id, a.user_detail.email));
    if (user) m.set(user.pk, user.email);
    return m;
  }, [projects, assignments, user]);
  const nameOf = (id: number | null) => (id === null ? "—" : names.get(id) ?? `User #${id}`);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectLabel = (id: number) => projectById.get(id)?.project_code ?? `Project #${id}`;

  const all = useMemo(() => reqs ?? [], [reqs]);
  const withStatus = useMemo(() => all.map((r) => ({ r, s: statusOf(r, now) })), [all, now]);
  const filtered = withStatus.filter(({ r, s }) => {
    const q = search.trim().toLowerCase();
    return (
      (statusFilter === "All" || s === statusFilter) &&
      (projectFilter === "all" || String(r.project) === projectFilter) &&
      (!q || r.title.toLowerCase().includes(q) || nameOf(r.responsible).toLowerCase().includes(q))
    );
  });

  const count = (s: CompStatus) => withStatus.filter((x) => x.s === s).length;
  const kpis = { total: all.length, compliant: count("compliant"), overdue: count("overdue"), dueSoon: count("due_soon"), submitted: count("submitted"), returned: count("returned") };
  const pct = kpis.total > 0 ? Math.round((kpis.compliant / kpis.total) * 100) : 0;
  const attention = withStatus.filter((x) => x.s === "overdue" || x.s === "due_soon");
  const projectCount = new Set(all.map((r) => r.project)).size;

  const selected = all.find((r) => r.id === selectedId) ?? null;
  const canSubmit = (r: ComplianceRequirement) => (r.responsible === user?.pk || canEncode) && (r.status === "pending" || r.status === "returned");
  const canReview = (r: ComplianceRequirement) => canManage && r.status === "submitted";
  const done = () => {
    setModal(null);
    setReloadKey((k) => k + 1);
  };

  const filterCls = "px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none";
  const filterSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "#e2e8f0" }}>
        {(
          [
            ["tracker", "📋 Requirements Tracker"],
            ["records", "🛡️ Integrity Records"],
          ] as [PageTab, string][]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setPageTab(k)} className="px-4 py-2 rounded-lg text-xs font-bold transition-all" style={pageTab === k ? { background: "white", color: "#0d2a5e", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: "#64748b" }}>
            {l}
          </button>
        ))}
      </div>

      {pageTab === "records" ? (
        <IntegrityRecords projects={projects} canEncode={canEncode} canManage={canManage} userPk={user?.pk ?? 0} />
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "Total", val: kpis.total, color: "#0d2a5e" },
              { label: "Compliant", val: kpis.compliant, color: "#166534" },
              { label: "Overdue", val: kpis.overdue, color: "#991b1b" },
              { label: "Due Soon", val: kpis.dueSoon, color: "#92400e" },
              { label: "Submitted", val: kpis.submitted, color: "#0369a1" },
              { label: "Returned", val: kpis.returned, color: "#c2410c" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
                <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{reqs === null ? "—" : s.val}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-black text-sm" style={{ color: "#0d2a5e" }}>Overall Compliance Rate</p>
              <p className="text-2xl font-black font-mono" style={{ color: pct >= 80 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626" }}>{pct}%</p>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? "#059669" : pct >= 50 ? "#f59e0b" : "#dc2626" }} />
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>
              {kpis.compliant} of {kpis.total} requirements compliant across {projectCount} project{projectCount !== 1 ? "s" : ""}
            </p>
          </div>

          {attention.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #fca5a5" }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "#fee2e2" }}>
                <span>🚨</span>
                <p className="text-xs font-black" style={{ color: "#991b1b" }}>
                  Attention Required ({kpis.overdue} overdue, {kpis.dueSoon} due soon)
                </p>
              </div>
              <div className="divide-y" style={{ background: "white" }}>
                {attention.slice(0, 4).map(({ r, s }) => (
                  <div key={r.id} onClick={() => setSelectedId(r.id)} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-red-50 transition-colors">
                    <StatusBadge s={s} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: "#0d2a5e" }}>{r.title}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>{projectLabel(r.project)} · {nameOf(r.responsible)}</p>
                    </div>
                    <DaysLeft deadline={r.deadline} status={s} now={now} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4 justify-between">
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requirements…" className="pl-7 pr-3 py-1.5 rounded-xl text-xs border outline-none" style={{ ...filterSt, width: "180px" }} />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CompStatus | "All")} className={filterCls} style={filterSt}>
                  <option value="All">All Statuses</option>
                  {(Object.entries(STATUS_META) as [CompStatus, (typeof STATUS_META)[CompStatus]][]).map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </select>
                <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={filterCls} style={filterSt}>
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_code}</option>
                  ))}
                </select>
              </div>
              {canEncode && (
                <button onClick={() => setModal("define")} disabled={projects.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  Define Requirement
                </button>
              )}
            </div>

            {reqs === null ? (
              <SkeletonRows />
            ) : all.length === 0 ? (
              <NoActualData hint={canEncode ? 'Click "Define Requirement" to start tracking one.' : undefined} />
            ) : (
              <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0", background: "white" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f0f4f8" }}>
                      {["Requirement", "Project", "Assigned To", "Deadline", "Status", "Evidence", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold" style={{ color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ r, s }) => (
                      <tr key={r.id} onClick={() => setSelectedId(r.id)} className="border-t cursor-pointer hover:bg-slate-50 transition-colors" style={{ borderColor: "#f1f5f9" }}>
                        <td className="px-3 py-3" style={{ maxWidth: "260px" }}>
                          <p className="text-xs font-bold leading-snug" style={{ color: "#0d2a5e" }}>{r.title}</p>
                          {r.description && <p className="text-xs mt-0.5 truncate" style={{ color: "#94a3b8" }}>{r.description}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: "#e0f2fe", color: "#0369a1" }}>{projectLabel(r.project)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-semibold" style={{ color: "#334155" }}>{nameOf(r.responsible)}</p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="text-xs font-mono" style={{ color: "#334155" }}>{r.deadline}</p>
                          <DaysLeft deadline={r.deadline} status={s} now={now} />
                        </td>
                        <td className="px-3 py-3"><StatusBadge s={s} /></td>
                        <td className="px-3 py-3">
                          {r.document ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#faf5ff", color: "#6b21a8" }}>📎 1</span>
                          ) : (
                            <span className="text-xs" style={{ color: "#cbd5e1" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setSelectedId(r.id)} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#e0f2fe", color: "#0369a1" }}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && <div className="py-10 text-center text-xs" style={{ color: "#94a3b8" }}>No requirements match your filters.</div>}
              </div>
            )}
          </div>
        </>
      )}

      {selected && modal === null && (
        <DetailModal
          req={selected}
          now={now}
          projectLabel={projectLabel(selected.project)}
          nameOf={nameOf}
          canSubmit={canSubmit(selected)}
          canReview={canReview(selected)}
          onClose={() => setSelectedId(null)}
          onSubmit={() => setModal("submit")}
          onReview={() => setModal("review")}
        />
      )}
      {selected && modal === "submit" && <SubmitModal req={selected} projectLabel={projectLabel(selected.project)} onClose={() => setModal(null)} onSaved={done} />}
      {selected && modal === "review" && <ReviewModal req={selected} responsible={nameOf(selected.responsible)} onClose={() => setModal(null)} onSaved={done} />}
      {modal === "define" && <DefineModal projects={projects} onClose={() => setModal(null)} onSaved={done} />}
    </div>
  );
}

export default function CompliancePage() {
  return (
    <ProtectedRoute>
      <AppShell title="Compliance Tracking">
        <ComplianceContent />
      </AppShell>
    </ProtectedRoute>
  );
}
