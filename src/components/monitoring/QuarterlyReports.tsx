import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { monitoringApi } from "../../lib/monitoringApi";
import { documentApi } from "../../lib/documentApi";
import { researchApi } from "../../lib/researchApi";
import { downloadReport, reportErrorMessage } from "../../lib/reportsApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { workAllowed } from "../../lib/projectReview";
import { useAuth } from "../../context/AuthContext";
import { RECONNECTED, useRealtime } from "../../hooks/useRealtime";
import { ProtoModal, SkeletonRows } from "../common/proto";
import type { ProjectDocument } from "../../types/document";
import type {
  QuarterlyAccomplishment,
  QuarterlyIssue,
  QuarterlyReport,
  QuarterlyReportEdit,
  QuarterlyReportStatus,
} from "../../types/monitoring";
import type { Project } from "../../types/research";

const PREPARE_ROLE_CODES = ["project_leader"];
const REVIEW_ROLE_CODES = ["riuh", "crc_chair", "vprei"];
const APPROVE_ROLE_CODES = ["vprei"];
const EDITABLE: QuarterlyReportStatus[] = ["draft", "returned_for_revision"];
const QUARTERLY_EVENTS = ["monitoring.quarterly.changed"];

const STATUS_META: Record<QuarterlyReportStatus, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "#f1f5f9", color: "#475569" },
  submitted: { label: "Submitted", bg: "#dbeafe", color: "#1d4ed8" },
  under_review: { label: "Under Review", bg: "#e0f2fe", color: "#0369a1" },
  returned_for_revision: { label: "For Revision", bg: "#fef3c7", color: "#b45309" },
  endorsed: { label: "Endorsed", bg: "#ede9fe", color: "#6d28d9" },
  approved: { label: "Approved", bg: "#dcfce7", color: "#15803d" },
};

const EMPTY_ROW: QuarterlyAccomplishment = {
  objective: "", activity: "", target: "", actual: "", cumulative: "", target_date: "", actual_date: "",
  completion_pct: 0, variance: "", remarks: "",
};
const EMPTY_ISSUE: QuarterlyIssue = {
  issue: "", corrective_action: "", recommendation: "", responsible: "", target_resolution_date: "",
};

const money = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const collegeName = (college: string) => college.split(" - ").slice(1).join(" - ") || college;
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-PH");
const SELECT = "w-full rounded-lg border px-3 py-2 text-sm font-semibold outline-none";
const SELECT_STYLE = { borderColor: "#cbd5e1", background: "white", color: "#334155" };
const INPUT = "w-full rounded-lg border px-2 py-1.5 text-xs outline-none";
const INPUT_STYLE = { borderColor: "#94a3b8", background: "white" };

