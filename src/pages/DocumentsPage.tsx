import { useEffect, useMemo, useRef, useState } from "react";
import { complianceApi } from "../lib/complianceApi";
import { documentApi } from "../lib/documentApi";
import { monitoringApi } from "../lib/monitoringApi";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import { DOCUMENT_SHARES } from "../mocks/documents";
import type { DocumentReviewStatus, DocumentSensitivity, DocumentStage, DocumentType, ProjectDocument } from "../types/document";
import type { Project, Study } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { Field, ProtoModal, SkeletonRows } from "../components/common/proto";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const MANAGE_ROLE_CODES = ["system_admin", "riuh"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type DocStatus = "active" | "superseded" | "archived";
type ViewMode = "all" | "by_project" | "by_type";

const DOC_TYPE_META: Record<DocumentType, { label: string; icon: string; color: string; bg: string }> = {
  toe: { label: "Terms of Engagement", icon: "🤝", color: "#92400e", bg: "#fef3c7" },
  lib: { label: "Line-Item Budget", icon: "📋", color: "#0d2a5e", bg: "#e0eaf7" },
  work_plan: { label: "Work Plan", icon: "📅", color: "#0891b2", bg: "#e0f2fe" },
  midterm_report: { label: "Midterm Report", icon: "📊", color: "#0d2a5e", bg: "#e0eaf7" },
  terminal_report: { label: "Terminal Report", icon: "🏁", color: "#166534", bg: "#d1fae5" },
  accomplishment_report: { label: "Accomplishment Report", icon: "📈", color: "#0369a1", bg: "#e0f2fe" },
  thesis: { label: "Thesis", icon: "🎓", color: "#7c3aed", bg: "#fdf4ff" },
  dissertation: { label: "Dissertation", icon: "📚", color: "#7c3aed", bg: "#fdf4ff" },
  dataset: { label: "Research Dataset", icon: "🗃", color: "#c2410c", bg: "#fff7ed" },
  manuscript: { label: "Manuscript", icon: "📰", color: "#059669", bg: "#d1fae5" },
  other: { label: "Other Document", icon: "📎", color: "#475569", bg: "#f1f5f9" },
};

const DOC_STATUS_META: Record<DocStatus, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "#d1fae5", text: "#166534" },
  superseded: { label: "Superseded", bg: "#fef3c7", text: "#92400e" },
  archived: { label: "Archived", bg: "#f1f5f9", text: "#64748b" },
};

const REVIEW_META: Record<DocumentReviewStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending Review", bg: "#e0f2fe", text: "#0369a1" },
  approved: { label: "Approved", bg: "#d1fae5", text: "#166534" },
  returned: { label: "Returned", bg: "#fff7ed", text: "#c2410c" },
};

const ACCESS_META: Record<DocumentSensitivity, { label: string; icon: string; color: string; hint: string }> = {
  project_team: { label: "Project team", icon: "👥", color: "#0369a1", hint: "Project team, RIUH, CRC Chair, university-wide offices" },
  financial: { label: "Financial", icon: "💰", color: "#166534", hint: "Finance/Budget, Procurement, the project/program leader, university-wide offices" },
  restricted: { label: "Restricted", icon: "🔒", color: "#991b1b", hint: "RIUH and university-wide offices only" },
};

const STAGE_LABELS: Record<Exclude<DocumentStage, "">, string> = {
  inception: "Inception",
  midterm: "Midterm",
  terminal: "Terminal",
  post_completion: "Post-Completion",
};

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);
const statusOf = (d: ProjectDocument): DocStatus => (d.is_archived ? "archived" : d.is_current ? "active" : "superseded");

function TypeChip({ t }: { t: DocumentType }) {
  const m = DOC_TYPE_META[t];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>
      {m.icon} {m.label}
    </span>
  );
}

function StatusBadge({ s }: { s: DocStatus }) {
  const m = DOC_STATUS_META[s];
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.text }}>{m.label}</span>;
}

function ReviewBadge({ s }: { s: DocumentReviewStatus }) {
  const m = REVIEW_META[s];
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.text }}>{m.label}</span>;
}

