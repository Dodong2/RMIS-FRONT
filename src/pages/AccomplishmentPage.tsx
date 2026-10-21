import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../lib/reportsApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { queryKeys } from "../lib/queries";
import type { TaskStatus } from "../types/personnel";
import type { ReportFormat } from "../types/reports";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { SkeletonRows } from "../components/common/proto";
import { AppShell } from "../components/layout/AppShell";

const FORMATS: ReportFormat[] = ["pdf", "docx", "xlsx", "csv"];

const STATUS: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#64748b" },
  in_progress: { label: "In Progress", color: "#0369a1" },
  for_review: { label: "For Review", color: "#6b21a8" },
  blocked: { label: "Blocked", color: "#dc2626" },
  done: { label: "Done", color: "#059669" },
};

function AccomplishmentContent() {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [fileFormat, setFileFormat] = useState<ReportFormat>("pdf");
  const [busy, setBusy] = useState(false);
  // Same rows and totals as the downloaded report (client 2026-10-21). Under the "tasks" key so a Work Log or a
  // review elsewhere refreshes it.
  const summaryQ = useQuery({
    queryKey: [...queryKeys.tasksAll, "accomplishment", month],
    queryFn: () => reportsApi.getAccomplishmentSummary({ month }),
    enabled: !!month,
  });
  const summary = summaryQ.data;
  const loading = summaryQ.isLoading;

  useEffect(() => {
    if (summaryQ.isError) notify.error("Could not load your accomplishments. Check your connection and refresh.");
  }, [summaryQ.isError]);

  const download = async () => {
    setBusy(true);
    try {
      await reportsApi.downloadAccomplishment({ month, file_format: fileFormat });
    } catch (err) {
      notify.error(errorMessage(err, "Could not generate the report."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-2xl p-4 flex flex-wrap items-end gap-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Month</p>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm px-2 py-1.5 rounded-lg border" style={{ borderColor: "#e2e8f0" }} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Format</p>
          <select value={fileFormat} onChange={(e) => setFileFormat(e.target.value as ReportFormat)} className="text-sm px-2 py-1.5 rounded-lg border" style={{ borderColor: "#e2e8f0" }}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <button
          onClick={download}
          disabled={busy || !month}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
          style={{ background: "#0d2a5e" }}
        >
          {busy ? "Generating…" : "Download Accomplishment Report"}
        </button>
        <div className="ml-auto flex flex-wrap gap-6">
          {[
            { label: "Tasks Accomplished", value: summary?.accomplished, color: "#059669", hint: "Approved by your leader this month" },
            { label: "Awaiting Approval", value: summary?.awaiting_approval, color: "#6b21a8", hint: "Submitted, still For Review" },
            { label: "Hours Logged", value: summary?.total_hours, color: "#0d2a5e", hint: "Your Work Log hours this month" },
          ].map((k) => (
            <div key={k.label} title={k.hint}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{k.label}</p>
              <p className="text-2xl font-black" style={{ color: k.color }}>{loading ? "…" : (k.value ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["#", "Project", "Task / Activity", "Status", "% Completed", "Hours (this month)", "Due Date", "Completed On"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>
                  <SkeletonRows rows={4} />
                </td>
              </tr>
            ) : !summary?.rows.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-8">
                  <NoActualData />
                </td>
              </tr>
            ) : (
              summary.rows.map((t, i) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#94a3b8" }}>{i + 1}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold whitespace-nowrap" style={{ color: "#0891b2" }}>{t.project_code}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#0d2a5e" }}>
                    {t.title}
                    {t.notes && <p className="font-normal mt-0.5" style={{ color: "#64748b" }}>{t.notes}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: STATUS[t.status]?.color }}>{STATUS[t.status]?.label ?? t.status}</td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#64748b" }}>{t.progress_pct}%</td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#64748b" }}>{t.hours}</td>
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#64748b" }}>{t.due_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#059669" }}>
                    {t.status === "done" && t.completed_at ? new Date(t.completed_at).toLocaleDateString("en-CA") : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AccomplishmentPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Accomplishment Report">
        <AccomplishmentContent />
      </AppShell>
    </ProtectedRoute>
  );
}