function StatusBadge({ status }: { status: QuarterlyReportStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();

export function QuarterlyReports() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const isStaff = code === "project_staff";
  const [reports, setReports] = useState<QuarterlyReport[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [filters, setFilters] = useState({ campus: "", college: "", year: "", quarter: "", agency: "", leader: "", status: "" });

  const load = useCallback(() => {
    monitoringApi
      .getQuarterlyReports()
      .then(setReports)
      .catch(() => {
        setReports((cur) => cur ?? []);
        notify.error("Could not load the quarterly reports.");
      });
  }, []);
  useEffect(load, [load]);
  useRealtime(QUARTERLY_EVENTS, (msg) => {
    if (msg.type === RECONNECTED || msg.type === "monitoring.quarterly.changed") load();
  });

  const all = useMemo(() => reports ?? [], [reports]);
  const filtered = all.filter((r) => {
    const f = filters;
    return (
      (!f.campus || r.project_info.campus === f.campus) &&
      (!f.college || r.project_info.college === f.college) &&
      (!f.year || String(r.year) === f.year) &&
      (!f.quarter || String(r.quarter) === f.quarter) &&
      (!f.agency || r.project_info.funding_agency.split(", ").includes(f.agency)) &&
      (!f.leader || r.project_info.leader === f.leader) &&
      (!f.status || (f.status === "overdue" ? r.is_overdue : r.status === f.status))
    );
  });
  const approved = filtered.filter((r) => r.status === "approved");
  const counts = [
    ["Draft Reports", all.filter((r) => r.status === "draft").length, "#64748b"],
    ["Submitted", all.filter((r) => r.status === "submitted").length, "#1d4ed8"],
    ["For Review", all.filter((r) => r.status === "under_review" || r.status === "endorsed").length, "#0369a1"],
    ["For Revision", all.filter((r) => r.status === "returned_for_revision").length, "#b45309"],
    ["Approved", all.filter((r) => r.status === "approved").length, "#15803d"],
    ["Overdue", all.filter((r) => r.is_overdue).length, "#b91c1c"],
  ] as const;

  const filterDefs: [keyof typeof filters, string, [string, string][]][] = [
    ["campus", "All Campus", uniq(all.map((r) => r.project_info.campus)).map((c) => [c, c])],
    ["college", "All Colleges", uniq(all.map((r) => r.project_info.college)).map((c) => [c, collegeName(c)])],
    ["year", "All Years", uniq(all.map((r) => String(r.year))).reverse().map((y) => [y, y])],
    ["quarter", "All Quarters", [1, 2, 3, 4].map((q) => [String(q), `Q${q}`])],
    ...(isStaff
      ? []
      : [["agency", "All Funding Agencies", uniq(all.flatMap((r) => r.project_info.funding_agency.split(", "))).map((a) => [a, a])] as (typeof filterDefs)[number]]),
    ["leader", "All Project Leaders", uniq(all.map((r) => r.project_info.leader)).map((l) => [l, l])],
    ["status", "All Status", [...Object.entries(STATUS_META).map(([k, m]) => [k, m.label] as [string, string]), ["overdue", "Overdue"]]],
  ];
  const filterLabels: Record<keyof typeof filters, string> = {
    campus: "Campus", college: "College", year: "Year", quarter: "Quarter", agency: "Funding Agency", leader: "Project Leader", status: "Status",
  };

  const exportApproved = async (fileFormat: "pdf" | "docx") => {
    setExporting(fileFormat);
    try {
      await downloadReport(
        "/api/monitoring/quarterly-reports/export/",
        { file_format: fileFormat, ids: approved.map((r) => r.id).join(",") },
        `quarterly_progress_reports.${fileFormat}`,
      );
    } catch (err) {
      notify.error(await reportErrorMessage(err, "Could not export the approved reports."));
    } finally {
      setExporting(null);
    }
  };

  const open = all.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black" style={{ color: "#0d2a5e" }}>R&amp;D Quarterly Progress Reports</h2>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Persistent quarterly accomplishments, financial snapshots, review, revision, and approval history
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!approved.length || exporting !== null}
            onClick={() => exportApproved("pdf")}
            className="rounded-lg border px-4 py-2 text-xs font-bold disabled:opacity-40"
            style={{ borderColor: "#0d2a5e", color: "#0d2a5e", background: "white" }}
          >
            {exporting === "pdf" ? "Exporting…" : "Export Approved PDF"}
          </button>
          <button
            type="button"
            disabled={!approved.length || exporting !== null}
            onClick={() => exportApproved("docx")}
            className="rounded-lg border px-4 py-2 text-xs font-bold disabled:opacity-40"
            style={{ borderColor: "#15803d", color: "#15803d", background: "white" }}
          >
            {exporting === "docx" ? "Exporting…" : "Export Approved Word"}
          </button>
          {PREPARE_ROLE_CODES.includes(code) && (
            <button type="button" onClick={() => setCreating(true)} className="rounded-lg px-4 py-2 text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
              Create Quarterly Report
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {counts.map(([label, value, color]) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
            <p className="mt-1 text-2xl font-black" style={{ color }}>{reports === null ? "—" : value}</p>
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-4 ${isStaff ? "xl:grid-cols-6" : "xl:grid-cols-7"}`} style={{ background: "white", border: "1px solid #e2e8f0" }}>
        {filterDefs.map(([key, all_, options]) => (
          <label key={key} className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wide" style={{ color: "#475569" }}>
            {filterLabels[key]}
            <select
              value={filters[key]}
              onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              className={`${SELECT} normal-case tracking-normal`}
              style={SELECT_STYLE}
            >
              <option value="">{all_}</option>
              {options.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        {reports === null ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm" style={{ color: "#64748b" }}>
            {all.length === 0 ? "No quarterly reports yet." : "No reports match the selected filters."}
          </p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "#e2e8f0" }}>
                {["Project", "Period", "Campus / College", "Leader", "Financial Performance", "Status", "Updated", "Action"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "#475569" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0" style={{ borderColor: "#f1f5f9" }}>
                  <td className="max-w-xs px-4 py-3">
                    <p className="font-bold" style={{ color: "#0d2a5e" }}>{r.project_info.code}</p>
                    <p className="text-xs" style={{ color: "#475569" }}>{r.project_info.title}</p>
                  </td>
                  <td className="px-4 py-3 font-bold whitespace-nowrap" style={{ color: "#0f172a" }}>{r.period}</td>
                  <td className="px-4 py-3 text-xs">
                    <p style={{ color: "#334155" }}>{r.project_info.campus || "—"}</p>
                    <p style={{ color: "#0891b2" }}>{collegeName(r.project_info.college) || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#334155" }}>{r.project_info.leader}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <p style={{ color: "#334155" }}>{money(r.financial_snapshot.quarter_disbursements ?? 0)} quarter</p>
                    <p style={{ color: "#0891b2" }}>{r.financial_snapshot.utilization_pct ?? 0}% cumulative</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={r.status} />
                      {r.is_overdue && <span className="text-[11px] font-bold" style={{ color: "#b91c1c" }}>Overdue</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#334155" }}>{new Date(r.updated_at).toLocaleDateString("en-PH")}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="rounded-lg border px-4 py-1.5 text-xs font-bold"
                      style={{ borderColor: "#0d2a5e", color: "#0d2a5e" }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <CreateReportModal
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setCreating(false);
            setReports((cur) => [r, ...(cur ?? [])]);
            setOpenId(r.id);
          }}
        />
      )}
      {open && (
        <ReportModal
          report={open}
          onClose={() => setOpenId(null)}
          onChanged={(r) => setReports((cur) => (cur ?? []).map((x) => (x.id === r.id ? r : x)))}
        />
      )}
    </div>
  );
}

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: QuarterlyReport) => void }) {
  const { user } = useAuth();
  const now = new Date();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [form, setForm] = useState({ project: "", year: String(now.getFullYear()), quarter: String(Math.floor(now.getMonth() / 3) + 1) });
  const [saving, setSaving] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    researchApi
      .getProjects()
      .then((all) => setProjects(all.filter((p) => p.lead_detail.id === user?.pk)))
      .catch(() => {
        setProjects([]);
        notify.error("Could not load your projects.");
      });
  }, [user?.pk]);

  const create = async () => {
    setSaving(true);
    try {
      const r = await monitoringApi.createQuarterlyReport(
        { project: Number(form.project), year: Number(form.year), quarter: Number(form.quarter) },
        requestKey,
      );
      notify.success(`Q${r.quarter} ${r.year} report created as a draft.`);
      onCreated(r);
    } catch (err) {
      notify.error(errorMessage(err, "Could not create the report."));
    } finally {
      setSaving(false);
    }
  };

  const eligible = (projects ?? []).filter((p) => workAllowed(p.review_status));
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  return (
    <ProtoModal
      title="Create Quarterly Report"
      subtitle="Prefilled from the project's work plan and posted financial ledger"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-bold" style={{ borderColor: "#cbd5e1", color: "#475569" }}>Cancel</button>
          <button
            type="button"
            disabled={!form.project || saving}
            onClick={create}
            className="rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            style={{ background: "#0d2a5e" }}
          >
            {saving ? "Creating…" : "Create Draft"}
          </button>
        </>
      }
    >
      {projects === null ? (
        <SkeletonRows rows={2} />
      ) : projects.length === 0 ? (
        <p className="text-sm" style={{ color: "#64748b" }}>You don't lead any registered project yet.</p>
      ) : eligible.length === 0 ? (
        <p className="text-sm" style={{ color: "#64748b" }}>
          None of your projects has completed its reviews yet. A quarterly report starts once the Budget Officer certifies the project's LIB.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-bold sm:col-span-3" style={{ color: "#475569" }}>
            Project
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={SELECT} style={SELECT_STYLE}>
              <option value="">Select a project</option>
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: "#475569" }}>
            Year
            <select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={SELECT} style={SELECT_STYLE}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: "#475569" }}>
            Quarter
            <select value={form.quarter} onChange={(e) => setForm({ ...form, quarter: e.target.value })} className={SELECT} style={SELECT_STYLE}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </label>
        </div>
      )}
    </ProtoModal>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#f8fafc" }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="mt-1 text-sm font-bold" style={{ color: "#0f172a" }}>{value || "—"}</p>
    </div>
  );
}

function SectionTitle({ children, aside }: { children: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-black" style={{ color: "#0d2a5e" }}>{children}</h3>
      {aside}
    </div>
  );
}

function ReportModal({ report, onClose, onChanged }: { report: QuarterlyReport; onClose: () => void; onChanged: (r: QuarterlyReport) => void }) {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const isOwner = PREPARE_ROLE_CODES.includes(code) && report.project_info.leader_id === user?.pk;
  const editable = isOwner && EDITABLE.includes(report.status);
  const reviewer = REVIEW_ROLE_CODES.includes(code);
  const approver = APPROVE_ROLE_CODES.includes(code);

  const [draft, setDraft] = useState<Required<QuarterlyReportEdit>>({
    accomplishments: report.accomplishments,
    issues: report.issues,
    evidence: report.evidence,
    recommendations: report.recommendations,
  });
  const [dirty, setDirty] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocument[] | null>(null);

  useEffect(() => {
    if (!editable) return;
    documentApi
      .getDocuments({ project: report.project, current_only: true })
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, [editable, report.project]);

  const edit = (patch: Partial<Required<QuarterlyReportEdit>>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const editRow = (i: number, patch: Partial<QuarterlyAccomplishment>) =>
    edit({ accomplishments: draft.accomplishments.map((row, j) => (j === i ? { ...row, ...patch } : row)) });
  const editIssue = (i: number, patch: Partial<QuarterlyIssue>) =>
    edit({ issues: draft.issues.map((row, j) => (j === i ? { ...row, ...patch } : row)) });

  const save = async () => {
    const r = await monitoringApi.updateQuarterlyReport(report.id, draft);
    setDirty(false);
    onChanged(r);
    return r;
  };

  const run = async (action: () => Promise<QuarterlyReport>, done: string) => {
    setBusy(true);
    try {
      const r = await action();
      onChanged(r);
      setRemarks("");
      notify.success(done);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the report."));
    } finally {
      setBusy(false);
    }
  };
  const move = (status: QuarterlyReportStatus, done: string) =>
    run(async () => {
      if (dirty) await save();
      return monitoringApi.transitionQuarterlyReport(report.id, status, remarks);
    }, done);

  const fin = report.financial_snapshot;
  const p = report.project_info;
  const objectives = uniq([...p.objectives, ...draft.accomplishments.map((r) => r.objective)]);
  const rows = editable ? draft.accomplishments : report.accomplishments;
  const issues = editable ? draft.issues : report.issues;

  const btn = "rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40";
  const footer = (
    <div className="flex w-full flex-wrap items-end gap-2">
      {(reviewer && ["submitted", "under_review", "endorsed"].includes(report.status)) && (
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-bold" style={{ color: "#475569" }}>
          Reviewer remarks
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={INPUT} style={INPUT_STYLE} />
        </label>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        {editable && (
          <>
            <button type="button" disabled={busy || !dirty} onClick={() => run(save, "Draft saved.")} className={`${btn} border`} style={{ borderColor: "#0d2a5e", color: "#0d2a5e" }}>
              Save Draft
            </button>
            <button type="button" disabled={busy || draft.accomplishments.length === 0} onClick={() => move("submitted", "Report submitted for review.")} className={`${btn} text-white`} style={{ background: "#0d2a5e" }}>
              Submit Report
            </button>
          </>
        )}
        {reviewer && report.status === "submitted" && (
          <button type="button" disabled={busy} onClick={() => move("under_review", "Review started.")} className={`${btn} text-white`} style={{ background: "#0369a1" }}>
            Start Review
          </button>
        )}
        {reviewer && ["under_review", "endorsed"].includes(report.status) && (
          <button type="button" disabled={busy || !remarks.trim()} onClick={() => move("returned_for_revision", "Returned for revision.")} className={`${btn} border`} style={{ borderColor: "#d97706", color: "#b45309" }} title={remarks.trim() ? undefined : "Write what needs to be revised first"}>
            Return for Revision
          </button>
        )}
        {reviewer && report.status === "under_review" && (
          <button type="button" disabled={busy} onClick={() => (approver ? move("approved", "Report approved.") : move("endorsed", "Report endorsed for final approval."))} className={`${btn} text-white`} style={{ background: "#059669" }}>
            {approver ? "Approve" : "Endorse"}
          </button>
        )}
        {approver && report.status === "endorsed" && (
          <button type="button" disabled={busy} onClick={() => move("approved", "Report approved.")} className={`${btn} text-white`} style={{ background: "#059669" }}>
            Final Approval
          </button>
        )}
      </div>
    </div>
  );

  const cell = "px-2 py-2 align-top";
  return (
    <ProtoModal
      width="max-w-6xl"
      title={
        <span className="flex flex-wrap items-center gap-3">
          {p.code} · {report.period} <StatusBadge status={report.status} />
        </span>
      }
      subtitle={`Version ${report.version} · ${p.title}`}
      onClose={onClose}
      footer={footer}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoCard label="Project Leader" value={p.leader} />
        <InfoCard label="Campus" value={p.campus} />
        <InfoCard label="College" value={collegeName(p.college)} />
        <InfoCard label="Funding Source" value={p.funding_agency} />
        <InfoCard label="Approved Duration" value={p.start_date || p.end_date ? `${p.start_date ?? "—"} to ${p.end_date ?? "—"}` : ""} />
        <InfoCard label="Original Budget" value={money(fin.original_budget ?? 0)} />
        <InfoCard label="Quarter Disbursement" value={money(fin.quarter_disbursements ?? 0)} />
        <InfoCard label="Budget Utilization" value={`${fin.utilization_pct ?? 0}%`} />
      </div>

      <SectionTitle
        aside={editable && (
          <button type="button" onClick={() => edit({ accomplishments: [...draft.accomplishments, { ...EMPTY_ROW }] })} className="rounded-lg border px-3 py-1 text-xs font-bold" style={{ borderColor: "#0d2a5e", color: "#0d2a5e" }}>
            + Add Row
          </button>
        )}
      >
        Quarterly Accomplishments
      </SectionTitle>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#e2e8f0" }}>
        <table className="w-full min-w-[1400px] text-xs">
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Approved Objective", "Planned Activity / Milestone", "Target", "Actual this Quarter", "Cumulative", "Target Date", "Actual Date", "Completion %", "Variance", "Remarks / Delay Explanation", ...(editable ? [""] : [])].map((h, i) => (
                <th key={`${h}-${i}`} className="px-2 py-2 text-left font-bold" style={{ color: "#475569" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center" style={{ color: "#64748b" }}>
                  No work-plan activity falls in this quarter. {editable && "Add a row for each activity you worked on."}
                </td>
              </tr>
            )}
            {rows.map((row, i) =>
              editable ? (
                <tr key={i} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                  <td className={`${cell} w-48`}>
                    <select value={row.objective} onChange={(e) => editRow(i, { objective: e.target.value })} className={INPUT} style={INPUT_STYLE}>
                      <option value="">Select objective</option>
                      {objectives.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  {(["activity", "target", "actual", "cumulative"] as const).map((k) => (
                    <td key={k} className={cell}>
                      <textarea value={row[k]} onChange={(e) => editRow(i, { [k]: e.target.value })} rows={3} className={INPUT} style={INPUT_STYLE} />
                    </td>
                  ))}
                  {(["target_date", "actual_date"] as const).map((k) => (
                    <td key={k} className={cell}>
                      <input type="date" value={row[k]} onChange={(e) => editRow(i, { [k]: e.target.value })} className={INPUT} style={INPUT_STYLE} />
                    </td>
                  ))}
                  <td className={`${cell} w-20`}>
                    <input type="number" min={0} max={100} value={row.completion_pct} onChange={(e) => editRow(i, { completion_pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className={INPUT} style={INPUT_STYLE} />
                  </td>
                  <td className={`${cell} w-24`}>
                    <input value={row.variance} onChange={(e) => editRow(i, { variance: e.target.value })} className={INPUT} style={INPUT_STYLE} />
                  </td>
                  <td className={cell}>
                    <textarea value={row.remarks} onChange={(e) => editRow(i, { remarks: e.target.value })} rows={3} className={INPUT} style={INPUT_STYLE} />
                  </td>
                  <td className={cell}>
                    <button type="button" onClick={() => edit({ accomplishments: draft.accomplishments.filter((_, j) => j !== i) })} className="text-xs font-bold" style={{ color: "#dc2626" }} aria-label="Remove row">
                      Remove
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={i} className="border-t" style={{ borderColor: "#f1f5f9", color: "#334155" }}>
                  <td className={cell}>{row.objective}</td>
                  <td className={cell}>{row.activity}</td>
                  <td className={cell}>{row.target}</td>
                  <td className={cell}>{row.actual}</td>
                  <td className={cell}>{row.cumulative}</td>
                  <td className={cell}>{row.target_date}</td>
                  <td className={cell}>{row.actual_date || "—"}</td>
                  <td className={`${cell} font-bold`}>{row.completion_pct}</td>
                  <td className={cell}>{row.variance}</td>
                  <td className={cell}>{row.remarks}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <SectionTitle
        aside={editable && (
          <button type="button" onClick={() => edit({ issues: [...draft.issues, { ...EMPTY_ISSUE }] })} className="rounded-lg border px-3 py-1 text-xs font-bold" style={{ borderColor: "#0d2a5e", color: "#0d2a5e" }}>
            + Add Issue
          </button>
        )}
      >
        Issues and Corrective Actions
      </SectionTitle>
      {issues.length === 0 ? (
        <p className="text-xs" style={{ color: "#64748b" }}>No issues recorded.</p>
      ) : (
        issues.map((issue, i) => (
          <div key={i} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: "#e2e8f0" }}>
            {([
              ["issue", "Issue"],
              ["corrective_action", "Corrective Action"],
              ["recommendation", "Recommendation"],
              ["responsible", "Responsible"],
              ["target_resolution_date", "Target Resolution Date"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
                {editable ? (
                  k === "target_resolution_date" ? (
                    <input type="date" value={issue[k]} onChange={(e) => editIssue(i, { [k]: e.target.value })} className={INPUT} style={INPUT_STYLE} />
                  ) : (
                    <textarea value={issue[k]} onChange={(e) => editIssue(i, { [k]: e.target.value })} rows={2} className={INPUT} style={INPUT_STYLE} />
                  )
                ) : (
                  <p className="text-xs" style={{ color: "#334155" }}>{issue[k] || "—"}</p>
                )}
              </div>
            ))}
            {editable && (
              <div className="flex items-end">
                <button type="button" onClick={() => edit({ issues: draft.issues.filter((_, j) => j !== i) })} className="text-xs font-bold" style={{ color: "#dc2626" }}>
                  Remove issue
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <SectionTitle>Evidence and Existing RMIS Document / Output Links</SectionTitle>
      {editable ? (
        documents === null ? (
          <SkeletonRows rows={1} />
        ) : documents.length === 0 ? (
          <p className="text-xs" style={{ color: "#64748b" }}>This project has no documents yet. Upload them in Document and Records Management first.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {documents.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-xs" style={{ color: "#334155" }}>
                <input
                  type="checkbox"
                  checked={draft.evidence.includes(d.id)}
                  onChange={(e) => edit({ evidence: e.target.checked ? [...draft.evidence, d.id] : draft.evidence.filter((x) => x !== d.id) })}
                />
                {d.file_name}
              </label>
            ))}
          </div>
        )
      ) : report.evidence_files.length === 0 ? (
        <p className="text-xs" style={{ color: "#64748b" }}>No evidence linked.</p>
      ) : (
        <ul className="list-disc pl-5 text-xs" style={{ color: "#0369a1" }}>
          {report.evidence_files.map((d) => <li key={d.id}>{d.file_name}</li>)}
        </ul>
      )}

      <SectionTitle>Overall Recommendations</SectionTitle>
      {editable ? (
        <textarea value={draft.recommendations} onChange={(e) => edit({ recommendations: e.target.value })} rows={3} className={INPUT} style={INPUT_STYLE} />
      ) : (
        <p className="text-xs whitespace-pre-wrap" style={{ color: "#334155" }}>{report.recommendations || "—"}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <SectionTitle>Review History</SectionTitle>
          {report.review_history.length === 0 ? (
            <p className="text-xs" style={{ color: "#64748b" }}>No reviewer comments yet.</p>
          ) : (
            report.review_history.map((e, i) => (
              <div key={i} className="rounded-xl border p-3 text-xs" style={{ borderColor: "#e2e8f0" }}>
                <p className="font-bold" style={{ color: "#0f172a" }}>{e.actor}</p>
                <p style={{ color: "#94a3b8" }}>{dateTime(e.at)}</p>
                <p className="mt-1" style={{ color: "#334155" }}>{e.remarks}</p>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          <SectionTitle>Audit Trail</SectionTitle>
          {report.events.map((e, i) => (
            <div key={i} className="rounded-xl border p-3 text-xs" style={{ borderColor: "#e2e8f0" }}>
              <p className="font-bold" style={{ color: "#0f172a" }}>
                {e.actor} · {e.action}
                {e.action === "status_transition" && ` → ${STATUS_META[e.to_status as QuarterlyReportStatus]?.label ?? e.to_status}`}
              </p>
              <p style={{ color: "#94a3b8" }}>{dateTime(e.at)}</p>
              {e.remarks && <p className="mt-1" style={{ color: "#334155" }}>{e.remarks}</p>}
            </div>
          ))}
        </div>
      </div>
    </ProtoModal>
  );
}