async function openDownload(id: number) {
  try {
    const full = await documentApi.getDocument(id);
    if (full.download_url) window.open(full.download_url, "_blank", "noopener");
  } catch (err) {
    notify.error(errorMessage(err, "Could not get a download link."));
  }
}

type UploadPreset = { project: string; document_type: DocumentType | ""; study: string };

function UploadModal({ projects, preset, onClose, onSaved }: { projects: Project[]; preset: UploadPreset; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [form, setForm] = useState({ ...preset, stage: "" as DocumentStage, sensitivity: (preset.document_type === "lib" ? "financial" : "project_team") as DocumentSensitivity });
  const [file, setFile] = useState<File | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isNewVersion = !!preset.document_type;

  useEffect(() => {
    let active = true;
    if (!form.project) return;
    researchApi
      .getStudies(Number(form.project))
      .then((s) => active && setStudies(s))
      .catch(() => active && setStudies([]));
    return () => {
      active = false;
    };
  }, [form.project]);

  const tooBig = !!file && file.size > MAX_UPLOAD_BYTES;
  const next = () => {
    setAttempted(true);
    if (!file || !form.project || !form.document_type) {
      notify.error("File, document type, and project are required.");
      return;
    }
    if (tooBig) {
      notify.error("File exceeds the 25MB limit.");
      return;
    }
    setAttempted(false);
    setStep(1);
  };

  const save = async () => {
    if (!file || !form.document_type) return;
    setSaving(true);
    try {
      await documentApi.uploadDocument({
        project: Number(form.project),
        study: form.study ? Number(form.study) : null,
        document_type: form.document_type,
        stage: form.stage || undefined,
        sensitivity: form.sensitivity,
        file,
      });
      notify.success("Document uploaded.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not upload this document."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtoModal
      title={isNewVersion ? "Upload New Version" : "Upload Document"}
      subtitle={step === 0 ? "File & classification" : "Stage & access control"}
      onClose={onClose}
      footer={
        step === 0 ? (
          <>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
            <button onClick={next} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a5e" }}>Continue</button>
          </>
        ) : (
          <>
            <button onClick={() => setStep(0)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Back</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
              {saving ? "Uploading…" : "Upload"}
            </button>
          </>
        )
      }
    >
      {step === 0 && (
        <>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && f.size > MAX_UPLOAD_BYTES) notify.error("File exceeds the 25MB limit.");
            }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            className="rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer"
            style={{ background: "#f8fafc", border: `2px dashed ${(attempted && !file) || tooBig ? "#dc2626" : "#e2e8f0"}` }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "#e0eaf7" }}>📄</div>
            <div className="text-center">
              {file ? (
                <>
                  <p className="text-sm font-bold break-all" style={{ color: "#0d2a5e" }}>{file.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: tooBig ? "#dc2626" : "#94a3b8" }}>{formatSize(file.size)}{tooBig ? " — over the 25 MB limit" : ""}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>Browse for a file</p>
                  <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>PDF, DOCX, XLSX, PPTX, CSV, ZIP — max 25 MB</p>
                </>
              )}
            </div>
            <span className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>{file ? "Change File" : "Browse Files"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Document Type" required>
              <select className={INPUT_CLS} style={invalidStyle(attempted && !form.document_type)} value={form.document_type} disabled={isNewVersion} onChange={(e) => {
                const t = e.target.value as DocumentType | "";
                setForm((f) => ({ ...f, document_type: t, sensitivity: t === "lib" ? "financial" : f.sensitivity === "financial" ? "project_team" : f.sensitivity }));
              }}>
                <option value="">Select type</option>
                {(Object.entries(DOC_TYPE_META) as [DocumentType, (typeof DOC_TYPE_META)[DocumentType]][]).map(([k, m]) => (
                  <option key={k} value={k}>{m.icon} {m.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Project" required>
              <select className={INPUT_CLS} style={invalidStyle(attempted && !form.project)} value={form.project} disabled={isNewVersion} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value, study: "" }))}>
                <option value="">— Select project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_code}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Study (optional)">
            <select className={INPUT_CLS} style={INPUT_STYLE} value={form.study} disabled={isNewVersion || !form.project} onChange={(e) => setForm((f) => ({ ...f, study: e.target.value }))}>
              <option value="">Whole project</option>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            The version number is assigned automatically. Uploading the same type for the same project/study supersedes the previous version.
          </p>
        </>
      )}
      {step === 1 && (
        <>
          <Field label="Stage">
            <select className={INPUT_CLS} style={INPUT_STYLE} value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as DocumentStage }))}>
              <option value="">Not specified</option>
              {Object.entries(STAGE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </Field>
          <div>
            <label className="label-field">Access Level</label>
            <div className="space-y-2 mt-1">
              {(Object.entries(ACCESS_META) as [DocumentSensitivity, (typeof ACCESS_META)[DocumentSensitivity]][]).map(([k, m]) => (
                <label key={k} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all" style={{ background: form.sensitivity === k ? "#f0f9ff" : "#f8fafc", border: `1px solid ${form.sensitivity === k ? "#0891b2" : "#e2e8f0"}` }}>
                  <input type="radio" name="access" value={k} checked={form.sensitivity === k} onChange={() => setForm((f) => ({ ...f, sensitivity: k }))} className="shrink-0" />
                  <span className="text-lg">{m.icon}</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>{m.label}</p>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>{m.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </ProtoModal>
  );
}

type LinkedRecord = { module: string; description: string };

function DetailModal({
  doc,
  projectLabel,
  nameOf,
  canManage,
  onClose,
  onChanged,
  onNewVersion,
}: {
  doc: ProjectDocument;
  projectLabel: string;
  nameOf: (id: number | null) => string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onNewVersion: () => void;
}) {
  const [tab, setTab] = useState<"info" | "versions" | "links" | "sharing">("info");
  const [versions, setVersions] = useState<ProjectDocument[] | null>(null);
  const [links, setLinks] = useState<LinkedRecord[] | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const am = ACCESS_META[doc.sensitivity];
  const status = statusOf(doc);

  useEffect(() => {
    let active = true;
    if (tab !== "versions" || versions) return;
    documentApi
      .getDocuments({ project: doc.project, document_type: doc.document_type })
      .then((all) => active && setVersions(all.filter((d) => d.study === doc.study).sort((a, b) => b.version_number - a.version_number)))
      .catch(() => active && setVersions([]));
    return () => {
      active = false;
    };
  }, [tab, versions, doc]);

  useEffect(() => {
    let active = true;
    if (tab !== "links" || links) return;
    const p = { project: doc.project };
    Promise.all([
      complianceApi.getRequirements(p).catch(() => []),
      monitoringApi.getMonthlyReports(p).catch(() => []),
      monitoringApi.getMidtermReports(p).catch(() => []),
      monitoringApi.getTerminalReports(p).catch(() => []),
    ]).then(([reqs, monthly, midterm, terminal]) => {
      if (!active) return;
      setLinks([
        ...reqs.filter((r) => r.document === doc.id).map((r) => ({ module: "Compliance Tracking", description: `Requirement evidence — ${r.title}` })),
        ...monthly.filter((r) => r.document === doc.id).map((r) => ({ module: "Monitoring & Evaluation", description: `Monthly report — ${r.period.slice(0, 7)}` })),
        ...midterm.filter((r) => r.document === doc.id).map((r) => ({ module: "Monitoring & Evaluation", description: `Midterm report — Year ${r.project_year}` })),
        ...terminal.filter((r) => r.document === doc.id).map(() => ({ module: "Monitoring & Evaluation", description: "Terminal report" })),
      ]);
    });
    return () => {
      active = false;
    };
  }, [tab, links, doc]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      notify.success(ok);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not update this document."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProtoModal
      width="max-w-2xl"
      onClose={onClose}
      title={
        <>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <TypeChip t={doc.document_type} />
            <StatusBadge s={status} />
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.15)", color: "#67e8f9" }}>v{doc.version_number}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(168,196,232,0.8)" }}>{am.icon} {am.label}</span>
          </div>
          <p className="text-white font-black leading-snug break-all">{doc.file_name}</p>
          <p className="text-xs mt-1 font-normal" style={{ color: "rgba(168,196,232,0.6)" }}>
            {projectLabel} · {formatSize(doc.file_size)}
          </p>
        </>
      }
    >
      <div className="flex border-b -mx-6 -mt-6 mb-2 px-2 overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
        {(
          [
            ["info", "Document Info"],
            ["versions", "Version History"],
            ["links", "Linked Records"],
            ["sharing", "Sharing"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Document Type", val: `${DOC_TYPE_META[doc.document_type].icon} ${DOC_TYPE_META[doc.document_type].label}` },
              { label: "Project", val: projectLabel },
              { label: "Uploaded By", val: nameOf(doc.uploaded_by) },
              { label: "Upload Date", val: doc.uploaded_at.slice(0, 10) },
              { label: "Stage", val: doc.stage ? STAGE_LABELS[doc.stage] : "—" },
              { label: "File Size", val: formatSize(doc.file_size) },
              { label: "Current Version", val: `v${doc.version_number}${doc.is_current ? "" : " (superseded)"}` },
              { label: "Access Level", val: `${am.icon} ${am.label}` },
              { label: "Retention Until", val: doc.retention_until },
              { label: "Status", val: DOC_STATUS_META[status].label },
            ].map((f) => (
              <div key={f.label}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{f.label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "#0d2a5e" }}>{f.val}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Review</p>
              <ReviewBadge s={doc.review_status} />
              {doc.reviewed_at && <span className="text-xs" style={{ color: "#94a3b8" }}>by {nameOf(doc.reviewed_by)} · {doc.reviewed_at.slice(0, 10)}</span>}
            </div>
            {doc.review_remarks && <p className="text-sm" style={{ color: "#334155" }}>{doc.review_remarks}</p>}
            {canManage && !doc.is_archived && (
              <>
                <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Review remarks (required when returning)…" />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => act(() => documentApi.reviewDocument(doc.id, "approved", remarks.trim()), "Document approved.")} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#d1fae5", color: "#166534" }}>
                    ✅ Approve
                  </button>
                  <button
                    disabled={busy || !remarks.trim()}
                    onClick={() => act(() => documentApi.reviewDocument(doc.id, "returned", remarks.trim()), "Document returned for revision.")}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                    style={{ background: "#fff7ed", color: "#c2410c" }}
                  >
                    ↩️ Return for Revision
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={() => openDownload(doc.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
            {!doc.is_archived && (
              <button onClick={onNewVersion} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload New Version
              </button>
            )}
            {canManage && !doc.is_archived && (
              <button disabled={busy} onClick={() => act(() => documentApi.archiveDocument(doc.id), "Document archived.")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-60" style={{ background: "#f1f5f9", color: "#64748b" }}>
                🗄 Archive
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "versions" &&
        (versions === null ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-3">
            {versions.map((v, idx) => (
              <div key={v.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-white" style={{ background: v.is_current ? "#0d2a5e" : "#94a3b8" }}>v{v.version_number}</div>
                  {idx < versions.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: "#e2e8f0" }} />}
                </div>
                <div className="flex-1 rounded-2xl px-4 py-3" style={{ background: v.is_current ? "#f0f4f8" : "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-black" style={{ color: v.is_current ? "#0d2a5e" : "#64748b" }}>
                      Version {v.version_number} · {v.is_archived ? "Archived" : v.is_current ? "Current" : "Superseded"}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>{v.uploaded_at.slice(0, 10)}</span>
                  </div>
                  <p className="text-xs break-all" style={{ color: "#64748b" }}>
                    {nameOf(v.uploaded_by)} · {v.file_name} · {formatSize(v.file_size)}
                  </p>
                  <div className="flex gap-2 mt-2 items-center">
                    <ReviewBadge s={v.review_status} />
                    <button onClick={() => openDownload(v.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>Download</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === "links" &&
        (links === null ? (
          <SkeletonRows rows={2} />
        ) : links.length === 0 ? (
          <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p className="text-sm" style={{ color: "#94a3b8" }}>No linked records yet.</p>
            <p className="text-xs mt-1" style={{ color: "#cbd5e1" }}>Compliance requirements and monitoring reports that attach this file show up here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: "#e0f2fe" }}>🔗</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>{l.description}</p>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>{l.module}</p>
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === "sharing" && (
        <div className="space-y-3">
          {DOCUMENT_SHARES.map((s) => (
            <div key={s.sharedWith} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: "#faf5ff" }}>🔑</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>{s.sharedWith}</p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>{s.role} · shared by {s.sharedBy} on {s.sharedAt}</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "#fef3c7", color: "#92400e" }}>Expires {s.expiresAt}</span>
            </div>
          ))}
        </div>
      )}
    </ProtoModal>
  );
}

function DocumentsContent() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLE_CODES.includes(user?.role?.code ?? "");

  const [projects, setProjects] = useState<Project[]>([]);
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [docs, setDocs] = useState<ProjectDocument[] | null>(null);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [reviewFilter, setReviewFilter] = useState<DocumentReviewStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [upload, setUpload] = useState<UploadPreset | null>(null);

  useEffect(() => {
    let active = true;
    researchApi
      .getProjects()
      .then((p) => {
        if (!active) return;
        setProjects(p);
        setNames((m) => new Map([...m, ...p.map((x) => [x.lead_detail.id, x.lead_detail.email] as [number, string])]));
      })
      .catch(() => active && notify.error("Could not load projects."));
    personnelApi
      .getAssignments({ active: true })
      .then((a) => active && setNames((m) => new Map([...m, ...a.map((x) => [x.user_detail.id, x.user_detail.email] as [number, string])])))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    documentApi
      .getDocuments({ current_only: !showSuperseded })
      .then((d) => active && setDocs(d))
      .catch(() => {
        if (!active) return;
        setDocs([]);
        notify.error("Could not load documents.");
      });
    return () => {
      active = false;
    };
  }, [showSuperseded, reloadKey]);

  const nameOf = (id: number | null) => (id === null ? "—" : id === user?.pk ? user.email : names.get(id) ?? `User #${id}`);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectLabel = (id: number) => projectById.get(id)?.project_code ?? `Project #${id}`;

  const all = useMemo(() => docs ?? [], [docs]);
  const q = search.trim().toLowerCase();
  const filtered = all.filter(
    (d) =>
      (typeFilter === "all" || d.document_type === typeFilter) &&
      (reviewFilter === "all" || d.review_status === reviewFilter) &&
      (projectFilter === "all" || String(d.project) === projectFilter) &&
      (!q || d.file_name.toLowerCase().includes(q) || DOC_TYPE_META[d.document_type].label.toLowerCase().includes(q)),
  );

  const kpis = {
    total: all.length,
    active: all.filter((d) => statusOf(d) === "active").length,
    pending: all.filter((d) => d.review_status === "pending").length,
    returned: all.filter((d) => d.review_status === "returned").length,
    versioned: all.filter((d) => d.version_number > 1).length,
    projects: new Set(all.map((d) => d.project)).size,
  };

  const byProject = [...new Set(filtered.map((d) => d.project))].map((pid) => ({ pid, docs: filtered.filter((d) => d.project === pid) }));
  const byType = (Object.keys(DOC_TYPE_META) as DocumentType[]).map((type) => ({ type, docs: filtered.filter((d) => d.document_type === type) })).filter((g) => g.docs.length > 0);
  const selected = all.find((d) => d.id === selectedId) ?? null;

  const filterCls = "px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none";
  const filterSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

  const card = (doc: ProjectDocument) => {
    const tm = DOC_TYPE_META[doc.document_type];
    return (
      <div
        key={doc.id}
        onClick={() => setSelectedId(doc.id)}
        className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md"
        style={{ background: "white", border: "1px solid #e2e8f0" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#0891b2";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#e2e8f0";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: tm.bg }}>{tm.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <StatusBadge s={statusOf(doc)} />
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "#f0f4f8", color: "#64748b" }}>v{doc.version_number}</span>
              <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>{formatSize(doc.file_size)}</span>
            </div>
            <p className="text-xs font-bold leading-snug break-all" style={{ color: "#0d2a5e" }}>{doc.file_name}</p>
            <p className="text-xs mt-1 truncate" style={{ color: "#94a3b8" }}>
              {projectLabel(doc.project)} · {nameOf(doc.uploaded_by)} · {doc.uploaded_at.slice(0, 10)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t flex-wrap" style={{ borderColor: "#f1f5f9" }}>
          <TypeChip t={doc.document_type} />
          <ReviewBadge s={doc.review_status} />
          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "#f0f4f8", color: ACCESS_META[doc.sensitivity].color }}>
            {ACCESS_META[doc.sensitivity].icon} {ACCESS_META[doc.sensitivity].label}
          </span>
        </div>
      </div>
    );
  };

  const empty = <NoActualData message={all.length === 0 ? "No actual data" : "No documents match your filters."} hint={all.length === 0 ? 'Click "Upload Document" to add the first file.' : undefined} />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Total Docs", val: kpis.total, color: "#0d2a5e" },
          { label: "Active", val: kpis.active, color: "#166534" },
          { label: "Pending Review", val: kpis.pending, color: "#0369a1" },
          { label: "Returned", val: kpis.returned, color: "#c2410c" },
          { label: "Versioned", val: kpis.versioned, color: "#92400e" },
          { label: "Projects", val: kpis.projects, color: "#475569" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{docs === null ? "—" : s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="pl-7 pr-3 py-1.5 rounded-xl text-xs border outline-none" style={{ ...filterSt, width: "180px" }} />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DocumentType | "all")} className={filterCls} style={filterSt}>
            <option value="all">All Types</option>
            {(Object.entries(DOC_TYPE_META) as [DocumentType, (typeof DOC_TYPE_META)[DocumentType]][]).map(([k, m]) => (
              <option key={k} value={k}>{m.icon} {m.label}</option>
            ))}
          </select>
          <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as DocumentReviewStatus | "all")} className={filterCls} style={filterSt}>
            <option value="all">All Review Statuses</option>
            {Object.entries(REVIEW_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={filterCls} style={filterSt}>
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_code}</option>
            ))}
          </select>
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#e2e8f0" }}>
            {(["all", "by_project", "by_type"] as ViewMode[]).map((v, i) => (
              <button key={v} onClick={() => setViewMode(v)} className="px-3 py-1.5 text-xs font-semibold transition-all" style={{ background: viewMode === v ? "#0d2a5e" : "white", color: viewMode === v ? "white" : "#64748b", borderLeft: i > 0 ? "1px solid #e2e8f0" : "none" }}>
                {v === "all" ? "All" : v === "by_project" ? "By Project" : "By Type"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer" style={{ color: "#64748b" }}>
            <input
              type="checkbox"
              checked={showSuperseded}
              onChange={(e) => {
                setDocs(null);
                setShowSuperseded(e.target.checked);
              }}
            />
            Show superseded versions
          </label>
        </div>
        <button onClick={() => setUpload({ project: "", document_type: "", study: "" })} disabled={projects.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Upload Document
        </button>
      </div>

      {docs === null ? (
        <SkeletonRows />
      ) : filtered.length === 0 ? (
        empty
      ) : viewMode === "all" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map(card)}</div>
      ) : viewMode === "by_project" ? (
        <div className="space-y-6">
          {byProject.map(({ pid, docs: group }) => {
            const project = projectById.get(pid);
            return (
              <div key={pid}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0369a1" }}>{projectLabel(pid)}</span>
                  {project?.campus && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f0f4f8", color: "#475569" }}>{project.campus}</span>}
                  <p className="text-sm font-black truncate" style={{ color: "#0d2a5e" }}>{project?.title}</p>
                  <span className="text-xs ml-auto shrink-0" style={{ color: "#94a3b8" }}>{group.length} docs</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{group.map(card)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {byType.map(({ type, docs: group }) => {
            const tm = DOC_TYPE_META[type];
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{tm.icon}</span>
                  <p className="text-sm font-black" style={{ color: tm.color }}>{tm.label}</p>
                  <span className="text-xs ml-auto" style={{ color: "#94a3b8" }}>{group.length} docs</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{group.map(card)}</div>
              </div>
            );
          })}
        </div>
      )}

      {selected && !upload && (
        <DetailModal
          key={`${selected.id}-${selected.review_status}-${selected.is_archived}`}
          doc={selected}
          projectLabel={projectLabel(selected.project)}
          nameOf={nameOf}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
          onNewVersion={() => setUpload({ project: String(selected.project), document_type: selected.document_type, study: selected.study ? String(selected.study) : "" })}
        />
      )}
      {upload && (
        <UploadModal
          projects={projects}
          preset={upload}
          onClose={() => setUpload(null)}
          onSaved={() => {
            setUpload(null);
            setSelectedId(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Document and Records Management">
        <DocumentsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
