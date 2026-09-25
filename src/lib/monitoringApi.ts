import { apiClient } from "./apiClient";
import type {
  EvaluationCriterion,
  EvaluationOutcome,
  EvaluationScore,
  ExtensionRequest,
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

  getCriteria: async (): Promise<EvaluationCriterion[]> => {
    const { data } = await apiClient.get("/api/monitoring/evaluation-criteria/");
    return data;
  },
  createCriterion: async (payload: { name: string; description?: string; weight: number; is_active?: boolean }): Promise<EvaluationCriterion> => {
    const { data } = await apiClient.post("/api/monitoring/evaluation-criteria/", payload);
    return data;
  },
  updateCriterion: async (id: number, payload: Partial<{ name: string; description: string; weight: number; is_active: boolean }>): Promise<EvaluationCriterion> => {
    const { data } = await apiClient.patch(`/api/monitoring/evaluation-criteria/${id}/`, payload);
    return data;
  },
  getScores: async (evaluationId: number): Promise<EvaluationScore[]> => {
    const { data } = await apiClient.get(`/api/monitoring/evaluations/${evaluationId}/scores/`);
    return data;
  },
  saveScore: async (evaluationId: number, payload: { criterion: number; score: string; remarks?: string }): Promise<EvaluationScore> => {
    const { data } = await apiClient.post(`/api/monitoring/evaluations/${evaluationId}/scores/`, payload);
    return data;
  },

  getExtensionRequests: async (params: { project?: number } = {}): Promise<ExtensionRequest[]> => {
    const { data } = await apiClient.get("/api/monitoring/extension-requests/", { params });
    return data;
  },
  createExtensionRequest: async (payload: { project: number; requested_end_date: string; justification: string }): Promise<ExtensionRequest> => {
    const { data } = await apiClient.post("/api/monitoring/extension-requests/", payload);
    return data;
  },
  actOnExtensionRequest: async (id: number, action: "endorse" | "approve" | "deny", remarks?: string): Promise<ExtensionRequest> => {
    const { data } = await apiClient.post(`/api/monitoring/extension-requests/${id}/action/`, { action, remarks });
    return data;
  },
};
