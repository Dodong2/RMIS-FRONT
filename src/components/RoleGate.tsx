import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface RoleGateProps {
  allow: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();

  if (!user?.role || !allow.includes(user.role.code)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}