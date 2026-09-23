import { apiClient } from "./apiClient";
import type {
  EvaluationOutcome,
  MidtermReport,
  MonthlyProgressReport,
  ProjectEvaluation,
  ProjectMonitoringStatus,
  RenewalApplication,
  RenewalStatus,
  TerminalReport,
} from "../types/monitoring";

export const monitoringApi = {
  getProjectStatus: async (projectId: number): Promise<ProjectMonitoringStatus> => {
    const { data } = await apiClient.get(`/api/monitoring/status/${projectId}/`);
    return data;
  },

  getMonthlyReports: async (params: { project?: number } = {}): Promise<MonthlyProgressReport[]> => {
    const { data } = await apiClient.get("/api/monitoring/monthly-reports/", { params });
    return data;
  },
  createMonthlyReport: async (payload: {
    project: number;
    period: string;
    narrative?: string;
    document?: number | null;
  }): Promise<MonthlyProgressReport> => {
    const { data } = await apiClient.post("/api/monitoring/monthly-reports/", payload);
    return data;
  },

  getMidtermReports: async (params: { project?: number } = {}): Promise<MidtermReport[]> => {
    const { data } = await apiClient.get("/api/monitoring/midterm-reports/", { params });
    return data;
  },
  createMidtermReport: async (payload: {
    project: number;
    project_year: number;
    narrative?: string;
    expenditure_summary?: string;
    document?: number | null;
  }): Promise<MidtermReport> => {
    const { data } = await apiClient.post("/api/monitoring/midterm-reports/", payload);
    return data;
  },

  getTerminalReports: async (params: { project?: number } = {}): Promise<TerminalReport[]> => {
    const { data } = await apiClient.get("/api/monitoring/terminal-reports/", { params });
    return data;
  },
  createTerminalReport: async (payload: {
    project: number;
    narrative?: string;
    document?: number | null;
  }): Promise<TerminalReport> => {
    const { data } = await apiClient.post("/api/monitoring/terminal-reports/", payload);
    return data;
  },
  certifyTerminalReport: async (id: number): Promise<TerminalReport> => {
    const { data } = await apiClient.post(`/api/monitoring/terminal-reports/${id}/certify/`);
    return data;
  },

  getEvaluations: async (params: { project?: number } = {}): Promise<ProjectEvaluation[]> => {
    const { data } = await apiClient.get("/api/monitoring/evaluations/", { params });
    return data;
  },
  createEvaluation: async (payload: {
    project: number;
    project_year: number;
    scheduled_date: string;
    panel_members?: string;
  }): Promise<ProjectEvaluation> => {
    const { data } = await apiClient.post("/api/monitoring/evaluations/", payload);
    return data;
  },
  updateEvaluation: async (
    id: number,
    payload: Partial<{ outcome: EvaluationOutcome; remarks: string }>,
  ): Promise<ProjectEvaluation> => {
    const { data } = await apiClient.patch(`/api/monitoring/evaluations/${id}/`, payload);
    return data;
  },

  getRenewalApplications: async (params: { project?: number } = {}): Promise<RenewalApplication[]> => {
    const { data } = await apiClient.get("/api/monitoring/renewal-applications/", { params });
    return data;
  },
  createRenewalApplication: async (payload: {
    project: number;
    application_year: number;
    underspend_justification?: string;
  }): Promise<RenewalApplication> => {
    const { data } = await apiClient.post("/api/monitoring/renewal-applications/", payload);
    return data;
  },
  decideRenewalApplication: async (id: number, status: RenewalStatus): Promise<RenewalApplication> => {
    const { data } = await apiClient.post(`/api/monitoring/renewal-applications/${id}/decide/`, { status });
    return data;
  },
};
