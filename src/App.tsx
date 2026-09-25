import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import GoogleChooseRolePage from "./pages/GoogleChooseRolePage";
import RegistrationPendingPage from "./pages/RegistrationPendingPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import PendingUsersPage from "./pages/admin/PendingUsersPage";
import UsersListPage from "./pages/admin/UsersListPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import RegisterProgramPage from "./pages/RegisterProgramPage";
import RegisterProjectPage from "./pages/RegisterProjectPage";
import TasksPage from "./pages/TasksPage";
import WorkPlanPage from "./pages/WorkPlanPage";
import PersonnelChangesPage from "./pages/PersonnelChangesPage";
import StaffPage from "./pages/StaffPage";
import LeaderLoadPage from "./pages/LeaderLoadPage";
import BudgetPage from "./pages/BudgetPage";
import DisbursementsPage from "./pages/DisbursementsPage";
import CompliancePage from "./pages/CompliancePage";
import DocumentsPage from "./pages/DocumentsPage";
import OutputsPage from "./pages/OutputsPage";
import MonitoringPage from "./pages/MonitoringPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import BudgetForecastPage from "./pages/BudgetForecastPage";
import DecisionSupportPage from "./pages/DecisionSupportPage";
import RisksPage from "./pages/RisksPage";
import ReportsPage from "./pages/ReportsPage";
import ProcurementPage from "./pages/ProcurementPage";
import BudgetSyncPage from "./pages/BudgetSyncPage";
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
      <Route
        path="/projects/new"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin", "crc_chair"]}>
              <RegisterProjectPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route
        path="/programs/new"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin", "crc_chair"]}>
              <RegisterProgramPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/outputs" element={<OutputsPage />} />
      <Route path="/monitoring" element={<MonitoringPage />} />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "finance_budget",
              ]}
            >
              <AnalyticsPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/budget-sync"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin", "vprei", "university_admin", "drd", "finance_budget"]}>
              <BudgetSyncPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/budget/forecast"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin", "vprei", "university_admin", "drd", "finance_budget"]}>
              <BudgetForecastPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/decision-support"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin", "vprei", "university_admin", "drd", "finance_budget"]}>
              <DecisionSupportPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/risks"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "program_leader",
                "project_leader",
              ]}
            >
              <RisksPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "finance_budget",
              ]}
            >
              <ReportsPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/personnel-changes"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "procurement_officer_lib",
              ]}
            >
              <PersonnelChangesPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/work-plan"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "program_leader",
                "project_leader",
                "study_leader",
              ]}
            >
              <WorkPlanPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "program_leader",
                "project_leader",
                "study_leader",
              ]}
            >
              <StaffPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leader-load"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "drd",
                "crc_chair",
                "riuh",
                "program_leader",
                "project_leader",
              ]}
            >
              <LeaderLoadPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/budget"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "finance_budget",
                "procurement_officer_lib",
                "program_leader",
                "project_leader",
                "study_leader",
              ]}
            >
              <BudgetPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/disbursements"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "finance_budget",
                "program_leader",
                "project_leader",
              ]}
            >
              <DisbursementsPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance"
        element={
          <ProtectedRoute>
            <RoleGate
              allow={[
                "system_admin",
                "vprei",
                "university_admin",
                "drd",
                "crc_chair",
                "riuh",
                "program_leader",
                "project_leader",
                "study_leader",
              ]}
            >
              <CompliancePage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin"]}>
              <AuditLogsPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/procurement"
        element={
          <ProtectedRoute>
            <RoleGate allow={["system_admin", "vprei", "university_admin", "drd", "procurement_officer_lib", "finance_budget", "program_leader", "project_leader"]}>
              <ProcurementPage />
            </RoleGate>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}