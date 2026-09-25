import { apiClient } from "./apiClient";
import type { ProjectRisk, ProjectRiskStatus, RiskCategory, RiskDashboard, RiskRegisterStatus, RiskUpdate } from "../types/risk";

export type RiskInput = {
  project: number;
  description: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  owner: number;
  mitigation: string;
};

export const riskApi = {
  getDashboard: async (params: { campus?: string; funding_type?: string } = {}): Promise<RiskDashboard> => {
    const { data } = await apiClient.get("/api/risk/dashboard/", { params });
    return data;
  },
  getProjectStatus: async (projectId: number): Promise<ProjectRiskStatus> => {
    const { data } = await apiClient.get(`/api/risk/status/${projectId}/`);
    return data;
  },
  getRegister: async (params: { project?: number; status?: RiskRegisterStatus; category?: RiskCategory } = {}): Promise<ProjectRisk[]> => {
    const { data } = await apiClient.get("/api/risk/register/", { params });
    return data;
  },
  createRisk: async (payload: RiskInput): Promise<ProjectRisk> => {
    const { data } = await apiClient.post("/api/risk/register/", payload);
    return data;
  },
  updateRisk: async (id: number, payload: Partial<Omit<RiskInput, "project">>): Promise<ProjectRisk> => {
    const { data } = await apiClient.patch(`/api/risk/register/${id}/`, payload);
    return data;
  },
  getUpdates: async (riskId: number): Promise<RiskUpdate[]> => {
    const { data } = await apiClient.get(`/api/risk/register/${riskId}/updates/`);
    return data;
  },
  addUpdate: async (riskId: number, payload: { note: string; new_status: RiskRegisterStatus | "" }): Promise<RiskUpdate> => {
    const { data } = await apiClient.post(`/api/risk/register/${riskId}/updates/`, payload);
    return data;
  },
};
