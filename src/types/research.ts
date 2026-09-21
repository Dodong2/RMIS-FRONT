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
  status: RecordStatus;
  start_date: string | null;
  target_end_date: string | null;
  rei_thrust: string;
  is_continuing: boolean;
  research_type: ResearchType | "";
  sector: Sector | "";
  sector_other: string;
  research_priority_area: PriorityArea | "";
  research_typology: Typology[];
  sdgs: number[];
  campus: string;
  implementing_unit: string;
  cooperating_agencies: string;
  total_cost: string | null;
  created_at: string;
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
  target_date: string;
  status: MilestoneStatus;
  remarks: string;
  created_at: string;
}