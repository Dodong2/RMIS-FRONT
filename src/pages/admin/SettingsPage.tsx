import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../lib/authApi";
import { notify } from "../../lib/notify";
import { protoRoleStyle } from "../../lib/protoRole";
import type { AdminUser, PermissionMatrix, Role } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { SkeletonRows } from "../../components/common/proto";
import { SYSTEM_INFO } from "../../mocks/settings";

const MODULE_LABELS: Record<string, string> = {
  accounts: "User & Access",
  research_projects: "Projects",
  personnel: "Personnel & Tasks",
  budget_lib: "Budget & LIB",
  budget_sync: "Budget Sync",
  financial_monitoring: "Disbursement",
  compliance: "Compliance",
  document_management: "Documents",
  outputs: "Outputs",
  monitoring: "Monitoring",
  dashboard: "Dashboard",
  forecasting: "Forecasting",
  decision_support: "DSS",
  risk_indicators: "Risk",
  reports: "Reports",
};

const moduleLabel = (m: string) => MODULE_LABELS[m] ?? m.replace(/_/g, " ");

function SettingsContent() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [matrixFailed, setMatrixFailed] = useState(false);

  useEffect(() => {
    authApi
      .getPermissionMatrix()
      .then(setMatrix)
      .catch(() => {
        setMatrixFailed(true);
        notify.error("Could not load the permission matrix.");
      });
    authApi.getRoles().then(setRoles).catch(() => undefined);
    authApi
      .getUsers()
      .then(setUsers)
      .catch(() => {
        setUsers([]);
        notify.error("Could not load the user list.");
      });
  }, []);

  const modules = useMemo(() => (matrix ? [...new Set(matrix.permissions.map((p) => p.module))] : []), [matrix]);
  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? code;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <p className="font-bold text-sm mb-4" style={{ color: "#0d2a5e" }}>System Information</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SYSTEM_INFO.map((item) => (
            <div key={item.label} className="p-3 rounded-lg" style={{ background: "#f8fafc" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{item.label}</p>
              <p className="text-sm font-medium mt-1" style={{ color: "#1e293b" }}>{item.val}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>Role-to-Module Access Matrix</p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Permissions granted per role per module, from the seeded permission tables — enforced by Role + campus Scope + Project Assignment</p>
          </div>
          <Link to="/admin/users" className="text-xs font-bold shrink-0" style={{ color: "#0891b2" }}>Per-permission detail →</Link>
        </div>

        <div className="px-5 py-3 border-b flex flex-wrap gap-2" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
          <span className="text-xs font-bold uppercase tracking-wide self-center mr-1" style={{ color: "#94a3b8" }}>Legend:</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#ede9fe", color: "#7c3aed" }}>
            <strong>All</strong> = every permission in the module
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0891b2" }}>
            <strong>n/m</strong> = n of m permissions
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f8fafc", color: "#94a3b8" }}>
            <strong>—</strong> = read-only or no direct access
          </span>
        </div>

        {matrixFailed ? (
          <div className="text-center py-10 text-sm" style={{ color: "#94a3b8" }}>The permission matrix could not be loaded.</div>
        ) : !matrix ? (
          <SkeletonRows rows={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs" style={{ minWidth: "900px", width: "100%" }}>
              <thead>
                <tr style={{ background: "#f0f4f8" }}>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wide sticky left-0 z-10" style={{ color: "#0d2a5e", background: "#f0f4f8", minWidth: "180px" }}>Role</th>
                  {modules.map((m) => (
                    <th key={m} className="px-1 py-3 text-center font-black" style={{ color: "#0d2a5e", minWidth: "64px", fontSize: "9px", lineHeight: "1.2" }}>
                      {moduleLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.roles.map((code, i) => {
                  const bg = i % 2 === 0 ? "white" : "#fafbfc";
                  return (
                    <tr key={code} style={{ background: bg, borderTop: "1px solid #f1f5f9" }}>
                      <td className="px-4 py-3 font-bold sticky left-0 z-10" style={{ color: protoRoleStyle({ code }).color, background: bg, minWidth: "180px" }}>{roleName(code)}</td>
                      {modules.map((m) => {
                        const inModule = matrix.permissions.filter((p) => p.module === m);
                        const granted = inModule.filter((p) => p.roles.includes(code));
                        const all = granted.length === inModule.length && granted.length > 0;
                        const st = granted.length === 0 ? { bg: "#f8fafc", color: "#cbd5e1" } : all ? { bg: "#ede9fe", color: "#7c3aed" } : { bg: "#e0f2fe", color: "#0891b2" };
                        return (
                          <td key={m} className="py-3 text-center">
                            <span className="inline-block px-1.5 py-0.5 rounded font-bold" style={{ background: st.bg, color: st.color, fontSize: "10px", minWidth: "36px" }} title={granted.map((p) => p.name).join("\n") || "No write permission"}>
                              {granted.length === 0 ? "—" : all ? "All" : `${granted.length}/${inModule.length}`}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
          <p className="text-xs" style={{ color: "#64748b" }}>
            Reads are open to every signed-in role unless a page says otherwise; this matrix covers write and manage permissions. Leaders see only projects they lead, and campus-scoped roles only their assigned campus. Editing the matrix is a future enhancement.
          </p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>System User Accounts</p>
          <Link to="/admin/users" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#0891b2", color: "white" }}>
            Manage Users
          </Link>
        </div>
        {users === null ? (
          <SkeletonRows rows={3} />
        ) : users.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "#94a3b8" }}>No confirmed accounts.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((u) => {
              const st = protoRoleStyle(u.role);
              return (
                <div key={u.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: st.color }}>{u.email.slice(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#0d2a5e" }}>{u.email}</p>
                    <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{[u.position, u.office].filter(Boolean).join(" · ") || "No office on file"}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: st.bg, color: st.color }}>{u.role?.name ?? "No role"}</span>
                  {u.account_status !== "active" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold shrink-0" style={{ background: "#fee2e2", color: "#991b1b" }}>{u.account_status === "suspended" ? "Suspended" : "Deactivated"}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="System Settings">
        <SettingsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
