import { ProtectedRoute } from "../components/ProtectedRoute";
import { RoleGate } from "../components/RoleGate";
import { useAuth } from "../context/AuthContext";

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
      <p>Role: {user?.role?.name ?? "No role assigned yet"}</p>

      <RoleGate allow={["system_admin"]}>
        <div>System Admin panel goes here.</div>
      </RoleGate>

      <RoleGate allow={["program_leader", "project_leader", "study_leader"]}>
        <div>Research personnel workspace goes here.</div>
      </RoleGate>

      <button onClick={logout}>Log Out</button>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}