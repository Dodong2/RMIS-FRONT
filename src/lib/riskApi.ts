import { apiClient } from "./apiClient";
import type { ProjectRiskStatus, RiskDashboard } from "../types/risk";

export const riskApi = {
  getDashboard: async (params: { campus?: string; funding_type?: string } = {}): Promise<RiskDashboard> => {
    const { data } = await apiClient.get("/api/risk/dashboard/", { params });
    return data;
  },
  getProjectStatus: async (projectId: number): Promise<ProjectRiskStatus> => {
    const { data } = await apiClient.get(`/api/risk/status/${projectId}/`);
    return data;
  },
};
