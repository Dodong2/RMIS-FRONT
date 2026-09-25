import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "../../lib/authApi";
import { exportXlsx } from "../../lib/exportFiles";
import { notify } from "../../lib/notify";
import type { AdminUser, AuditLog } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { SkeletonRows } from "../../components/common/proto";

const METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

const MODULE_BY_SEGMENT: Record<string, string> = {
  admin: "Admin",
  roles: "Admin",
  auth: "Auth",
  programs: "Projects",
  projects: "Projects",
  studies: "Projects",
  milestones: "Projects",
  personnel: "Personnel",
  budget: "Budget",
  "budget-sync": "Budget",
  financial: "Finance",
  compliance: "Compliance",
  documents: "Documents",
  outputs: "Outputs",
  monitoring: "Monitoring",
  dashboard: "Analytics",
  forecasting: "Forecasting",
  "decision-support": "DSS",
  risk: "Risk",
  reports: "Reports",
};

const MODULE_COLORS: Record<string, string> = {
  Admin: "#7c3aed",
  Auth: "#7c3aed",
  Projects: "#0d2a5e",
  Personnel: "#1a56a0",
  Budget: "#059669",
  Finance: "#059669",
  Compliance: "#d97706",
  Documents: "#0369a1",
  Outputs: "#0891b2",
  Monitoring: "#0891b2",
  Analytics: "#0d2a5e",
  Forecasting: "#059669",
  DSS: "#0d2a5e",
  Risk: "#dc2626",
  Reports: "#0891b2",
};

const ACTION_BY_SUFFIX: Record<string, string> = {
  certify: "Certified",
  finalize: "Finalized",
  decide: "Decided",
  review: "Reviewed",
  verify: "Verified",
  archive: "Archived",
  trigger: "Triggered",
  "account-status": "Status Changed",
  "assign-role": "Role Assigned",
  "update-role": "Role Changed",
  scope: "Scope Changed",
  comparisons: "Submitted",
  decisions: "Decided",
  login: "Logged In",
  logout: "Logged Out",
};

const ACTION_BY_METHOD: Record<string, string> = { POST: "Created", PUT: "Updated", PATCH: "Updated", DELETE: "Deleted" };

const ACTION_COLORS: Record<string, string> = {
  Created: "#0d2a5e",
  Updated: "#d97706",
  Deleted: "#dc2626",
  Certified: "#059669",
  Finalized: "#059669",
  Decided: "#059669",
  Reviewed: "#7c3aed",
  Verified: "#7c3aed",
  Archived: "#64748b",
  Triggered: "#0891b2",
  Submitted: "#0891b2",
  "Status Changed": "#dc2626",
  "Role Assigned": "#0369a1",
  "Role Changed": "#0369a1",
  "Scope Changed": "#0369a1",
  "Logged In": "#64748b",
  "Logged Out": "#64748b",
};

