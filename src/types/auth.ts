export interface Role {
  id: number;
  code: string;
  name: string;
}

export interface User {
  pk: number;
  username: string;
  email: string;
  role: Role | null;
  is_pending_role: boolean;
  is_active: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  password2: string;
  requested_role: number | null;
}

export interface PendingUser {
  id: number;
  email: string;
  registration_method: "email" | "google";
  requested_role: Role | null;
  date_joined: string;
}

export interface AdminUser {
  id: number;
  email: string;
  role: Role | null;
  is_active: boolean;
  date_joined: string;
}

export interface AuditLog {
  id: number;
  actor: number | null;
  actor_email: string | null;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  status_code: number;
  ip_address: string | null;
  created_at: string;
}