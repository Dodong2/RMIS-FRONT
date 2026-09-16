import { apiClient } from "./apiClient";
import type { AuthTokens, GoogleExchangeResponse, LoginPayload, RegisterPayload, User } from "../types/auth";

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthTokens> => {
    const { data } = await apiClient.post("/api/auth/login/", payload);
    return data;
  },
  register: async (payload: RegisterPayload): Promise<AuthTokens> => {
    const { data } = await apiClient.post("/api/auth/registration/", payload);
    return data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post("/api/auth/logout/");
  },
  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get("/api/auth/user/");
    return data;
  },
  googleExchange: async (supabaseAccessToken: string): Promise<GoogleExchangeResponse> => {
    const { data } = await apiClient.post("/api/auth/google/exchange/", {
      supabase_access_token: supabaseAccessToken,
    });
    return data;
  },
};