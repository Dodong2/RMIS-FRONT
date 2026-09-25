import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../lib/authApi";
import { researchApi } from "../../lib/researchApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { protoRoleStyle } from "../../lib/protoRole";
import { BTN_GHOST_STYLE, INPUT_CLS, INPUT_STYLE } from "../../lib/protoStyles";
import type { AccountStatus, AdminUser, AuditLog, PermissionMatrix, Role } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../context/AuthContext";
import { AppShell } from "../../components/layout/AppShell";
import { Field, Pill, ProtoModal, SkeletonRows, TableHead } from "../../components/common/proto";
import { NoActualData } from "../../components/common/NoActualData";
import { TEMPORARY_REPLACEMENTS } from "../../mocks/users";

type Tab = "accounts" | "profiles" | "assignments" | "permissions" | "audit";
type StatusAction = "suspend" | "reactivate" | "deactivate";

const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: "Active", bg: "#d1fae5", text: "#166534", dot: "#22c55e" },
  suspended: { label: "Suspended", bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  deactivated: { label: "Deactivated", bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
};

const METHOD_META: Record<string, { bg: string; text: string }> = {
  POST: { bg: "#d1fae5", text: "#166534" },
  PUT: { bg: "#e0f2fe", text: "#0369a1" },
  PATCH: { bg: "#fef3c7", text: "#92400e" },
  DELETE: { bg: "#fee2e2", text: "#991b1b" },
};

const RESPONSIBILITY_LABELS: Record<string, [string, string]> = {
  programs: ["program", "programs"],
  projects: ["project", "projects"],
  studies: ["study", "studies"],
  assignments: ["project assignment", "project assignments"],
};

const initials = (email: string) => email.slice(0, 2).toUpperCase();
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function StatusDot({ status }: { status: AccountStatus }) {
  const s = ACCOUNT_STATUS_META[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
      <span className="text-xs font-bold" style={{ color: s.text }}>{s.label}</span>
    </div>
  );
}

function RolePill({ role }: { role: Role | null }) {
  if (!role) return <Pill>No role</Pill>;
  const st = protoRoleStyle(role);
  return <Pill bg={st.bg} color={st.color}>{role.name}</Pill>;
}

function ScopePill({ user }: { user: AdminUser }) {
  const { campus, college } = user.scope ?? {};
  if (!campus && !college) return <Pill bg="#e0eaf7" color="#0d2a5e">All Campuses</Pill>;
  return <Pill bg="#e0f2fe" color="#0369a1">{[college, campus].filter(Boolean).join(" · ")}</Pill>;
}

function Avatar({ user, size = "w-8 h-8 text-xs" }: { user: AdminUser; size?: string }) {
  return (
    <div className={`${size} rounded-xl flex items-center justify-center text-white font-black shrink-0`} style={{ background: protoRoleStyle(user.role).color }}>
      {initials(user.email)}
    </div>
  );
}

function statusActionsFor(status: AccountStatus): StatusAction[] {
  if (status === "active") return ["suspend", "deactivate"];
  if (status === "suspended") return ["reactivate", "deactivate"];
  return [];
}

const ACTION_META: Record<StatusAction, { label: string; bg: string; color: string }> = {
  suspend: { label: "Suspend", bg: "#fef3c7", color: "#92400e" },
  reactivate: { label: "Reactivate", bg: "#d1fae5", color: "#166534" },
  deactivate: { label: "Deactivate", bg: "#fee2e2", color: "#dc2626" },
};

function PermissionModal({ role, matrix, onClose }: { role: Role; matrix: PermissionMatrix | null; onClose: () => void }) {
  const st = protoRoleStyle(role);
  const modules = matrix ? [...new Set(matrix.permissions.map((p) => p.module))] : [];
  const granted = matrix ? matrix.permissions.filter((p) => p.roles.includes(role.code)).length : 0;
  return (
    <ProtoModal title="Role Permissions — UAM-05" subtitle={`${role.name} · ${granted} of ${matrix?.permissions.length ?? 0} permissions`} onClose={onClose} width="max-w-lg">
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: st.bg }}>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: st.color }} />
        <p className="text-sm font-bold" style={{ color: st.color }}>{role.name}</p>
        <span className="ml-auto text-xs font-mono" style={{ color: st.color }}>{role.code}</span>
      </div>
      {!matrix ? (
        <p className="text-sm" style={{ color: "#94a3b8" }}>The permission matrix could not be loaded.</p>
      ) : (
        modules.map((mod) => (
          <div key={mod}>
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#94a3b8" }}>{mod.replace(/_/g, " ")}</p>
            <div className="space-y-1">
              {matrix.permissions
                .filter((p) => p.module === mod)
                .map((p) => {
                  const has = p.roles.includes(role.code);
                  return (
                    <div key={p.code} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg" style={{ background: has ? "#f0fdf4" : "#f8fafc" }}>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: has ? "#059669" : "#e2e8f0" }}>
                        {has ? (
                          <svg width="9" height="9" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" /></svg>
                        ) : (
                          <svg width="9" height="9" fill="none" stroke="#94a3b8" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18" strokeLinecap="round" /></svg>
                        )}
                      </div>
                      <span className="text-xs flex-1" style={{ color: has ? "#166534" : "#94a3b8" }}>{p.name}</span>
                      <span className="text-xs font-mono" style={{ color: has ? "#86efac" : "#cbd5e1" }}>{p.code}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))
      )}
    </ProtoModal>
  );
}

function ScopeModal({ user, campuses, onSaved, onClose }: { user: AdminUser; campuses: string[]; onSaved: (u: AdminUser) => void; onClose: () => void }) {
  const [campus, setCampus] = useState(user.scope?.campus ?? "");
  const [college, setCollege] = useState(user.scope?.college ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await authApi.updateUserScope(user.id, { campus: campus.trim(), college: college.trim() });
      onSaved({ ...user, scope: res.scope });
      notify.success("Scope updated.");
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the scope."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Campus / College Scope — UAM-03"
      subtitle={user.email}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {isSaving ? "Saving…" : "Save Scope"}
          </button>
        </>
      }
    >
      <p className="text-xs font-bold px-3 py-2 rounded-lg" style={{ background: "#f0f9ff", color: "#0369a1" }}>
        Leave a field blank to clear it. A blank campus means university-wide access. Campus limits what campus-scoped roles see; college is stored but not enforced yet.
      </p>
      <Field label="Campus">
        <input list="scope-campuses" value={campus} onChange={(e) => setCampus(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} placeholder="e.g. Santa Cruz" />
        <datalist id="scope-campuses">
          {campuses.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="College">
        <input value={college} onChange={(e) => setCollege(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} placeholder="e.g. CCS" />
      </Field>
    </ProtoModal>
  );
}

function ConfirmDeactivateModal({ user, isWorking, onConfirm, onClose }: { user: AdminUser; isWorking: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <ProtoModal
      title="Deactivate Account — UAM-06"
      subtitle={user.email}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={onConfirm} disabled={isWorking} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#dc2626" }}>
            {isWorking ? "Deactivating…" : "Deactivate Permanently"}
          </button>
        </>
      }
    >
      <div className="p-3 rounded-xl text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
        Deactivation is permanent and can't be reversed. Use Suspend for a temporary hold.
      </div>
      <p className="text-xs" style={{ color: "#64748b" }}>
        If this user still leads an active program, project, or study, or has an open project assignment, the system will refuse until those are handed over through a personnel change.
      </p>
    </ProtoModal>
  );
}

function UserDetailModal({
  user,
  isWorking,
  onAction,
  onScope,
  onPerms,
  onClose,
}: {
  user: AdminUser;
  isWorking: boolean;
  onAction: (a: StatusAction) => void;
  onScope: () => void;
  onPerms: () => void;
  onClose: () => void;
}) {
  const replacement = user.account_status === "suspended" ? TEMPORARY_REPLACEMENTS[user.id % TEMPORARY_REPLACEMENTS.length] : null;
  return (
    <ProtoModal
      title={
        <div className="flex items-center gap-3">
          <Avatar user={user} size="w-10 h-10 text-sm" />
          <div className="min-w-0">
            <p className="text-white font-bold truncate">{user.email}</p>
            <p className="text-white/50 text-xs">{user.role?.name ?? "No role"}</p>
          </div>
        </div>
      }
      onClose={onClose}
      width="max-w-lg"
    >
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Email", val: user.email },
          { label: "Role", val: user.role?.name ?? "—" },
          { label: "Office", val: user.office || "—" },
          { label: "Position", val: user.position || "—" },
          { label: "Account Status", val: ACCOUNT_STATUS_META[user.account_status].label },
          { label: "Joined", val: fmtDate(user.date_joined) },
        ].map((item) => (
          <div key={item.label} className="p-3 rounded-xl" style={{ background: "#f8fafc" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{item.label}</p>
            <p className="text-sm font-semibold mt-0.5 break-all" style={{ color: "#1e293b" }}>{item.val}</p>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-xl" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0891b2" }}>Access Scope — UAM-03/05</p>
          <button onClick={onScope} className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: "white", color: "#0369a1" }}>Edit Scope</button>
        </div>
        <ScopePill user={user} />
        <p className="text-xs mt-2" style={{ color: "#475569" }}>College is stored but not enforced yet.</p>
      </div>
      {replacement && (
        <div className="p-3 rounded-xl" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#92400e" }}>Temporary Replacement While Suspended</p>
          <p className="text-sm font-bold" style={{ color: "#78350f" }}>{replacement.replacementName}</p>
          <p className="text-xs" style={{ color: "#92400e" }}>{replacement.designation}</p>
          <p className="text-xs mt-1" style={{ color: "#78350f" }}>Covers: {replacement.coverage}</p>
          <p className="text-xs mt-1" style={{ color: "#92400e" }}>
            {replacement.from} → {replacement.until} · {replacement.basis}
          </p>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {statusActionsFor(user.account_status).map((a) => (
          <button key={a} onClick={() => onAction(a)} disabled={isWorking} className="px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: ACTION_META[a].bg, color: ACTION_META[a].color }}>
            {ACTION_META[a].label}
          </button>
        ))}
        {user.role && (
          <button onClick={onPerms} className="px-3 py-2 rounded-xl text-sm font-bold" style={{ background: "#f5f3ff", color: "#7c3aed" }}>View Permissions</button>
        )}
      </div>
    </ProtoModal>
  );
}

function AssignmentRows({
  list,
  onOpen,
  onScope,
  onPerms,
}: {
  list: AdminUser[];
  onOpen: (u: AdminUser) => void;
  onScope: (u: AdminUser) => void;
  onPerms: (r: Role) => void;
}) {
  return (
    <table className="w-full text-sm" style={{ background: "white" }}>
      <tbody>
        {list.map((u) => (
          <tr key={u.id} className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={() => onOpen(u)}>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Avatar user={u} size="w-7 h-7 text-xs" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#0d2a5e" }}>{u.email}</p>
                  <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{[u.position, u.office].filter(Boolean).join(" · ") || "—"}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-2.5"><RolePill role={u.role} /></td>
            <td className="px-4 py-2.5"><StatusDot status={u.account_status} /></td>
            <td className="px-4 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onScope(u)} className="text-xs font-bold px-2 py-1 rounded-lg mr-1" style={{ background: "#e0f2fe", color: "#0369a1" }}>Scope</button>
              {u.role && (
                <button onClick={() => u.role && onPerms(u.role)} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#f5f3ff", color: "#7c3aed" }}>Perms</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UsersListContent() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [campusOptions, setCampusOptions] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("accounts");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [campusFilter, setCampusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");

  const [pendingRole, setPendingRole] = useState<Record<number, string>>({});
  const [savingRole, setSavingRole] = useState<number | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scopeUser, setScopeUser] = useState<AdminUser | null>(null);
  const [permRole, setPermRole] = useState<Role | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminUser | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([authApi.getUsers(), authApi.getRoles()])
      .then(([u, r]) => {
        if (!alive) return;
        setUsers(u);
        setRoles(r);
      })
      .catch(() => alive && notify.error("The user list could not be loaded. Check your connection and refresh."))
      .finally(() => alive && setIsLoading(false));
    authApi.getPendingUsers().then((p) => alive && setPendingCount(p.length)).catch(() => undefined);
    authApi.getPermissionMatrix().then((m) => alive && setMatrix(m)).catch(() => undefined);
    authApi.getAuditLogs().then((l) => alive && setAuditLogs(l.filter((x) => x.path.startsWith("/api/admin/")))).catch(() => alive && setAuditLogs([]));
    researchApi
      .getProjects()
      .then((p) => alive && setCampusOptions([...new Set(p.map((x) => x.campus).filter(Boolean))].sort()))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const patchUser = (next: AdminUser) => setUsers((prev) => prev.map((u) => (u.id === next.id ? next : u)));

  const scopeCampuses = useMemo(() => [...new Set(users.map((u) => u.scope?.campus).filter((c): c is string => !!c))].sort(), [users]);
  const allCampuses = useMemo(() => [...new Set([...campusOptions, ...scopeCampuses])].sort(), [campusOptions, scopeCampuses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchSearch = !q || [u.email, u.office, u.position, u.role?.name ?? ""].some((v) => v.toLowerCase().includes(q));
      const matchRole = roleFilter === "all" || String(u.role?.id ?? "") === roleFilter;
      const matchCampus = campusFilter === "all" || (campusFilter === "" ? !u.scope?.campus : u.scope?.campus === campusFilter);
      const matchStatus = statusFilter === "all" || u.account_status === statusFilter;
      return matchSearch && matchRole && matchCampus && matchStatus;
    });
  }, [users, search, roleFilter, campusFilter, statusFilter]);

  const kpis = {
    total: users.length,
    active: users.filter((u) => u.account_status === "active").length,
    suspended: users.filter((u) => u.account_status === "suspended").length,
    deactivated: users.filter((u) => u.account_status === "deactivated").length,
  };

  const handleSaveRole = async (u: AdminUser) => {
    const roleId = pendingRole[u.id];
    if (!roleId) return;
    setSavingRole(u.id);
    try {
      await authApi.updateUserRole(u.id, Number(roleId));
      patchUser({ ...u, role: roles.find((r) => String(r.id) === roleId) ?? u.role });
      setPendingRole((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      notify.success("Role updated.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the role. Try again."));
    } finally {
      setSavingRole(null);
    }
  };

  const runAction = async (u: AdminUser, action: StatusAction) => {
    setWorkingId(u.id);
    try {
      const res = await authApi.setAccountStatus(u.id, action);
      patchUser({ ...u, account_status: res.account_status, is_active: res.is_active });
      notify.success(`${u.email} is now ${ACCOUNT_STATUS_META[res.account_status].label.toLowerCase()}.`);
      setConfirmDeactivate(null);
    } catch (err) {
      const data = (err as { response?: { data?: { detail?: string; active?: Record<string, number> } } })?.response?.data;
      if (data?.active) {
        const parts = Object.entries(data.active).map(([k, n]) => `${n} ${RESPONSIBILITY_LABELS[k]?.[n === 1 ? 0 : 1] ?? k}`);
        notify.error(`${data.detail ?? "Hand over this user's responsibilities first."} Still active: ${parts.join(", ")}.`);
      } else {
        notify.error(errorMessage(err, "Could not update the account status. Try again."));
      }
      setConfirmDeactivate(null);
    } finally {
      setWorkingId(null);
    }
  };

  const requestAction = (u: AdminUser, action: StatusAction) => {
    if (action === "deactivate") setConfirmDeactivate(u);
    else runAction(u, action);
  };

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  const assignmentGroups = useMemo(() => {
    const groups = new Map<string, Map<string, AdminUser[]>>();
    for (const u of filtered) {
      const campus = u.scope?.campus ?? "";
      const college = u.scope?.college ?? "";
      if (!groups.has(campus)) groups.set(campus, new Map());
      const byCollege = groups.get(campus)!;
      byCollege.set(college, [...(byCollege.get(college) ?? []), u]);
    }
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  }, [filtered]);

  const selCls = "px-3 py-2 rounded-xl text-xs font-semibold border outline-none";
  const selSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

  if (isLoading) {
    return (
      <div className="rounded-2xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <SkeletonRows rows={6} />
      </div>
    );
  }

  const showFilters = tab === "accounts" || tab === "profiles" || tab === "assignments";

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Accounts", val: kpis.total, color: "#0d2a5e" },
          { label: "Active", val: kpis.active, color: "#059669" },
          { label: "Suspended", val: kpis.suspended, color: "#dc2626" },
          { label: "Deactivated", val: kpis.deactivated, color: "#64748b" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl p-1 w-fit flex-wrap" style={{ background: "#f0f4f8" }}>
        {(
          [
            ["accounts", "User Accounts", "UAM-01/06"],
            ["profiles", "Personnel Profiles", "UAM-02"],
            ["assignments", "Org. Assignments", "UAM-03/04"],
            ["permissions", "Roles & Permissions", "UAM-05"],
            ["audit", "Access Audit", "UAM-08"],
          ] as [Tab, string, string][]
        ).map(([key, label, req]) => (
          <button key={key} onClick={() => setTab(key)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5" style={{ background: tab === key ? "#0d2a5e" : "transparent", color: tab === key ? "white" : "#64748b" }}>
            {label}
            <span className="font-mono opacity-60" style={{ fontSize: "10px" }}>{req}</span>
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input type="text" placeholder="Search email, office, position…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-4 py-2 rounded-xl text-xs border outline-none" style={{ background: "white", borderColor: "#e2e8f0", color: "#334155", width: "220px" }} />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selCls} style={selSt}>
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} className={selCls} style={selSt}>
              <option value="all">All Scopes</option>
              <option value="">University-wide</option>
              {scopeCampuses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "all")} className={selCls} style={selSt}>
              <option value="all">All Statuses</option>
              {(Object.keys(ACCOUNT_STATUS_META) as AccountStatus[]).map((s) => (
                <option key={s} value={s}>{ACCOUNT_STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
          <Link to="/admin/pending-users" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Pending Registrations{pendingCount ? ` (${pendingCount})` : ""} — UAM-01
          </Link>
        </div>
      )}

      {tab === "accounts" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHead cols={["User", "Role", "Office / Position", "Scope", "Joined", "Status", "Actions"]} />
              <tbody>
                {filtered.map((u) => {
                  const draftRoleId = pendingRole[u.id] ?? (u.role ? String(u.role.id) : "");
                  const hasChange = draftRoleId !== "" && draftRoleId !== String(u.role?.id ?? "");
                  const isMe = u.id === me?.pk;
                  return (
                    <tr key={u.id} className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={() => setSelectedId(u.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar user={u} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate" style={{ color: "#0d2a5e" }}>{u.email}{isMe ? " (you)" : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <select value={draftRoleId} onChange={(e) => setPendingRole((prev) => ({ ...prev, [u.id]: e.target.value }))} disabled={isMe} className="px-2 py-1.5 rounded-lg text-xs border outline-none disabled:opacity-60" style={{ borderColor: "#e2e8f0", background: protoRoleStyle(u.role).bg, color: protoRoleStyle(u.role).color, fontWeight: 700, maxWidth: "160px" }}>
                            {!u.role && <option value="">Select role</option>}
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          {hasChange && (
                            <button onClick={() => handleSaveRole(u)} disabled={savingRole === u.id} className="px-2 py-1 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: "#0d2a5e" }}>
                              {savingRole === u.id ? "…" : "Save"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#475569" }}>
                        <p className="font-semibold">{u.position || "—"}</p>
                        <p style={{ color: "#94a3b8" }}>{u.office || "—"}</p>
                      </td>
                      <td className="px-4 py-3"><ScopePill user={u} /></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#64748b" }}>{fmtDate(u.date_joined)}</td>
                      <td className="px-4 py-3"><StatusDot status={u.account_status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {!isMe &&
                            statusActionsFor(u.account_status).map((a) => (
                              <button key={a} onClick={() => requestAction(u, a)} disabled={workingId === u.id} className="px-2 py-1 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: ACTION_META[a].bg, color: ACTION_META[a].color }}>
                                {ACTION_META[a].label}
                              </button>
                            ))}
                          {isMe && u.role && (
                            <button onClick={() => setPermRole(u.role)} className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: "#f5f3ff", color: "#7c3aed" }}>Perms</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "#94a3b8" }}>{users.length ? "No accounts match your filters." : "No confirmed accounts yet."}</div>}
          {filtered.length > 0 && (
            <p className="px-4 py-2 text-xs border-t" style={{ color: "#94a3b8", borderColor: "#f1f5f9" }}>{filtered.length} of {users.length} accounts</p>
          )}
        </div>
      )}

      {tab === "profiles" &&
        (filtered.length === 0 ? (
          <NoActualData message="No accounts match your filters." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((u) => {
              const st = protoRoleStyle(u.role);
              return (
                <div key={u.id} className="rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer" style={{ background: "white", border: "1px solid #e2e8f0" }} onClick={() => setSelectedId(u.id)}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0" style={{ background: `linear-gradient(135deg, ${st.color}, ${st.color}cc)` }}>{initials(u.email)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-sm leading-tight truncate" style={{ color: "#0d2a5e" }}>{u.email}</p>
                      <p className="text-xs mt-0.5 font-semibold" style={{ color: st.color }}>{u.role?.name ?? "No role"}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "#94a3b8" }}>{u.position || "No position on file"}</p>
                      <div className="mt-1"><StatusDot status={u.account_status} /></div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { icon: "M3 8l9-5 9 5v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8z", val: u.email },
                      { icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", val: u.office || "No office on file" },
                      { icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z", val: [u.scope?.college, u.scope?.campus].filter(Boolean).join(" · ") || "University-wide" },
                      { icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", val: `Joined: ${fmtDate(u.date_joined)}` },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2" style={{ color: "#64748b" }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0"><path d={item.icon} strokeLinecap="round" /></svg>
                        <span className="truncate">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {tab === "assignments" && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: "#94a3b8" }}>Grouped by each account's assigned scope. Campus limits what campus-scoped roles see; college is stored but not enforced yet.</p>
          {assignmentGroups.length === 0 && <NoActualData message="No accounts match your filters." />}
          {assignmentGroups.map(([campus, byCollege]) => {
            const count = [...byCollege.values()].reduce((s, l) => s + l.length, 0);
            const color = campus ? "#0369a1" : "#0d2a5e";
            const bg = campus ? "#e0f2fe" : "#e0eaf7";
            const colleges = [...byCollege.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
            return (
              <div key={campus || "__all"} className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${color}20` }}>
                <div className="px-5 py-3 flex items-center gap-3" style={{ background: bg }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <p className="font-black text-sm" style={{ color }}>{campus || "University-wide (no campus scope)"}</p>
                  <span className="ml-auto text-xs font-bold" style={{ color }}>{count} user{count !== 1 ? "s" : ""}</span>
                </div>
                {colleges.map(([college, list]) => (
                  <div key={college || "__none"}>
                    {campus && (
                      <div className="px-4 py-1.5 flex items-center gap-2" style={{ background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                        {college ? (
                          <span className="text-xs font-black px-1.5 py-0.5 rounded" style={{ background: "#1a56a0", color: "white" }}>{college}</span>
                        ) : (
                          <span className="text-xs font-black px-1.5 py-0.5 rounded" style={{ background: "#0d2a5e", color: "white" }}>ALL</span>
                        )}
                        <span className="text-xs font-semibold" style={{ color: "#475569" }}>{college ? "College" : "Campus-wide (no college)"}</span>
                      </div>
                    )}
                    <AssignmentRows list={list} onOpen={(u) => setSelectedId(u.id)} onScope={setScopeUser} onPerms={setPermRole} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === "permissions" &&
        (!matrix ? (
          <NoActualData message="The permission matrix could not be loaded." />
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#0d2a5e" }}>Role × Permission Matrix — UAM-05</p>
              <span className="text-xs" style={{ color: "#94a3b8" }}>
                {matrix.permissions.length} permissions × {matrix.roles.length} roles · read-only, editing is a future enhancement
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "#f0f4f8" }}>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wide sticky left-0" style={{ color: "#64748b", background: "#f0f4f8", minWidth: "240px" }}>Permission</th>
                    {matrix.roles.map((code) => {
                      const role = roles.find((r) => r.code === code);
                      return (
                        <th key={code} className="px-1 py-2.5 text-center font-bold" style={{ color: protoRoleStyle(role ?? { code }).color, fontSize: "9px", minWidth: "58px" }}>
                          {role ? (
                            <button onClick={() => setPermRole(role)} className="hover:underline" title={role.name}>{role.name}</button>
                          ) : (
                            code
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(matrix.permissions.map((p) => p.module))].map((mod) => (
                    <FragmentRows key={mod} mod={mod} matrix={matrix} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {tab === "audit" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#0d2a5e" }}>Account & Access Audit Log — UAM-08</p>
            <Link to="/admin/audit" className="text-xs font-bold" style={{ color: "#0891b2" }}>Full audit log →</Link>
          </div>
          {auditLogs === null ? (
            <SkeletonRows rows={4} />
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "#94a3b8" }}>No account or access changes logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHead cols={["Date & Time", "Method", "Endpoint", "Actor", "IP", "Result"]} />
                <tbody>
                  {auditLogs.map((log) => {
                    const mm = METHOD_META[log.method] ?? METHOD_META.POST;
                    const ok = log.status_code < 400;
                    return (
                      <tr key={log.id} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                        <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#64748b" }}>{fmtDateTime(log.created_at)}</td>
                        <td className="px-4 py-2.5"><span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: mm.bg, color: mm.text }}>{log.method}</span></td>
                        <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#334155" }}>{log.path}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: "#475569" }}>{log.actor_email ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#94a3b8" }}>{log.ip_address ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: ok ? "#d1fae5" : "#fee2e2", color: ok ? "#166534" : "#991b1b" }}>{log.status_code}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          isWorking={workingId === selectedUser.id}
          onAction={(a) => (selectedUser.id === me?.pk ? notify.error("You can't change your own account status.") : requestAction(selectedUser, a))}
          onScope={() => setScopeUser(selectedUser)}
          onPerms={() => selectedUser.role && setPermRole(selectedUser.role)}
          onClose={() => setSelectedId(null)}
        />
      )}
      {scopeUser && <ScopeModal user={scopeUser} campuses={allCampuses} onSaved={patchUser} onClose={() => setScopeUser(null)} />}
      {permRole && <PermissionModal role={permRole} matrix={matrix} onClose={() => setPermRole(null)} />}
      {confirmDeactivate && (
        <ConfirmDeactivateModal user={confirmDeactivate} isWorking={workingId === confirmDeactivate.id} onConfirm={() => runAction(confirmDeactivate, "deactivate")} onClose={() => setConfirmDeactivate(null)} />
      )}
    </div>
  );
}

function FragmentRows({ mod, matrix }: { mod: string; matrix: PermissionMatrix }) {
  const perms = matrix.permissions.filter((p) => p.module === mod);
  return (
    <>
      <tr style={{ background: "#f8fafc" }}>
        <td colSpan={matrix.roles.length + 1} className="px-3 py-1.5 text-xs font-black uppercase tracking-widest sticky left-0" style={{ color: "#94a3b8", background: "#f8fafc" }}>
          {mod.replace(/_/g, " ")}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p.code} className="border-t" style={{ borderColor: "#f1f5f9" }}>
          <td className="px-3 py-1.5 sticky left-0" style={{ background: "white" }}>
            <p className="font-semibold" style={{ color: "#334155" }}>{p.name}</p>
            <p className="font-mono" style={{ color: "#94a3b8", fontSize: "10px" }}>{p.code}</p>
          </td>
          {matrix.roles.map((code) => {
            const has = p.roles.includes(code);
            return (
              <td key={code} className="px-1 py-1.5 text-center">
                {has ? (
                  <span className="inline-flex w-4 h-4 rounded-full items-center justify-center" style={{ background: "#059669" }} aria-label="granted">
                    <svg width="9" height="9" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" /></svg>
                  </span>
                ) : (
                  <span style={{ color: "#e2e8f0" }} aria-label="not granted">·</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export default function UsersListPage() {
  return (
    <ProtectedRoute>
      <AppShell title="User & Access Management">
        <UsersListContent />
      </AppShell>
    </ProtectedRoute>
  );
}