function describe(log: AuditLog) {
  const parts = log.path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const module = MODULE_BY_SEGMENT[parts[0]] ?? "System";
  const last = parts[parts.length - 1];
  const action = (last && ACTION_BY_SUFFIX[last]) || ACTION_BY_METHOD[log.method] || log.method;
  return { module, action };
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actor, setActor] = useState("");
  const [method, setMethod] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const fetchLogs = useCallback(
    (nextActor: string, nextMethod: string) =>
      authApi
        .getAuditLogs({ actor: nextActor ? Number(nextActor) : undefined, method: nextMethod || undefined })
        .then(setLogs)
        .catch(() => notify.error("Could not load the audit log. Check your connection and refresh."))
        .finally(() => setIsLoading(false)),
    [],
  );

  useEffect(() => {
    authApi
      .getUsers()
      .then(setUsers)
      .catch(() => notify.error("Could not load the user list for the actor filter."));
    fetchLogs("", "");
  }, [fetchLogs]);

  const applyFilters = (nextActor: string, nextMethod: string) => {
    setIsLoading(true);
    fetchLogs(nextActor, nextMethod);
  };

  const described = useMemo(() => logs.map((l) => ({ log: l, ...describe(l) })), [logs]);
  const modules = useMemo(() => [...new Set(described.map((d) => d.module))].sort(), [described]);
  const visible = moduleFilter === "all" ? described : described.filter((d) => d.module === moduleFilter);

  const todayKey = new Date().toDateString();
  const today = logs.filter((l) => new Date(l.created_at).toDateString() === todayKey);
  const kpis = [
    { label: "Total Events Today", val: today.length },
    { label: "Active Users Today", val: new Set(today.map((l) => l.actor).filter((a) => a !== null)).size },
    { label: "Failed Requests", val: logs.filter((l) => l.status_code >= 400).length },
    { label: "Events Loaded", val: logs.length },
  ];

  const handleExport = () => {
    if (visible.length === 0) {
      notify.error("Nothing to export with the current filters.");
      return;
    }
    const actorEmail = users.find((u) => String(u.id) === actor)?.email;
    exportXlsx({
      title: "Audit Logs",
      scope: [actorEmail, method, moduleFilter !== "all" ? moduleFilter : ""].filter(Boolean).join(" ") || "All",
      sections: [
        {
          heading: "Activity Log",
          head: ["Timestamp", "Actor", "Action", "Module", "Method", "Endpoint", "Status", "IP"],
          body: visible.map(({ log, action, module }) => [fmtStamp(log.created_at), log.actor_email ?? "—", action, module, log.method, log.path, log.status_code, log.ip_address ?? "—"]),
        },
      ],
    });
  };

  const selCls = "px-3 py-2 rounded-xl text-xs font-semibold border outline-none";
  const selSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm" style={{ color: "#64748b" }}>
          Every authenticated create, update, and delete call to the RMIS API · Accessible to: System Admin
        </p>
        <div className="flex gap-2">
          <button onClick={() => applyFilters(actor, method)} disabled={isLoading} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: "white", border: "1px solid #e2e8f0", color: "#475569" }}>
            {isLoading ? "Loading…" : "Refresh"}
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: "white", border: "1px solid #e2e8f0", color: "#475569" }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export Logs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.label === "Failed Requests" && s.val > 0 ? "#dc2626" : "#0d2a5e" }}>{isLoading ? "—" : s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={actor}
          onChange={(e) => {
            setActor(e.target.value);
            applyFilters(e.target.value, method);
          }}
          className={selCls}
          style={selSt}
          aria-label="Actor"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.email}</option>
          ))}
        </select>
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            applyFilters(actor, e.target.value);
          }}
          className={selCls}
          style={selSt}
          aria-label="Method"
        >
          <option value="">All methods</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={selCls} style={selSt} aria-label="Module">
          <option value="all">All modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>Activity Log</p>
          <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>{visible.length} entries · newest first · local time</p>
        </div>
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "#94a3b8" }}>No matching audit log entries.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#f1f5f9" }}>
            {visible.map(({ log, action, module }) => {
              const ac = ACTION_COLORS[action] ?? "#64748b";
              const mc = MODULE_COLORS[module] ?? "#64748b";
              const failed = log.status_code >= 400;
              return (
                <div key={log.id} className="px-5 py-3 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                  <div className="font-mono text-xs mt-0.5 shrink-0" style={{ color: "#94a3b8", width: "150px" }}>{fmtStamp(log.created_at)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs" style={{ color: "#0d2a5e" }}>{log.actor_email ?? "Deleted user"}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: ac + "20", color: ac }}>{action}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: mc + "15", color: mc }}>{module}</span>
                      {failed && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#fee2e2", color: "#991b1b" }}>Failed</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 font-mono break-all" style={{ color: "#475569" }}>
                      {log.method} {log.path} → {log.status_code}
                    </p>
                  </div>
                  <div className="shrink-0 font-mono text-xs" style={{ color: "#cbd5e1" }}>{log.ip_address ?? "—"}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Audit Logs">
        <AuditLogsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
