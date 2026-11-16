import { apiClient } from "./apiClient";
import type { ForecastProject, ForecastRun } from "../types/forecasting";

/** Task 64-A: the project's title first, its NTP second. */
export const forecastProjectLabel = (p: ForecastProject) => `${p.title} — ${p.project_code}`;

export const forecastingApi = {
  getProjects: async (): Promise<ForecastProject[]> => {
    const { data } = await apiClient.get("/api/forecasting/projects/");
    return data;
  },
  getRuns: async (params: { project?: number } = {}): Promise<ForecastRun[]> => {
    const { data } = await apiClient.get("/api/forecasting/runs/", { params });
    return data;
  },
  triggerRun: async (project: number): Promise<ForecastRun> => {
    const { data } = await apiClient.post("/api/forecasting/runs/trigger/", { project });
    return data;
  },
};
