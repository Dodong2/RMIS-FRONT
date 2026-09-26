export type FundingType = "institutional" | "core_funded" | "externally_funded";
export type RecordStatus = "active" | "completed" | "archived";
export type Sector =
  | "agriculture_fisheries"
  | "education"
  | "community_development"
  | "information_tech"
  | "politics"
  | "others";
export type ResearchType = "basic" | "applied";
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
}

export interface Program {
  id: number;
  code: string | null;
  title: string;
  funding_type: FundingType;
  rei_thrust: string;
  lead: number;
  lead_detail: Lead;
  status: RecordStatus;
  start_date: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  program: number | null;
  title: string;
  project_code: string;
  funding_type: FundingType;
  ntp_number: string;
  ntp_date: string | null;
  toe_signed_date: string | null;
  is_dry_research: boolean;
  lead: number;
  lead_detail: Lead;
  lead_gender: Gender | "";
  contact_number: string;
  status: RecordStatus;
  start_date: string | null;
  target_end_date: string | null;
  rei_thrust: string;
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
}

export interface ProjectTeamMember {
  id: number;
  project: number;
  member_role: TeamMemberRole;
  name: string;
  gender: Gender | "";
  user: number | null;
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

export interface ProjectStatusHistory {
  id: number;
  project: number;
  from_status: RecordStatus;
  to_status: RecordStatus;
  remarks: string;
  changed_by: number;
  changed_by_email: string;
  changed_at: string;
}

export interface Study {
  id: number;
  project: number;
  title: string;
  lead: number;
  lead_detail: Lead;
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
  created_at: string;
}