import { apiClient } from "./apiClient";
import type { Program, Project, Study, Milestone } from "../types/research";
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
    sector: string;
    sector_other?: string;
    is_continuing?: boolean;
    research_type?: string;
    research_priority_area?: string;
    research_typology?: string[];
    campus?: string;
    implementing_unit?: string;
    cooperating_agencies?: string;
    total_cost?: string;
  }): Promise<Project> => {
    const { data } = await apiClient.post("/api/projects/", payload);
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
  getMilestones: async (projectId?: number): Promise<Milestone[]> => {
    const { data } = await apiClient.get("/api/milestones/", { params: projectId ? { project: projectId } : {} });
    return data;
  },
  createMilestone: async (payload: {
    project: number;
    title: string;
    target_date: string;
    remarks?: string;
  }): Promise<Milestone> => {
    const { data } = await apiClient.post("/api/milestones/", payload);
    return data;
  },
  updateMilestoneStatus: async (id: number, status: string): Promise<Milestone> => {
    const { data } = await apiClient.patch(`/api/milestones/${id}/`, { status });
    return data;
  },
  getUsersByRole: async (code: string): Promise<AdminUser[]> => {
    const { data } = await apiClient.get(`/api/users/by-role/?code=${code}`);
    return data;
  },
};