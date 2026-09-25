import { useEffect, useState } from "react";
import { documentApi } from "../../lib/documentApi";
import { monitoringApi } from "../../lib/monitoringApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../../lib/protoStyles";
import type { ProjectDocument } from "../../types/document";
import type { ExtensionRequest, ExtensionRequestStatus, MidtermReport, MonthlyProgressReport, RenewalApplication, RenewalStatus, TerminalReport } from "../../types/monitoring";
import type { Project } from "../../types/research";
import { NoActualData } from "../common/NoActualData";
import { Field, Pill, ProtoModal, SkeletonRows, TableHead } from "../common/proto";

type ReportKind = "monthly" | "midterm" | "terminal";

const today = () => new Date().toLocaleDateString("en-CA");
const td = "px-4 py-3 text-xs";

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
      {label}
    </button>
  );
}

function ModalFooter({ onClose, onSave, saving, label }: { onClose: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <>
      <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
      <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
        {saving ? "Saving…" : label}
      </button>
    </>
  );
}

export function ProgressReportsPanel({ project, canReport, canCertify, nameOf, onChanged, reloadKey }: { project: number; canReport: boolean; canCertify: boolean; nameOf: (id: number | null) => string; onChanged: () => void; reloadKey: number }) {
  const [kind, setKind] = useState<ReportKind>("monthly");
  const [monthly, setMonthly] = useState<MonthlyProgressReport[] | null>(null);
  const [midterm, setMidterm] = useState<MidtermReport[]>([]);
  const [terminal, setTerminal] = useState<TerminalReport[]>([]);
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState<Record<string, string>>({ period: today().slice(0, 7), project_year: "1" });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    let alive = true;
    const p = { project };
    Promise.all([monitoringApi.getMonthlyReports(p), monitoringApi.getMidtermReports(p), monitoringApi.getTerminalReports(p)])
      .then(([a, b, c]) => {
        if (!alive) return;
        setMonthly(a);
        setMidterm(b);
        setTerminal(c);
      })
      .catch(() => alive && setMonthly([]));
    documentApi
      .getDocuments({ project, current_only: true })
      .then((d) => alive && setDocs(d))
      .catch(() => alive && setDocs([]));
    return () => {
      alive = false;
    };
  }, [project, reloadKey]);

  const docName = (id: number | null) => (id ? docs.find((d) => d.id === id)?.file_name ?? `Document #${id}` : "—");
  const document = f.document ? Number(f.document) : null;

  const save = async () => {
    setAttempted(true);
    if ((kind === "monthly" && !f.period) || (kind === "midterm" && !f.project_year)) {
      notify.error("Fill in the required fields.");
      return;
    }
    setSaving(true);
    try {
      if (kind === "monthly") await monitoringApi.createMonthlyReport({ project, period: `${f.period}-01`, narrative: f.narrative || undefined, document });
      if (kind === "midterm") await monitoringApi.createMidtermReport({ project, project_year: Number(f.project_year), narrative: f.narrative || undefined, expenditure_summary: f.expenditure_summary || undefined, document });
      if (kind === "terminal") await monitoringApi.createTerminalReport({ project, narrative: f.narrative || undefined, document });
      notify.success("Report submitted.");
      setShow(false);
      setAttempted(false);
      setF({ period: today().slice(0, 7), project_year: "1" });
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit this report."));
    } finally {
      setSaving(false);
    }
  };

  const certify = async (id: number) => {
    setBusy(true);
    try {
      await monitoringApi.certifyTerminalReport(id);
      notify.success("Terminal report certified.");
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not certify this report."));
    } finally {
      setBusy(false);
    }
  };

  const labels: Record<ReportKind, string> = { monthly: "Monthly Progress", midterm: "Midterm (Appendix E)", terminal: "Terminal (Appendix F)" };
  const canAdd = canReport && !(kind === "terminal" && terminal.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(labels) as ReportKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all" style={{ background: kind === k ? "#0d2a5e" : "#f1f5f9", color: kind === k ? "white" : "#64748b" }}>
              {labels[k]}
            </button>
          ))}
        </div>
        {canAdd && <AddButton label={`Submit ${labels[kind].split(" ")[0]} Report`} onClick={() => setShow(true)} />}
      </div>

      {monthly === null ? (
        <SkeletonRows />
      ) : (kind === "monthly" ? monthly : kind === "midterm" ? midterm : terminal).length === 0 ? (
        <NoActualData />
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0", background: "white" }}>
          <table className="w-full text-sm">
            {kind === "monthly" && (
              <>
                <TableHead cols={["Period", "Narrative", "Document", "Submitted"]} />
                <tbody>
                  {monthly.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " font-mono font-bold"} style={{ color: "#0d2a5e" }}>{r.period.slice(0, 7)}</td>
                      <td className={td + " max-w-[320px]"} style={{ color: "#334155" }}>{r.narrative || "—"}</td>
                      <td className={td} style={{ color: "#0369a1" }}>{docName(r.document)}</td>
                      <td className={td} style={{ color: "#64748b" }}>{r.submitted_at.slice(0, 10)} · {nameOf(r.submitted_by)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {kind === "midterm" && (
              <>
                <TableHead cols={["Project Year", "Narrative", "Expenditure Summary", "Document", "Submitted"]} />
                <tbody>
                  {midterm.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " font-bold"} style={{ color: "#0d2a5e" }}>Year {r.project_year}</td>
                      <td className={td + " max-w-[260px]"} style={{ color: "#334155" }}>{r.narrative || "—"}</td>
                      <td className={td + " max-w-[220px]"} style={{ color: "#64748b" }}>{r.expenditure_summary || "—"}</td>
                      <td className={td} style={{ color: "#0369a1" }}>{docName(r.document)}</td>
                      <td className={td} style={{ color: "#64748b" }}>{r.submitted_at.slice(0, 10)} · {nameOf(r.submitted_by)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {kind === "terminal" && (
              <>
                <TableHead cols={["Narrative", "Document", "Submitted", "Certification"]} />
                <tbody>
                  {terminal.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " max-w-[320px]"} style={{ color: "#334155" }}>{r.narrative || "—"}</td>
                      <td className={td} style={{ color: "#0369a1" }}>{docName(r.document)}</td>
                      <td className={td} style={{ color: "#64748b" }}>{r.submitted_at.slice(0, 10)} · {nameOf(r.submitted_by)}</td>
                      <td className={td}>
                        {r.is_certified ? (
                          <Pill bg="#d1fae5" color="#166534">✓ Certified {r.certified_at?.slice(0, 10)}</Pill>
                        ) : canCertify ? (
                          <button disabled={busy} onClick={() => certify(r.id)} className="px-2.5 py-1 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#e0f2fe", color: "#0369a1" }}>Certify</button>
                        ) : (
                          <Pill bg="#fef3c7" color="#92400e">Awaiting RIUH certification</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}

      {show && (
        <ProtoModal title={`Submit ${labels[kind]} Report`} onClose={() => setShow(false)} footer={<ModalFooter onClose={() => setShow(false)} onSave={save} saving={saving} label="Submit Report" />}>
          {kind === "monthly" && (
            <Field label="Reporting Month" required>
              <input type="month" className={INPUT_CLS} style={invalidStyle(attempted && !f.period)} value={f.period ?? ""} onChange={set("period")} />
            </Field>
          )}
          {kind === "midterm" && (
            <Field label="Project Year" required>
              <input type="number" min="1" className={INPUT_CLS} style={invalidStyle(attempted && !f.project_year)} value={f.project_year ?? ""} onChange={set("project_year")} />
            </Field>
          )}
          <Field label="Narrative">
            <textarea rows={3} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={f.narrative ?? ""} onChange={set("narrative")} />
          </Field>
          {kind === "midterm" && (
            <Field label="Expenditure Summary">
              <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={f.expenditure_summary ?? ""} onChange={set("expenditure_summary")} />
            </Field>
          )}
          <Field label="Attached Document (optional)">
            <select className={INPUT_CLS} style={INPUT_STYLE} value={f.document ?? ""} onChange={set("document")}>
              <option value="">No document</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>{d.file_name} (v{d.version_number})</option>
              ))}
            </select>
          </Field>
          <p className="text-xs" style={{ color: "#94a3b8" }}>Upload files in Document and Records Management first, then pick them here.</p>
        </ProtoModal>
      )}
    </div>
  );
}

const EXT_META: Record<ExtensionRequestStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending Endorsement", bg: "#e0f2fe", color: "#0369a1" },
  endorsed: { label: "Endorsed — awaiting President", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#d1fae5", color: "#166534" },
  denied: { label: "Denied", bg: "#fee2e2", color: "#991b1b" },
};

export function ExtensionsPanel({
  project,
  canRequest,
  canEndorse,
  canApprove,
  nameOf,
  onChanged,
  reloadKey,
}: {
  project: Project;
  canRequest: boolean;
  canEndorse: boolean;
  canApprove: boolean;
  nameOf: (id: number | null) => string;
  onChanged: () => void;
  reloadKey: number;
}) {
  const [rows, setRows] = useState<ExtensionRequest[] | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ requested_end_date: "", justification: "" });
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    monitoringApi
      .getExtensionRequests({ project: project.id })
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [project.id, reloadKey]);

  const inProgress = (rows ?? []).some((r) => r.status === "pending" || r.status === "endorsed");

  const save = async () => {
    setAttempted(true);
    if (!form.requested_end_date || !form.justification.trim()) {
      notify.error("New end date and justification are required.");
      return;
    }
    setSaving(true);
    try {
      await monitoringApi.createExtensionRequest({ project: project.id, requested_end_date: form.requested_end_date, justification: form.justification.trim() });
      notify.success("Extension requested.");
      setShow(false);
      setAttempted(false);
      setForm({ requested_end_date: "", justification: "" });
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not request the extension."));
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: number, action: "endorse" | "approve" | "deny") => {
    setSaving(true);
    try {
      await monitoringApi.actOnExtensionRequest(id, action, remarks[id] || undefined);
      notify.success(action === "endorse" ? "Extension endorsed." : action === "approve" ? "Extension approved — end date moved." : "Extension denied.");
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, `Could not ${action} this request.`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs" style={{ color: "#64748b" }}>
          Current target end date: <span className="font-mono font-bold" style={{ color: "#0d2a5e" }}>{project.target_end_date ?? "not set"}</span> · Leader requests → DRD/CRC endorses → University President approves (at least one month before termination).
        </p>
        {canRequest && !inProgress && <AddButton label="Request Extension" onClick={() => setShow(true)} />}
      </div>
      {rows === null ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <NoActualData />
      ) : (
        rows.map((r) => {
          const m = EXT_META[r.status];
          const canAct = (r.status === "pending" && canEndorse) || (r.status === "endorsed" && canApprove);
          return (
            <div key={r.id} className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Pill bg={m.bg} color={m.color}>{m.label}</Pill>
                    <span className="text-xs font-mono" style={{ color: "#64748b" }}>{r.current_end_date} → <b style={{ color: "#0d2a5e" }}>{r.requested_end_date}</b></span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#334155" }}>{r.justification}</p>
                  <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
                    Requested {r.submitted_at.slice(0, 10)} by {nameOf(r.submitted_by)}
                    {r.endorsed_at ? ` · endorsed ${r.endorsed_at.slice(0, 10)} by ${nameOf(r.endorsed_by)}` : ""}
                    {r.decided_at ? ` · decided ${r.decided_at.slice(0, 10)} by ${nameOf(r.decided_by)}` : ""}
                  </p>
                  {r.remarks && <p className="text-xs mt-1 italic" style={{ color: "#64748b" }}>“{r.remarks}”</p>}
                </div>
              </div>
              {canAct && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <input className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border text-xs outline-none" style={INPUT_STYLE} placeholder="Remarks (optional)" value={remarks[r.id] ?? ""} onChange={(e) => setRemarks((x) => ({ ...x, [r.id]: e.target.value }))} />
                  {r.status === "pending" ? (
                    <button disabled={saving} onClick={() => act(r.id, "endorse")} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#e0f2fe", color: "#0369a1" }}>Endorse</button>
                  ) : (
                    <>
                      <button disabled={saving} onClick={() => act(r.id, "approve")} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#d1fae5", color: "#166534" }}>Approve</button>
                      <button disabled={saving} onClick={() => act(r.id, "deny")} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#fee2e2", color: "#991b1b" }}>Deny</button>
                    </>
                  )}
                </div>
              )}
              {!canAct && (r.status === "pending" || r.status === "endorsed") && (
                <p className="text-xs mt-2 font-semibold" style={{ color: "#94a3b8" }}>{r.status === "pending" ? "Awaiting DRD / CRC endorsement" : "Awaiting University President decision"}</p>
              )}
            </div>
          );
        })
      )}
      {show && (
        <ProtoModal title="Request Project Extension" width="max-w-md" onClose={() => setShow(false)} footer={<ModalFooter onClose={() => setShow(false)} onSave={save} saving={saving} label="Submit Request" />}>
          <Field label="New Target End Date" required>
            <input type="date" className={INPUT_CLS} style={invalidStyle(attempted && !form.requested_end_date)} value={form.requested_end_date} min={project.target_end_date ?? undefined} onChange={(e) => setForm((x) => ({ ...x, requested_end_date: e.target.value }))} />
          </Field>
          <Field label="Justification" required>
            <textarea rows={4} className={INPUT_CLS + " resize-none"} style={invalidStyle(attempted && !form.justification.trim())} value={form.justification} onChange={(e) => setForm((x) => ({ ...x, justification: e.target.value }))} />
          </Field>
        </ProtoModal>
      )}
    </div>
  );
}

const RENEWAL_META: Record<RenewalStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#e0f2fe", color: "#0369a1" },
  approved: { label: "Approved", bg: "#d1fae5", color: "#166534" },
  denied: { label: "Denied", bg: "#fee2e2", color: "#991b1b" },
};

