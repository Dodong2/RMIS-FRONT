import { apiClient } from "./apiClient";
import type {
  AHPMatrixRun,
  AHPPairwiseComparison,
  DecisionCriterion,
  FundingRecommendationRun,
  SensitivityAnalysisResult,
} from "../types/decisionSupport";

export const decisionSupportApi = {
  getCriteria: async (): Promise<DecisionCriterion[]> => {
    const { data } = await apiClient.get("/api/decision-support/criteria/");
    return data;
  },
  createCriterion: async (payload: {
    name: string;
    metric_key: string;
    description?: string;
  }): Promise<DecisionCriterion> => {
    const { data } = await apiClient.post("/api/decision-support/criteria/", payload);
    return data;
  },
  getAHPRuns: async (): Promise<AHPMatrixRun[]> => {
    const { data } = await apiClient.get("/api/decision-support/ahp-runs/");
    return data;
  },
  getAHPRun: async (id: number): Promise<AHPMatrixRun> => {
    const { data } = await apiClient.get(`/api/decision-support/ahp-runs/${id}/`);
    return data;
  },
  createAHPRun: async (payload: { label: string; criteria: number[] }): Promise<AHPMatrixRun> => {
    const { data } = await apiClient.post("/api/decision-support/ahp-runs/", payload);
    return data;
  },
  submitComparisons: async (
    runId: number,
    comparisons: { criterion_row: number; criterion_col: number; value: number }[],
  ): Promise<AHPPairwiseComparison[]> => {
    const { data } = await apiClient.post(`/api/decision-support/ahp-runs/${runId}/comparisons/`, {
      comparisons,
    });
    return data;
  },
  finalizeAHPRun: async (runId: number): Promise<AHPMatrixRun> => {
    const { data } = await apiClient.post(`/api/decision-support/ahp-runs/${runId}/finalize/`);
    return data;
  },
  getRecommendationRuns: async (): Promise<FundingRecommendationRun[]> => {
    const { data } = await apiClient.get("/api/decision-support/recommendation-runs/");
    return data;
  },
  getRecommendationRun: async (id: number): Promise<FundingRecommendationRun> => {
    const { data } = await apiClient.get(`/api/decision-support/recommendation-runs/${id}/`);
    return data;
  },
  triggerRecommendationRun: async (payload: {
    ahp_run: number;
    label?: string;
    funding_type?: string;
    campus?: string;
  }): Promise<FundingRecommendationRun> => {
    const { data } = await apiClient.post("/api/decision-support/recommendation-runs/trigger/", payload);
    return data;
  },
  getSensitivity: async (
    runId: number,
    criterionId: number,
    delta: number,
  ): Promise<SensitivityAnalysisResult> => {
    const { data } = await apiClient.get(`/api/decision-support/recommendation-runs/${runId}/sensitivity/`, {
      params: { criterion: criterionId, delta },
    });
    return data;
  },
};
