const roleLandingMap: Record<string, string> = {
  system_admin: "/admin/pending-users",
};

export function getLandingPath(roleCode?: string | null): string {
  if (!roleCode) return "/registration-pending";
  return roleLandingMap[roleCode] ?? "/dashboard";
}