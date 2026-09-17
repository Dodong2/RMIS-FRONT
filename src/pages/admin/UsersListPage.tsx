import { useEffect, useState } from "react";
import { authApi } from "../../lib/authApi";
import type { User } from "../../types/auth";

export default function UsersListPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    authApi.getUsers().then(setUsers);
  }, []);

  return (
    <div>
      <h1>Users</h1>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.pk}>
              <td>{u.email}</td>
              <td>{u.role?.name}</td>
              <td>{u.is_active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}