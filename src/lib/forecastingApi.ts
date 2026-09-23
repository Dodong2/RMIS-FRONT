import { apiClient } from "./apiClient";
import type { ForecastRun } from "../types/forecasting";

export const forecastingApi = {
  getRuns: async (params: { project?: number } = {}): Promise<ForecastRun[]> => {
    const { data } = await apiClient.get("/api/forecasting/runs/", { params });
    return data;
  },
  triggerRun: async (project: number): Promise<ForecastRun> => {
    const { data } = await apiClient.post("/api/forecasting/runs/trigger/", { project });
    return data;
  },
};
