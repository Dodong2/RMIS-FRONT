import type { Lead } from "./research";

export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";
export type ChangeType = "leader" | "staff";
export type ChangeStatus = "initiated" | "clearance_pending" | "cleared" | "completed";

export interface StaffProfile {
  id: number;
  user: number;
  user_detail: Lead;
  staff_level: 1 | 2 | 3;
  updated_at: string;
}

export interface ProjectAssignment {
  id: number;
  user: number;
  user_detail: Lead;
  project: number | null;
  study: number | null;
  role_label: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Task {
  id: number;
  project: number;
  study: number | null;
  title: string;
  description: string;
  due_date: string | null;
  status: TaskStatus;
  assignee: number;
  assignee_detail: Lead;
  assigned_by: number;
  created_at: string;
}

export interface PropertyClearance {
  id: number;
  items: string;
  par_number: string;
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  remarks: string;
}

export interface PersonnelChange {
  id: number;
  change_type: ChangeType;
  program: number | null;
  project: number | null;
  study: number | null;
  assignment: number | null;
  outgoing: number;
  outgoing_detail: Lead;
  incoming: number;
  incoming_detail: Lead;
  reason: string;
  status: ChangeStatus;
  initiated_by: number;
  created_at: string;
  completed_at: string | null;
  clearance: PropertyClearance;
}

export interface LeaderLoad {
  user: number;
  email: string;
  role: string;
  active_programs: number;
  program_cap: number;
  active_projects: number;
  project_cap: number;
}
