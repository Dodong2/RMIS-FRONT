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
