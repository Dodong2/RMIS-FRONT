import { apiClient } from "./apiClient";
import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  RegistrationOptions,
  RegistrationProfilePayload,
  User,
  Role,
  PendingUser,
  AdminUser,
  AuditLog,
  AccountStatus,
  UserScope,
  PermissionMatrix,
  TemporaryReplacement,
  SelfProfile,
  SelfProfileUpdate,
  PasswordChangePayload,
} from "../types/auth";

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthTokens> => {
    const { data } = await apiClient.post("/api/auth/login/", payload);
    return data;
  },
  register: async (payload: RegisterPayload): Promise<void> => {
    await apiClient.post("/api/auth/register/", payload);
  },
  getRegistrationOptions: async (): Promise<RegistrationOptions> => {
    const { data } = await apiClient.get("/api/auth/registration-options/");
    return data;
  },
  verifyEmail: async (uid: string, token: string): Promise<{ detail: string }> => {
    const { data } = await apiClient.post("/api/auth/verify-email/", { uid, token });
    return data;
  },
  resendVerification: async (email: string): Promise<{ detail: string }> => {
    const { data } = await apiClient.post("/api/auth/resend-verification/", { email });
    return data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post("/api/auth/logout/");
  },
  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get("/api/auth/user/");
    return data;
  },
  getProfile: async (): Promise<SelfProfile> => {
    const { data } = await apiClient.get("/api/auth/profile/");
    return data;
  },
  updateProfile: async (profile: SelfProfileUpdate): Promise<SelfProfile> => {
    const { data } = await apiClient.patch("/api/auth/profile/", profile);
    return data;
  },
  changePassword: async (payload: PasswordChangePayload): Promise<void> => {
    await apiClient.post("/api/auth/password/change/", payload);
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
  googleRequestRole: async (
    supabaseAccessToken: string,
    payload: RegistrationProfilePayload & { first_name: string; last_name: string },
  ): Promise<void> => {
    await apiClient.post("/api/auth/google/request/", { supabase_access_token: supabaseAccessToken, ...payload });
  },
  getPendingUsers: async (): Promise<PendingUser[]> => {
    const { data } = await apiClient.get("/api/admin/pending-users/");
    return data;
  },
  getUsers: async (): Promise<AdminUser[]> => {
    const { data } = await apiClient.get("/api/admin/users/");
    return data;
  },
  rejectRegistration: async (userId: number, reason: string): Promise<void> => {
    await apiClient.post(`/api/admin/pending-users/${userId}/reject/`, { reason });
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
  updateUserProfile: async (
    userId: number,
    profile: {
      first_name: string;
      last_name: string;
      office: string;
      position: string;
      staff_id: string;
      gender: string;
      campus: string;
      college_unit: string;
      mobile_number: string;
    },
  ): Promise<AdminUser> => {
    const { data } = await apiClient.patch(`/api/admin/users/${userId}/profile/`, profile);
    return data;
  },
  updateUserScope: async (userId: number, scope: { campus: string; college: string }): Promise<{ id: number; scope: UserScope; campus: string }> => {
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