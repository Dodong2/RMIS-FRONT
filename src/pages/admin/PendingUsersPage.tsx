import { useEffect, useState } from "react";
import { authApi } from "../../lib/authApi";
import type { PendingUser, Role } from "../../types/auth";

export default function PendingUsersPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");

  const load = async () => {
    const [pending, roleList] = await Promise.all([authApi.getPendingUsers(), authApi.getRoles()]);
    setPendingUsers(pending);
    setRoles(roleList);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAssign = async (userId: number) => {
    const roleId = selectedRoles[userId];
    if (!roleId) return;
    await authApi.assignRole(userId, Number(roleId));
    setMessage("Role assigned and confirmation email sent.");
    load();
  };

  return (
    <div>
      <h1>Pending Registrations</h1>
      {message && <p>{message}</p>}
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Method</th>
            <th>Requested Role</th>
            <th>Assign Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pendingUsers.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.registration_method}</td>
              <td>{u.requested_role?.name ?? "None"}</td>
              <td>
                <select
                  value={selectedRoles[u.id] ?? ""}
                  onChange={(e) => setSelectedRoles({ ...selectedRoles, [u.id]: e.target.value })}
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <button onClick={() => handleAssign(u.id)}>Assign & Confirm</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}