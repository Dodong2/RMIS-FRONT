import { resolveTier, type RoleTier } from "./roles";

export type ProtoRole =
  | "super_admin"
  | "research_director"
  | "campus_research_coordinator"
  | "college_research_coordinator"
  | "project_leader"
  | "researcher"
  | "finance_officer"
  | "compliance_officer"
  | "management_bor";

const TIER_TO_PROTO: Record<RoleTier, ProtoRole> = {
  system_admin: "super_admin",
  institution_oversight: "research_director",
  campus_coordination: "campus_research_coordinator",
  college_oversight: "college_research_coordinator",
  finance: "finance_officer",
  procurement: "finance_officer",
  project_management: "project_leader",
  study_management: "project_leader",
  execution: "researcher",
};

const CODE_TO_PROTO: Record<string, ProtoRole> = {
  riuh: "compliance_officer",
};

export function protoRole(role?: { code?: string; tier?: string } | null): ProtoRole | null {
  if (role?.code && CODE_TO_PROTO[role.code]) return CODE_TO_PROTO[role.code];
  const tier = resolveTier(role);
  return tier ? TIER_TO_PROTO[tier] : null;
}

export const PROTO_ROLE_STYLE: Record<ProtoRole, { color: string; bg: string }> = {
  super_admin: { color: "#1e293b", bg: "#f1f5f9" },
  research_director: { color: "#0d2a5e", bg: "#e0eaf7" },
  campus_research_coordinator: { color: "#0369a1", bg: "#e0f2fe" },
  college_research_coordinator: { color: "#1a56a0", bg: "#dbeafe" },
  project_leader: { color: "#1a3f7a", bg: "#eff6ff" },
  researcher: { color: "#2c5282", bg: "#eff6ff" },
  finance_officer: { color: "#0891b2", bg: "#e0f2fe" },
  compliance_officer: { color: "#7c3aed", bg: "#f5f3ff" },
  management_bor: { color: "#059669", bg: "#d1fae5" },
};

export function protoRoleStyle(role?: { code?: string; tier?: string } | null) {
  const proto = protoRole(role);
  return proto ? PROTO_ROLE_STYLE[proto] : { color: "#64748b", bg: "#f1f5f9" };
}
