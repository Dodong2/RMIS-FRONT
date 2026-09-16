export interface Role {
  id: number;
  code: string;
  name: string;
}

export interface User {
  pk: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role | null;
  is_pending_role: boolean;
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
  username: string;
  email: string;
  password1: string;
  password2: string;
}

export interface GoogleExchangeResponse {
  access: string;
  refresh: string;
  is_pending_role: boolean;
}