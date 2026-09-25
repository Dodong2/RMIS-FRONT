import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../lib/authApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import type { PendingUser, Role } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { Pill, SkeletonRows, TableHead } from "../../components/common/proto";
import { NoActualData } from "../../components/common/NoActualData";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

function PendingUsersContent() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(
    () =>
      Promise.all([authApi.getPendingUsers(), authApi.getRoles()])
        .then(([pending, roleList]) => {
          setPendingUsers(pending);
          setRoles(roleList);
          setSelectedRoles(Object.fromEntries(pending.filter((p) => p.requested_role).map((p) => [p.id, String(p.requested_role!.id)])));
        })
        .catch(() => notify.error("Pending registrations could not be loaded. Check your connection and refresh."))
        .finally(() => setIsLoading(false)),
    [],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const load = () => {
    setIsLoading(true);
    fetchAll();
  };

  const handleAssign = async (u: PendingUser) => {
    const roleId = selectedRoles[u.id];
    if (!roleId) {
      notify.error("Choose a role for that account before assigning it.");
      return;
    }
    setAssigningId(u.id);
    try {
      await authApi.assignRole(u.id, Number(roleId));
      notify.success(`Role assigned. A confirmation email was sent to ${u.email}.`);
      setPendingUsers((prev) => prev.filter((p) => p.id !== u.id));
    } catch (err) {
      notify.error(errorMessage(err, `The role could not be assigned to ${u.email}. Try again in a moment.`));
    } finally {
      setAssigningId(null);
    }
  };

  const googleCount = pendingUsers.filter((u) => u.registration_method === "google").length;
  const withRequest = pendingUsers.filter((u) => u.requested_role).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Awaiting Role", val: pendingUsers.length, color: "#f59e0b" },
          { label: "Requested a Role", val: withRequest, color: "#0891b2" },
          { label: "Signed Up via Google", val: googleCount, color: "#0d2a5e" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{isLoading ? "—" : s.val}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "#f1f5f9", background: "#f8fafc" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>Pending Registrations — UAM-01/04</p>
            <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>Assigning a role opens the account. The person is emailed once you do.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={isLoading} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: "#f1f5f9", color: "#64748b" }}>
              {isLoading ? "Loading…" : "Refresh"}
            </button>
            <Link to="/admin/users" className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
              All Accounts →
            </Link>
          </div>
        </div>
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : pendingUsers.length === 0 ? (
          <div className="p-4">
            <NoActualData message="Nothing waiting." hint="Every registration has been reviewed. New requests show up here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHead cols={["Account", "Signed Up Via", "Requested Role", "Assign Role", ""]} />
              <tbody>
                {pendingUsers.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0" style={{ background: "#f59e0b" }}>
                          {u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: "#0d2a5e" }}>{u.email}</p>
                          <p className="text-xs" style={{ color: "#94a3b8" }}>Registered {fmtDate(u.date_joined)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Pill bg={u.registration_method === "google" ? "#e0f2fe" : "#f1f5f9"} color={u.registration_method === "google" ? "#0369a1" : "#475569"}>
                        {u.registration_method === "google" ? "Google" : "Email"}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: u.requested_role ? "#334155" : "#94a3b8" }}>{u.requested_role?.name ?? "None"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={selectedRoles[u.id] ?? ""}
                        onChange={(e) => setSelectedRoles((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        disabled={assigningId !== null}
                        aria-label={`Role for ${u.email}`}
                        className="w-full px-3 py-2 rounded-xl text-xs border outline-none disabled:opacity-60"
                        style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155", minWidth: "200px" }}
                      >
                        <option value="">Select role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleAssign(u)} disabled={assigningId !== null || !selectedRoles[u.id]} className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: "#059669" }}>
                        {assigningId === u.id ? "Assigning…" : "Assign & Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PendingUsersPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Pending Registrations">
        <PendingUsersContent />
      </AppShell>
    </ProtectedRoute>
  );
}
