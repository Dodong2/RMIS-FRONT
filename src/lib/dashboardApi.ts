import { apiClient } from "./apiClient";
import type {
  AnalyticsScope,
  AppendixEEntry,
  AppendixFExport,
  AppendixGExport,
  BudgetDashboard,
  ComplianceDashboard,
  ForecastingDashboard,
  FundingAllocationDashboard,
  TaskDashboardRow,
  OutputDashboard,
  PlanningMetric,
  PlanningTarget,
  PlanningTargetComparison,
  PerformanceDashboard,
  PortfolioDashboard,
  ProjectDashboard,
  REIThrustAlignment,
} from "../types/dashboard";

export const dashboardApi = {
  getProjectDashboard: async (params: AnalyticsScope & { funding_type?: string } = {}): Promise<ProjectDashboard> => {
    const { data } = await apiClient.get("/api/dashboard/projects/", { params });
    return data;
  },
  getBudgetDashboard: async (params: AnalyticsScope = {}): Promise<BudgetDashboard> => {
    const { data } = await apiClient.get("/api/dashboard/budget/", { params });
    return data;
  },
  getComplianceDashboard: async (params: AnalyticsScope = {}): Promise<ComplianceDashboard> => {
    const { data } = await apiClient.get("/api/dashboard/compliance/", { params });
    return data;
  },
  getOutputDashboard: async (params: AnalyticsScope & { year?: number } = {}): Promise<OutputDashboard> => {
    const { data } = await apiClient.get("/api/dashboard/outputs/", { params });
    return data;
  },
  getForecastingDashboard: async (
    params: AnalyticsScope & { funding_type?: string } = {},
  ): Promise<ForecastingDashboard> => {
    const { data } = await apiClient.get("/api/dashboard/forecasting/", { params });
    return data;
  },
  getFundingAllocationDashboard: async (params: { run?: number } = {}): Promise<FundingAllocationDashboard | null> => {
    try {
      const { data } = await apiClient.get("/api/dashboard/funding-allocation/", { params });
      return data;
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) return null;
      throw err;
    }
  },
  getTaskDashboard: async (params: { project?: number } = {}): Promise<TaskDashboardRow[]> => {
    const { data } = await apiClient.get("/api/dashboard/tasks/", { params });
    return data;
  },
  getPortfolioDashboard: async (params: AnalyticsScope = {}): Promise<PortfolioDashboard> => {
    const { data } = await apiClient.get("/api/dashboard/portfolio/", { params });
    return data;
  },
  getPerformanceDashboard: async (params: AnalyticsScope = {}): Promise<PerformanceDashboard> => {
    const { data } = await apiClient.get("/api/dashboard/performance/", { params });
    return data;
  },
  getREIThrustAlignment: async (params: AnalyticsScope = {}): Promise<REIThrustAlignment> => {
    const { data } = await apiClient.get("/api/dashboard/rei-thrust-alignment/", { params });
    return data;
  },

  getPlanningTargets: async (): Promise<PlanningTarget[]> => {
    const { data } = await apiClient.get("/api/dashboard/planning-targets/");
    return data;
  },
  createPlanningTarget: async (payload: {
    metric: PlanningMetric;
    campus?: string;
    target_year: number;
    target_value: string;
  }): Promise<PlanningTarget> => {
    const { data } = await apiClient.post("/api/dashboard/planning-targets/", payload);
    return data;
  },
  getPlanningTargetComparison: async (params: { year?: number } = {}): Promise<PlanningTargetComparison[]> => {
    const { data } = await apiClient.get("/api/dashboard/planning-targets/comparison/", { params });
    return data;
  },

  getAppendixE: async (projectId: number): Promise<AppendixEEntry[]> => {
    const { data } = await apiClient.get(`/api/dashboard/exports/appendix-e/${projectId}/`);
    return data;
  },
  getAppendixF: async (projectId: number): Promise<AppendixFExport | null> => {
    try {
      const { data } = await apiClient.get(`/api/dashboard/exports/appendix-f/${projectId}/`);
      return data;
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) return null;
      throw err;
    }
  },
  getAppendixG: async (params: { campus?: string; year?: number } = {}): Promise<AppendixGExport> => {
    const { data } = await apiClient.get("/api/dashboard/exports/appendix-g/", { params });
    return data;
  },
};
