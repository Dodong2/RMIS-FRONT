/** A FundingType code from System Admin > Funding Types; institutional / core_funded / externally_funded always exist. */
export type FundingType = string;
export type RecordStatus = "active" | "completed" | "archived";
export type Sector =
  | "agriculture_fisheries"
  | "education"
  | "community_development"
  | "information_tech"
  | "politics"
  | "others";
export type ResearchType = "basic" | "applied" | "not_applicable";
export type PriorityArea =
  | "science_math"
  | "education_teacher_training"
  | "health"
  | "ict"
  | "engineering"
  | "agriculture_fisheries"
  | "environmental_science"
  | "social_sciences_humanities";
export type Typology =
  | "operations"
  | "development"
  | "qualitative"
  | "quantitative"
  | "descriptive_survey"
  | "laboratory_field"
  | "quasi_experimental"
  | "pure_experimental";
export type Gender = "male" | "female";
export type TeamMemberRole = "co_leader" | "member";
export type MilestoneStatus = "pending" | "in_progress" | "done" | "delayed";

export interface Lead {
  id: number;
  email: string;
  /** First + last name, or the e-mail when the account has no name */
  full_name?: string;
}

/** System Admin-managed dropdown choices on Register Approved Project. */
export type AdminChoiceKind = "college-units" | "rde-thrusts" | "cooperating-agencies" | "endorsers" | "funding-types";

export interface AdminChoice {
  id: number;
  /** College Units and RDE Thrusts only; `name` is built from them. Blank on entries made before the split. */
  code?: string;
  title?: string;
  name: string;
  /** RDE Thrusts only: the thrust a priority area sits under; null for a thrust (client 2026-10-20). */
  parent?: number | null;
  /** Endorsers only. */
  designation?: string;
  /** Funding Types only: the three Manual types can be renamed but not deleted. */
  is_system?: boolean;
  created_at: string;
}

export type AdminChoiceInput = { name: string; designation?: string } | { code: string; title: string; parent?: number | null };

export interface Program {
  id: number;
  code: string | null;
  title: string;
  funding_type: FundingType;
  rde_thrust: string;
  rde_priority: string;
  lead: number;
  lead_detail: Lead;
  status: RecordStatus;
  start_date: string | null;
  created_at: string;
}

/** Client 2026-10-24: Draft until the Project Leader submits, then the CRC Chair's and Budget Officer's reviews
 * (backend research_projects/workflow.py, read from the project's LIB). */
export type ReviewStatus =
  | "draft"
  | "submitted"
  | "pending_research_review"
  | "returned_research"
  | "for_budget_review"
  | "pending_budget_review"
  | "returned_budget"
  | "reviews_completed";

export interface Project {
  id: number;
  program: number | null;
  title: string;
  project_code: string;
  funding_type: FundingType;
  ntp_number: string;
  ntp_date: string | null;
  toe_signed_date: string | null;
  is_dry_research: boolean | null;
  lead: number;
  lead_detail: Lead;
  lead_gender: Gender | "";
  contact_number: string;
  status: RecordStatus;
  start_date: string | null;
  target_end_date: string | null;
  rde_thrust: string;
  rde_priority: string;
  is_continuing: boolean;
  continuing_year: number | null;
  research_type: ResearchType | "";
  sectors: Sector[];
  sector_other: string;
  research_priority_area: PriorityArea | "";
  research_typology: Typology[];
  sdgs: number[];
  campus: string;
  college: string;
  implementing_unit: string;
  cooperating_agencies: string;
  total_cost: string | null;
  background: string;
  objectives: string;
  methodology: string;
  socio_economic_significance: string;
  monitoring_evaluation: string;
  references: string;
  description: string;
  beneficiaries: string;
  expected_outcomes: string;
  expected_impacts: string;
  proposal_submitted_on: string | null;
  proposal_reviewed_on: string | null;
  proposal_approved_on: string | null;
  reviewing_body: string;
  endorsed_by_dean: string;
  endorsed_by_dean_on: string | null;
  noted_by_rds_director: string;
  noted_by_rds_director_on: string | null;
  recommended_by_campus_director: string;
  recommended_by_campus_director_on: string | null;
  recommended_by_vprde: string;
  recommended_by_vprde_on: string | null;
  approved_by_president: string;
  created_at: string;
  review_status: ReviewStatus;
  review_status_label: string;
}

export interface ProjectTeamMember {
  id: number;
  project: number;
  member_role: TeamMemberRole;
  name: string;
  gender: Gender | "";
  user: number | null;
}

export interface ProjectEndorser {
  id: number;
  project: number;
  role_code: string;
  user: number | null;
  name: string;
  designation: string;
  signed_on: string | null;
}

export interface TargetBeneficiary {
  id: number;
  project: number;
  group: string;
  description: string;
  total: number;
}

export interface ProjectImportError {
  sheet: string | null;
  row: number | null;
  field: string;
  message: string;
}

/** One activity of a workbook's Work Plan sheet (POST projects/import-work-plan/); start_date is "" when blank. */
export interface WorkPlanImportRow {
  title: string;
  start_date: string;
  target_date: string;
}

/** One LIB row of Step 4's LIB workbook (POST projects/parse-lib/, Task 12); amounts are strings, split over every period. */
export interface LibImportRow {
  category: "ps" | "mooe" | "co";
  description: string;
  specification: string;
  unit: string;
  quantity: string;
  unit_cost: string;
  amount: string;
  allocations: { period: string; amount: string }[];
}

export interface ProjectStatusHistory {
  id: number;
  project: number;
  from_status: RecordStatus;
  to_status: RecordStatus;
  remarks: string;
  changed_by: number;
  changed_by_email: string;
  changed_by_name: string;
  changed_at: string;
}

export interface Study {
  id: number;
  project: number;
  title: string;
  lead: number | null;
  lead_detail: Lead | null;
  status: RecordStatus;
  created_at: string;
}

export interface Milestone {
  id: number;
  project: number;
  title: string;
  start_date: string | null;
  target_date: string;
  status: MilestoneStatus;
  objective: string;
  deliverable: string;
  responsible: number | null;
  responsible_detail: Lead | null;
  remarks: string;
  /** Personnel tasks under this milestone (client meeting 2026-10-01, #14) */
  tasks_total: number;
  tasks_done: number;
  progress_pct: number;
  created_at: string;
}