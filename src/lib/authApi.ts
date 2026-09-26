import { apiClient } from "./apiClient";
import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  User,
  Role,
  PendingUser,
  AdminUser,
  AuditLog,
  AccountStatus,
  UserScope,
  PermissionMatrix,
  TemporaryReplacement,
} from "../types/auth";

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthTokens> => {
    const { data } = await apiClient.post("/api/auth/login/", payload);
    return data;
  },
  register: async (payload: RegisterPayload): Promise<void> => {
    await apiClient.post("/api/auth/register/", payload);
  },
  logout: async (): Promise<void> => {
    await apiClient.post("/api/auth/logout/");
  },
  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get("/api/auth/user/");
    return data;
  },
  getRoles: async (): Promise<Role[]> => {
    const { data } = await apiClient.get("/api/roles/");
    return data;
  },
  googleExchange: async (supabaseAccessToken: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post("/api/auth/google/exchange/", {
      supabase_access_token: supabaseAccessToken,
    });
    return data;
  },
  googleRequestRole: async (supabaseAccessToken: string, requestedRoleId: number): Promise<void> => {
    await apiClient.post("/api/auth/google/request/", {
      supabase_access_token: supabaseAccessToken,
      requested_role: requestedRoleId,
    });
  },
  getPendingUsers: async (): Promise<PendingUser[]> => {
    const { data } = await apiClient.get("/api/admin/pending-users/");
    return data;
  },
  getUsers: async (): Promise<AdminUser[]> => {
    const { data } = await apiClient.get("/api/admin/users/");
    return data;
  },
  assignRole: async (userId: number, roleId: number): Promise<void> => {
    await apiClient.patch(`/api/admin/pending-users/${userId}/assign-role/`, { role_id: roleId });
  },
  updateUserRole: async (userId: number, roleId: number): Promise<void> => {
    await apiClient.patch(`/api/admin/users/${userId}/update-role/`, { role_id: roleId });
  },
  setAccountStatus: async (
    userId: number,
    action: "suspend" | "reactivate" | "deactivate",
  ): Promise<{ id: number; account_status: AccountStatus; is_active: boolean }> => {
    const { data } = await apiClient.post(`/api/admin/users/${userId}/account-status/`, { action });
    return data;
  },
  updateUserScope: async (userId: number, scope: { campus: string; college: string }): Promise<{ id: number; scope: UserScope }> => {
    const { data } = await apiClient.patch(`/api/admin/users/${userId}/scope/`, scope);
    return data;
  },
  getPermissionMatrix: async (): Promise<PermissionMatrix> => {
    const { data } = await apiClient.get("/api/admin/permissions/");
    return data;
  },
  getAuditLogs: async (params: { actor?: number; method?: string } = {}): Promise<AuditLog[]> => {
    const { data } = await apiClient.get("/api/admin/audit-logs/", { params });
    return data;
  },
  getTemporaryReplacements: async (params: { suspended_user?: number; current?: boolean } = {}): Promise<TemporaryReplacement[]> => {
    const { data } = await apiClient.get("/api/admin/temporary-replacements/", {
      params: { ...(params.suspended_user ? { suspended_user: params.suspended_user } : {}), ...(params.current ? { current: "true" } : {}) },
    });
    return data;
  },
  createTemporaryReplacement: async (payload: {
    suspended_user: number;
    replacement: number;
    designation?: string;
    coverage?: string;
    start_date: string;
    end_date: string;
    basis?: string;
  }): Promise<TemporaryReplacement> => {
    const { data } = await apiClient.post("/api/admin/temporary-replacements/", payload);
    return data;
  },
  endTemporaryReplacement: async (id: number): Promise<TemporaryReplacement> => {
    const { data } = await apiClient.post(`/api/admin/temporary-replacements/${id}/end/`);
    return data;
  },
};