export function RenewalPanel({ project, canReport, canDecide, onChanged, reloadKey }: { project: number; canReport: boolean; canDecide: boolean; onChanged: () => void; reloadKey: number }) {
  const [rows, setRows] = useState<RenewalApplication[] | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ application_year: String(new Date().getFullYear()), underspend_justification: "" });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    monitoringApi
      .getRenewalApplications({ project })
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [project, reloadKey]);

  const save = async () => {
    setAttempted(true);
    if (!form.application_year) {
      notify.error("Application year is required.");
      return;
    }
    setSaving(true);
    try {
      await monitoringApi.createRenewalApplication({ project, application_year: Number(form.application_year), underspend_justification: form.underspend_justification || undefined });
      notify.success("Renewal application submitted.");
      setShow(false);
      setAttempted(false);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit the renewal application."));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: number, status: RenewalStatus) => {
    setSaving(true);
    try {
      await monitoringApi.decideRenewalApplication(id, status);
      notify.success(`Renewal ${status}.`);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not record the decision."));
    } finally {
      setSaving(false);
    }
  };

  const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs" style={{ color: "#64748b" }}>Renewal needs at least 70% budget utilization and 70% deliverables (computed live).</p>
        {canReport && <AddButton label="Apply for Renewal" onClick={() => setShow(true)} />}
      </div>
      {rows === null ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <NoActualData />
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0", background: "white" }}>
          <table className="w-full text-sm">
            <TableHead cols={["Year", "Budget Used", "Deliverables", "Eligibility", "Justification", "Status"]} />
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                  <td className={td + " font-bold"} style={{ color: "#0d2a5e" }}>{r.application_year}</td>
                  <td className={td + " font-mono"} style={{ color: "#334155" }}>{pct(r.budget_used_pct)}</td>
                  <td className={td + " font-mono"} style={{ color: "#334155" }}>{pct(r.deliverables_pct)}</td>
                  <td className={td}>{r.renewal_eligible ? <Pill bg="#d1fae5" color="#166534">Eligible</Pill> : <Pill bg="#fee2e2" color="#991b1b">Below 70%</Pill>}</td>
                  <td className={td + " max-w-[240px]"} style={{ color: "#64748b" }}>{r.underspend_justification || "—"}</td>
                  <td className={td}>
                    {r.status === "pending" && canDecide ? (
                      <div className="flex gap-1.5">
                        <button disabled={saving} onClick={() => decide(r.id, "approved")} className="px-2.5 py-1 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#d1fae5", color: "#166534" }}>Approve</button>
                        <button disabled={saving} onClick={() => decide(r.id, "denied")} className="px-2.5 py-1 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#fee2e2", color: "#991b1b" }}>Deny</button>
                      </div>
                    ) : (
                      <Pill bg={RENEWAL_META[r.status].bg} color={RENEWAL_META[r.status].color}>{RENEWAL_META[r.status].label}</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {show && (
        <ProtoModal title="Apply for Renewal" width="max-w-md" onClose={() => setShow(false)} footer={<ModalFooter onClose={() => setShow(false)} onSave={save} saving={saving} label="Submit Application" />}>
          <Field label="Application Year" required>
            <input type="number" className={INPUT_CLS} style={invalidStyle(attempted && !form.application_year)} value={form.application_year} onChange={(e) => setForm((x) => ({ ...x, application_year: e.target.value }))} />
          </Field>
          <Field label="Underspend Justification">
            <textarea rows={3} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={form.underspend_justification} onChange={(e) => setForm((x) => ({ ...x, underspend_justification: e.target.value }))} placeholder="Required by policy if budget utilization is under 70%" />
          </Field>
        </ProtoModal>
      )}
    </div>
  );
}
