import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../lib/reportsApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { tasksQuery, useProjects } from "../lib/queries";
import type { ReportFormat } from "../types/reports";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { SkeletonRows } from "../components/common/proto";
import { AppShell } from "../components/layout/AppShell";

const FORMATS: ReportFormat[] = ["pdf", "docx", "xlsx", "csv"];

function AccomplishmentContent() {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [fileFormat, setFileFormat] = useState<ReportFormat>("pdf");
  const [busy, setBusy] = useState(false);
  const tasksQ = useQuery(tasksQuery());
  const projects = useProjects().data ?? [];

  useEffect(() => {
    if (tasksQ.isError) notify.error("Could not load your tasks. Check your connection and refresh.");
  }, [tasksQ.isError]);

  const accomplished = (tasksQ.data ?? [])
    .filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at).toLocaleDateString("en-CA").startsWith(month))
    .sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""));
  const totalHours = accomplished.reduce((s, t) => s + Number(t.logged_hours || 0), 0);
  const projectCode = (id: number) => projects.find((p) => p.id === id)?.project_code ?? `#${id}`;

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
        <div className="ml-auto flex gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Tasks Accomplished</p>
            <p className="text-2xl font-black" style={{ color: "#059669" }}>{tasksQ.isPending ? "…" : accomplished.length}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Hours Logged</p>
            <p className="text-2xl font-black" style={{ color: "#0d2a5e" }}>{tasksQ.isPending ? "…" : totalHours}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["#", "Project", "Task / Activity", "Completed On", "Due Date", "Hours"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasksQ.isPending ? (
              <tr>
                <td colSpan={6}>
                  <SkeletonRows rows={4} />
                </td>
              </tr>
            ) : accomplished.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <NoActualData />
                </td>
              </tr>
            ) : (
              accomplished.map((t, i) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#94a3b8" }}>{i + 1}</td>
                  <td className="px-4 py-2.5 text-xs font-mono font-semibold whitespace-nowrap" style={{ color: "#0891b2" }}>{projectCode(t.project)}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#0d2a5e" }}>{t.title}</td>
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#059669" }}>{t.completed_at ? new Date(t.completed_at).toLocaleDateString("en-CA") : "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#64748b" }}>{t.due_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#64748b" }}>{Number(t.logged_hours || 0)}</td>
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
