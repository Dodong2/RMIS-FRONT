/**
 * Mirrors accounts/management/commands/seed_roles.py.
 *
 * Permission checks are written against `tier`, never against `code` — same rule
 * the backend's HasAccess class follows. Program Leader and Project Leader share
 * the `project_management` tier, so they see the same navigation without either
 * code being listed twice anywhere.
 *
 * Keep this file in sync whenever the client revises the role list.
 */

export type RoleTier =
  | "system_admin"
  | "institution_oversight"
  | "campus_coordination"
  | "college_oversight"
  | "finance"
  | "procurement"
  | "project_management"
  | "study_management"
  | "execution";

export interface RoleMeta {
  code: string;
  name: string;
  tier: RoleTier;
  /** One line the user reads on their own dashboard. Written for them, not for us. */
  scopeLine: string;
}

export const ROLE_META: Record<string, RoleMeta> = {
  system_admin: {
    code: "system_admin",
    name: "System Admin",
    tier: "system_admin",
    scopeLine: "Full system access across all campuses and colleges",
  },
  vprei: {
    code: "vprei",
    name: "VP for REI",
    tier: "institution_oversight",
    scopeLine: "Institution-wide research oversight",
  },
  university_admin: {
    code: "university_admin",
    name: "University Administration",
    tier: "institution_oversight",
    scopeLine: "Institution-wide research oversight",
  },
  drd: {
    code: "drd",
    name: "DRD",
    tier: "institution_oversight",
    scopeLine: "Institution-wide research oversight",
  },
  crc_chair: {
    code: "crc_chair",
    name: "CRC Chairperson",
    tier: "campus_coordination",
    scopeLine: "Research coordination across your campus",
  },
  riuh: {
    code: "riuh",
    name: "RIUH",
    tier: "college_oversight",
    scopeLine: "Research oversight within your college",
  },
  finance_budget: {
    code: "finance_budget",
    name: "Finance/Accounting/Budget",
    tier: "finance",
    scopeLine: "Budget monitoring and disbursement review",
  },
  procurement_officer_lib: {
    code: "procurement_officer_lib",
    name: "Procurement Officer - LIB",
    tier: "procurement",
    scopeLine: "Procurement requests and supplier records",
  },
  program_leader: {
    code: "program_leader",
    name: "Program Leader",
    tier: "project_management",
    scopeLine: "Programs and projects you lead",
  },
  project_leader: {
    code: "project_leader",
    name: "Project Leader",
    tier: "project_management",
    scopeLine: "Projects you lead",
  },
  study_leader: {
    code: "study_leader",
    name: "Study Leader",
    tier: "study_management",
    scopeLine: "Studies you lead",
  },
  project_staff: {
    code: "project_staff",
    name: "Project Staff",
    tier: "execution",
    scopeLine: "Tasks and activities assigned to you",
  },
};

/**
 * The backend's RoleSerializer currently returns { id, code, name } only. Until
 * `tier` is added there, resolve it from the table above. Once the serializer
 * sends `tier`, that value wins and this lookup becomes the fallback.
 */
export function resolveTier(role?: { code?: string; tier?: string } | null): RoleTier | null {
  if (!role) return null;
  if (role.tier) return role.tier as RoleTier;
  if (role.code && ROLE_META[role.code]) return ROLE_META[role.code].tier;
  return null;
}

export function roleLabel(role?: { code?: string; name?: string } | null): string {
  if (!role) return "No role assigned";
  return role.name ?? ROLE_META[role.code ?? ""]?.name ?? role.code ?? "Unknown role";
}

export function roleScopeLine(role?: { code?: string } | null): string {
  if (!role?.code) return "Waiting for a role assignment";
  return ROLE_META[role.code]?.scopeLine ?? "";
}

export function personName(u?: { email: string; full_name?: string; first_name?: string; last_name?: string } | null): string {
  if (!u) return "";
  return u.full_name || `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;
}

/** Two-letter monogram for the avatar, from the email or full name. */
export function initialsFrom(value?: string | null): string {
  if (!value) return "??";
  const name = value.includes("@") ? value.split("@")[0] : value;
  const parts = name.split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
/**
 * Mirrors research_projects/views.py. Client decision 2026-09-29 (Option A): CRC Chair, DRD and RIUH register
 * programs/projects/studies (incl. Excel import). Client meeting 2026-10-01 added the Project Leader back, for
 * projects they lead only. Leaders edit their own records, and the backend blocks them from changing the project
 * code, lead, or program.
 */
export const REGISTRATION_ROLE_CODES = ["system_admin", "crc_chair", "drd", "riuh", "project_leader"];
export const PROJECT_EDIT_ROLE_CODES = [...REGISTRATION_ROLE_CODES, "program_leader", "study_leader"];
