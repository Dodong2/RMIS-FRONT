import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../lib/authApi";
import { documentApi } from "../lib/documentApi";
import { monitoringApi } from "../lib/monitoringApi";
import { researchApi } from "../lib/researchApi";
import { reportsApi, reportErrorMessage } from "../lib/reportsApi";
import { runServerReport, type ReportParams } from "../lib/reportRunner";
import { DOMAIN_META, FORMAT_META, FUNDING_TYPE_LABELS, PARAM_LABELS, REPORT_DEFINITIONS, STATUS_LABELS, type ReportDefinition, type ReportDomain, type ReportParam } from "../lib/reportCatalog";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { SCHEDULED_REPORTS } from "../mocks/reports";
import type { GeneratedReportLog } from "../types/reports";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { NoActualData } from "../components/common/NoActualData";
import { SkeletonRows, TableHead } from "../components/common/proto";
import { GenerateReportModal } from "../components/reports/GenerateReportModal";
import { useAuth } from "../context/AuthContext";

const REPORT_LOG_VIEW_ROLE_CODES = ["system_admin", "riuh", "drd", "vprei"];

type Tab = "catalog" | "history" | "submitted" | "scheduled";
type SubmittedKind = "monthly" | "midterm" | "terminal";

type Submitted = {
  key: string;
  kind: SubmittedKind;
  project: number;
  label: string;
  narrative: string;
  document: number | null;
  submittedBy: number;
  submittedAt: string;
  certified: boolean | null;
};

const KIND_META: Record<SubmittedKind, { label: string; icon: string; color: string; bg: string }> = {
  monthly: { label: "Monthly Progress Report", icon: "🗓️", color: "#0891b2", bg: "#e0f2fe" },
  midterm: { label: "Midterm Report (Appendix E)", icon: "📋", color: "#7c3aed", bg: "#ede9fe" },
  terminal: { label: "Terminal Report (Appendix F)", icon: "📘", color: "#0d2a5e", bg: "#e0eaf7" },
};

const selCls = "px-3 py-2 rounded-xl border text-xs outline-none";
const selSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };
const fmtDateTime = (iso: string) => iso.slice(0, 16).replace("T", " ");
const monthLabel = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "long", year: "numeric" });

function ReportsContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canViewLogs = REPORT_LOG_VIEW_ROLE_CODES.includes(code);

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [logs, setLogs] = useState<GeneratedReportLog[] | null>(null);
  const [submitted, setSubmitted] = useState<Submitted[] | null>(null);
  const [logsKey, setLogsKey] = useState(0);

  const [tab, setTab] = useState<Tab>("catalog");
  const [domainFilter, setDomainFilter] = useState<ReportDomain | "all">("all");
  const [gen, setGen] = useState<{ def: ReportDefinition; initial?: ReportParams } | null>(null);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [kindFilter, setKindFilter] = useState<SubmittedKind | "all">("all");
  const [projectFilter, setProjectFilter] = useState<number | "all">("all");

  useEffect(() => {
    let alive = true;
    researchApi
      .getProjects()
      .then((p) => {
        if (!alive) return;
        setProjects(p);
        setNames((m) => new Map([...m, ...p.map((x) => [x.lead_detail.id, x.lead_detail.email] as [number, string])]));
      })
      .catch(() => {
        if (!alive) return;
        setProjects([]);
        notify.error("Could not load projects.");
      });
    Promise.all([monitoringApi.getMonthlyReports(), monitoringApi.getMidtermReports(), monitoringApi.getTerminalReports()])
      .then(([monthly, midterm, terminal]) => {
        if (!alive) return;
        setSubmitted(
          [
            ...monthly.map((r): Submitted => ({ key: `m${r.id}`, kind: "monthly", project: r.project, label: monthLabel(r.period), narrative: r.narrative, document: r.document, submittedBy: r.submitted_by, submittedAt: r.submitted_at, certified: null })),
            ...midterm.map((r): Submitted => ({ key: `d${r.id}`, kind: "midterm", project: r.project, label: `Project Year ${r.project_year}`, narrative: r.narrative, document: r.document, submittedBy: r.submitted_by, submittedAt: r.submitted_at, certified: null })),
            ...terminal.map((r): Submitted => ({ key: `t${r.id}`, kind: "terminal", project: r.project, label: "End of project", narrative: r.narrative, document: r.document, submittedBy: r.submitted_by, submittedAt: r.submitted_at, certified: r.is_certified })),
          ].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
        );
      })
      .catch(() => alive && setSubmitted([]));
    if (code === "system_admin") {
      authApi
        .getUsers()
        .then((u) => alive && setNames((m) => new Map([...m, ...u.map((x) => [x.id, x.email] as [number, string])])))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    if (!canViewLogs) return;
    let alive = true;
    reportsApi
      .getLogs()
      .then((l) => alive && setLogs(l))
      .catch(() => alive && setLogs([]));
    return () => {
      alive = false;
    };
  }, [canViewLogs, logsKey]);

  const nameOf = (id: number) => (id === user?.pk ? user.email : names.get(id) ?? `User #${id}`);
  const projectCode = (id: number) => projects?.find((p) => p.id === id)?.project_code ?? `Project #${id}`;
  const defOf = (id: string) => REPORT_DEFINITIONS.find((d) => d.id === id);

  const visibleDefs = REPORT_DEFINITIONS.filter((d) => domainFilter === "all" || d.domain === domainFilter);
  const shownSubmitted = useMemo(
    () => (submitted ?? []).filter((s) => (kindFilter === "all" || s.kind === kindFilter) && (projectFilter === "all" || s.project === projectFilter)),
    [submitted, kindFilter, projectFilter],
  );

  const filterChips = (log: GeneratedReportLog) =>
    Object.entries(log.filters)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => {
        if (k === "project_id") return ["Project", projectCode(Number(v))];
        if (k === "funding_type") return [PARAM_LABELS.funding_type, FUNDING_TYPE_LABELS[String(v)] ?? String(v)];
        if (k === "status") return [PARAM_LABELS.status, STATUS_LABELS[String(v)] ?? String(v)];
        return [PARAM_LABELS[k as ReportParam] ?? k, String(v)];
      });

  const regenerate = async (log: GeneratedReportLog) => {
    const params: ReportParams = {};
    Object.entries(log.filters).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") return;
      params[(k === "project_id" ? "project" : k) as ReportParam] = String(v);
    });
    setRegenerating(log.id);
    try {
      await runServerReport(log.report_type, params, log.format);
      setLogsKey((k) => k + 1);
    } catch (err) {
      notify.error(await reportErrorMessage(err, "Could not regenerate the report."));
    } finally {
      setRegenerating(null);
    }
  };

  const openDocument = async (id: number) => {
    try {
      const full = await documentApi.getDocument(id);
      if (full.download_url) window.open(full.download_url, "_blank", "noopener");
      else notify.error("This document has no downloadable file.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not open the document."));
    }
  };

  if (projects === null) return <SkeletonRows />;

  const kpis = [
    { label: "Available Reports", val: REPORT_DEFINITIONS.length, color: "#0d2a5e", bg: "#e0eaf7" },
    { label: "Report Domains", val: new Set(REPORT_DEFINITIONS.map((d) => d.domain)).size, color: "#0891b2", bg: "#e0f2fe" },
    { label: "Generated (Log)", val: canViewLogs ? (logs?.length ?? "—") : "—", color: "#7c3aed", bg: "#ede9fe" },
    { label: "Submitted Reports", val: submitted?.length ?? "—", color: "#059669", bg: "#d1fae5" },
  ];

  const tabs: [Tab, string][] = [
    ["catalog", "Report Catalog"],
    ...(canViewLogs ? ([["history", "Generation History"]] as [Tab, string][]) : []),
    ["submitted", "Submitted Reports"],
    ["scheduled", "Scheduled Reports"],
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: k.bg }}>
            <p className="text-3xl font-black" style={{ color: k.color }}>{k.val}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: k.color }}>{k.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex items-center justify-between px-2 border-b flex-wrap" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex flex-wrap">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
                {l}
              </button>
            ))}
          </div>
          {tab === "submitted" && (
            <Link to="/monitoring" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold mr-2 my-1.5" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
              + Submit in Monitoring &amp; Evaluation
            </Link>
          )}
        </div>

        <div className="p-5">
          {tab === "catalog" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setDomainFilter("all")} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all" style={{ background: domainFilter === "all" ? "#0d2a5e" : "#f1f5f9", color: domainFilter === "all" ? "white" : "#64748b" }}>
                  All ({REPORT_DEFINITIONS.length})
                </button>
                {(Object.keys(DOMAIN_META) as ReportDomain[]).map((k) => {
                  const m = DOMAIN_META[k];
                  const count = REPORT_DEFINITIONS.filter((d) => d.domain === k).length;
                  if (count === 0) return null;
                  return (
                    <button key={k} onClick={() => setDomainFilter(k)} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all" style={{ background: domainFilter === k ? m.bg : "#f1f5f9", color: domainFilter === k ? m.color : "#64748b", border: domainFilter === k ? `1.5px solid ${m.color}30` : "1.5px solid transparent" }}>
                      {m.icon} {m.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleDefs.map((def) => {
                  const dm = DOMAIN_META[def.domain];
                  return (
                    <div key={def.id} className="rounded-2xl p-4 hover:shadow-md transition-all flex flex-col" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: dm.bg }}>{def.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold leading-tight" style={{ color: "#0d2a5e" }}>{def.name}</p>
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: dm.bg, color: dm.color }}>{dm.label}</span>
                        </div>
                      </div>
                      <p className="text-xs mb-3 flex-1" style={{ color: "#64748b" }}>{def.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {def.formats.map((f) => (
                            <span key={f} className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: FORMAT_META[f].bg, color: FORMAT_META[f].color }}>{FORMAT_META[f].label}</span>
                          ))}
                        </div>
                        <button onClick={() => setGen({ def })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                          Generate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "history" && canViewLogs && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
                {logs?.length ?? 0} server report{logs?.length === 1 ? "" : "s"} generated · Regenerate re-runs the same filters on current data
              </p>
              {logs === null ? (
                <SkeletonRows />
              ) : logs.length === 0 ? (
                <NoActualData message="No reports generated yet." hint="Generate one from the Report Catalog." />
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                  <div className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                    {logs.map((log) => {
                      const def = defOf(log.report_type);
                      const dm = DOMAIN_META[def?.domain ?? "institutional"];
                      const fm = FORMAT_META[log.format];
                      const chips = filterChips(log);
                      return (
                        <div key={log.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: dm.bg }}>{def?.icon ?? dm.icon}</div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{def?.name ?? log.report_type}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: dm.bg, color: dm.color }}>{dm.label}</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: fm.bg, color: fm.color }}>{fm.label}</span>
                                </div>
                                <p className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>
                                  {nameOf(log.generated_by)} · {fmtDateTime(log.generated_at)}
                                </p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                  {chips.length === 0 ? (
                                    <span className="text-xs" style={{ color: "#94a3b8" }}>No filters (all records)</span>
                                  ) : (
                                    chips.map(([k, v]) => (
                                      <span key={k} className="text-xs" style={{ color: "#94a3b8" }}>
                                        {k}: <strong style={{ color: "#334155" }}>{v}</strong>
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => regenerate(log)} disabled={regenerating !== null} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all hover:opacity-80 disabled:opacity-50" style={{ background: fm.bg, color: fm.color, border: `1px solid ${fm.color}30` }}>
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                              {regenerating === log.id ? "Generating…" : `Regenerate ${fm.label}`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "submitted" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Submitted", val: submitted?.length ?? 0, color: "#0d2a5e", bg: "#e0eaf7" },
                  { label: "Monthly", val: submitted?.filter((s) => s.kind === "monthly").length ?? 0, color: "#0891b2", bg: "#e0f2fe" },
                  { label: "Midterm", val: submitted?.filter((s) => s.kind === "midterm").length ?? 0, color: "#7c3aed", bg: "#ede9fe" },
                  { label: "Terminal (certified)", val: `${submitted?.filter((s) => s.kind === "terminal").length ?? 0} (${submitted?.filter((s) => s.certified).length ?? 0})`, color: "#059669", bg: "#d1fae5" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg }}>
                    <p className="text-2xl font-black" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: s.color }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as SubmittedKind | "all")} className={selCls} style={selSt}>
                  <option value="all">All Report Types</option>
                  {(Object.keys(KIND_META) as SubmittedKind[]).map((k) => (
                    <option key={k} value={k}>{KIND_META[k].label}</option>
                  ))}
                </select>
                <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value === "all" ? "all" : Number(e.target.value))} className={selCls} style={selSt}>
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_code}</option>
                  ))}
                </select>
              </div>
              {submitted === null ? (
                <SkeletonRows />
              ) : submitted.length === 0 ? (
                <NoActualData message="No progress, midterm or terminal reports submitted yet." />
              ) : shownSubmitted.length === 0 ? (
                <div className="text-center py-12 rounded-2xl" style={{ background: "#f8fafc" }}>
                  <p className="text-sm" style={{ color: "#94a3b8" }}>No reports match the current filters.</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                  <div className="divide-y" style={{ borderColor: "#f1f5f9" }}>
                    {shownSubmitted.map((s) => {
                      const km = KIND_META[s.kind];
                      return (
                        <div key={s.key} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="text-2xl">{km.icon}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: km.color }}>{km.label}</p>
                                  {s.certified !== null && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={s.certified ? { background: "#d1fae5", color: "#059669" } : { background: "#fef3c7", color: "#d97706" }}>
                                      {s.certified ? "Certified" : "Awaiting certification"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-bold mt-0.5" style={{ color: "#0d2a5e" }}>
                                  {projectCode(s.project)} · {s.label}
                                </p>
                                <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
                                  Submitted by {nameOf(s.submittedBy)} on {s.submittedAt.slice(0, 10)}
                                </p>
                                {s.narrative && <p className="text-xs mt-1 line-clamp-2 max-w-3xl" style={{ color: "#64748b" }}>{s.narrative}</p>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {s.document !== null && (
                                <button onClick={() => openDocument(s.document!)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#f0f4f8", color: "#475569" }}>
                                  View Document
                                </button>
                              )}
                              {s.kind !== "monthly" && (
                                <button
                                  onClick={() => {
                                    const def = REPORT_DEFINITIONS.find((d) => d.id === (s.kind === "midterm" ? "appendix_e" : "appendix_f"));
                                    if (def) setGen({ def, initial: { project: String(s.project) } });
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                                  style={{ background: "#fee2e2", color: "#dc2626" }}
                                >
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                  Export {s.kind === "midterm" ? "Appendix E" : "Appendix F"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "scheduled" && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: "#64748b" }}>Recurring report generation and distribution to offices.</p>
              <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
                <table className="w-full text-xs">
                  <TableHead cols={["Report", "Frequency", "Format", "Scope", "Recipients", "Last Run", "Next Run", "Status"]} />
                  <tbody>
                    {SCHEDULED_REPORTS.map((s) => (
                      <tr key={s.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: "#0d2a5e" }}>{s.reportName}</td>
                        <td className="px-4 py-3" style={{ color: "#334155" }}>{s.frequency}</td>
                        <td className="px-4 py-3">
                          <span className="px-1.5 py-0.5 rounded font-semibold" style={s.format === "PDF" ? { background: FORMAT_META.pdf.bg, color: FORMAT_META.pdf.color } : { background: FORMAT_META.xlsx.bg, color: FORMAT_META.xlsx.color }}>{s.format}</span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "#64748b" }}>{s.scope}</td>
                        <td className="px-4 py-3" style={{ color: "#64748b" }}>{s.recipients}</td>
                        <td className="px-4 py-3 font-mono" style={{ color: "#94a3b8" }}>{s.lastRun ?? "—"}</td>
                        <td className="px-4 py-3 font-mono" style={{ color: "#334155" }}>{s.nextRun}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full font-semibold" style={s.active ? { background: "#d1fae5", color: "#059669" } : { background: "#f1f5f9", color: "#64748b" }}>{s.active ? "Active" : "Paused"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {gen && (
        <GenerateReportModal
          def={gen.def}
          initial={gen.initial}
          projects={projects}
          onGenerated={() => {
            if (gen.def.source === "server") setLogsKey((k) => k + 1);
          }}
          onClose={() => setGen(null)}
        />
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Reports & Data Export">
        <ReportsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
