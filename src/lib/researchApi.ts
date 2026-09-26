import { apiClient } from "./apiClient";
import { downloadReport } from "./reportsApi";
import type {
  Program,
  Project,
  ProjectStatusHistory,
  ProjectTeamMember,
  Study,
  Milestone,
  TargetBeneficiary,
} from "../types/research";
import type { AdminUser } from "../types/auth";

export const researchApi = {
  getPrograms: async (): Promise<Program[]> => {
    const { data } = await apiClient.get("/api/programs/");
    return data;
  },
  createProgram: async (payload: {
    title: string;
    funding_type: string;
    rei_thrust?: string;
    lead: number;
    start_date?: string;
  }): Promise<Program> => {
    const { data } = await apiClient.post("/api/programs/", payload);
    return data;
  },
  getProjects: async (): Promise<Project[]> => {
    const { data } = await apiClient.get("/api/projects/");
    return data;
  },
  getProject: async (id: number): Promise<Project> => {
    const { data } = await apiClient.get(`/api/projects/${id}/`);
    return data;
  },
  createProject: async (payload: {
    program: number | null;
    title: string;
    project_code: string;
    funding_type: string;
    ntp_number?: string;
    ntp_date?: string;
    toe_signed_date?: string;
    is_dry_research: boolean;
    lead: number;
    start_date?: string;
    target_end_date?: string;
    rei_thrust?: string;
    sdgs: number[];
    sectors: string[];
    sector_other?: string;
    is_continuing?: boolean;
    continuing_year?: number;
    research_type?: string;
    research_priority_area?: string;
    research_typology?: string[];
    campus?: string;
    college?: string;
    implementing_unit?: string;
    cooperating_agencies?: string;
    total_cost?: string;
    lead_gender?: string;
    contact_number?: string;
    background?: string;
    objectives?: string;
    methodology?: string;
    socio_economic_significance?: string;
    monitoring_evaluation?: string;
    references?: string;
    description?: string;
    expected_outcomes?: string;
    expected_impacts?: string;
    proposal_submitted_on?: string;
    proposal_reviewed_on?: string;
    proposal_approved_on?: string;
    reviewing_body?: string;
    endorsed_by_dean?: string;
    endorsed_by_dean_on?: string;
    noted_by_rds_director?: string;
    noted_by_rds_director_on?: string;
    recommended_by_campus_director?: string;
    recommended_by_campus_director_on?: string;
    recommended_by_vprde?: string;
    recommended_by_vprde_on?: string;
    approved_by_president?: string;
  }): Promise<Project> => {
    const { data } = await apiClient.post("/api/projects/", payload);
    return data;
  },
  downloadImportTemplate: () =>
    downloadReport("/api/projects/import-template/", {}, "rmis_project_registration_template.xlsx"),
  importProject: async (file: File): Promise<Project> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post("/api/projects/import/", form);
    return data;
  },
  getTeamMembers: async (projectId: number): Promise<ProjectTeamMember[]> => {
    const { data } = await apiClient.get("/api/project-team/", { params: { project: projectId } });
    return data;
  },
  createTeamMember: async (payload: {
    project: number;
    member_role: string;
    name: string;
    gender?: string;
  }): Promise<ProjectTeamMember> => {
    const { data } = await apiClient.post("/api/project-team/", payload);
    return data;
  },
  getBeneficiaries: async (projectId: number): Promise<TargetBeneficiary[]> => {
    const { data } = await apiClient.get("/api/target-beneficiaries/", { params: { project: projectId } });
    return data;
  },
  createBeneficiary: async (payload: {
    project: number;
    group: string;
    description?: string;
    total: number;
  }): Promise<TargetBeneficiary> => {
    const { data } = await apiClient.post("/api/target-beneficiaries/", payload);
    return data;
  },
  getStudies: async (projectId: number): Promise<Study[]> => {
    const { data } = await apiClient.get(`/api/studies/?project=${projectId}`);
    return data;
  },
  createStudy: async (payload: { project: number; title: string; lead: number }): Promise<Study> => {
    const { data } = await apiClient.post("/api/studies/", payload);
    return data;
  },
  getMilestones: async (projectId?: number, opts: { delayed?: boolean } = {}): Promise<Milestone[]> => {
    const { data } = await apiClient.get("/api/milestones/", {
      params: { ...(projectId ? { project: projectId } : {}), ...(opts.delayed ? { delayed: "true" } : {}) },
    });
    return data;
  },
  createMilestone: async (payload: {
    project: number;
    title: string;
    target_date: string;
    start_date?: string;
    objective?: string;
    deliverable?: string;
    responsible?: number | null;
    remarks?: string;
  }): Promise<Milestone> => {
    const { data } = await apiClient.post("/api/milestones/", payload);
    return data;
  },
  updateMilestone: async (
    id: number,
    payload: Partial<{
      title: string;
      start_date: string | null;
      target_date: string;
      objective: string;
      deliverable: string;
      responsible: number | null;
      status: string;
    }>,
  ): Promise<Milestone> => {
    const { data } = await apiClient.patch(`/api/milestones/${id}/`, payload);
    return data;
  },
  updateMilestoneStatus: async (id: number, status: string): Promise<Milestone> => {
    const { data } = await apiClient.patch(`/api/milestones/${id}/`, { status });
    return data;
  },
  updateProject: async (id: number, payload: Partial<Project> & { status_remarks?: string }): Promise<Project> => {
    const { data } = await apiClient.patch(`/api/projects/${id}/`, payload);
    return data;
  },
  getStatusHistory: async (id: number): Promise<ProjectStatusHistory[]> => {
    const { data } = await apiClient.get(`/api/projects/${id}/status-history/`);
    return data;
  },
  getUsersByRole: async (code: string): Promise<AdminUser[]> => {
    const { data } = await apiClient.get(`/api/users/by-role/?code=${code}`);
    return data;
  },
};