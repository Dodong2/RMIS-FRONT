import { apiClient } from "./apiClient";
import type { AuthTokens, LoginPayload, RegisterPayload, User, Role, PendingUser, AdminUser } from "../types/auth";

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
  toggleUserActive: async (userId: number): Promise<{ is_active: boolean }> => {
    const { data } = await apiClient.patch(`/api/admin/users/${userId}/toggle-active/`);
    return data;
  },
};