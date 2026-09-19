import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import GoogleChooseRolePage from "./pages/GoogleChooseRolePage";
import RegistrationPendingPage from "./pages/RegistrationPendingPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import PendingUsersPage from "./pages/admin/PendingUsersPage";
import UsersListPage from "./pages/admin/UsersListPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleGate } from "./components/RoleGate";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/choose-role" element={<GoogleChooseRolePage />} />
      <Route path="/registration-pending" element={<RegistrationPendingPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route
        path="/admin/pending-users"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin"]}>
              <PendingUsersPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin"]}>
              <UsersListPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}