import { apiClient } from "./apiClient";
import type {
  AIUseDeclaration,
  ConflictOfInterestDisclosure,
  EthicsReviewReference,
  MisconductCaseReference,
  SimilarityCheckRecord,
} from "../types/compliance";

export const complianceApi = {
  getEthicsReviews: async (params: { project?: number; study?: number } = {}): Promise<EthicsReviewReference[]> => {
    const { data } = await apiClient.get("/api/compliance/ethics-reviews/", { params });
    return data;
  },
  createEthicsReview: async (payload: {
    project: number;
    study?: number | null;
    review_body: string;
    reference_number?: string;
    decision_date?: string | null;
    remarks?: string;
  }): Promise<EthicsReviewReference> => {
    const { data } = await apiClient.post("/api/compliance/ethics-reviews/", payload);
    return data;
  },
  updateEthicsReview: async (
    id: number,
    payload: Partial<{ status: string; decision_date: string | null; remarks: string; reference_number: string }>,
  ): Promise<EthicsReviewReference> => {
    const { data } = await apiClient.patch(`/api/compliance/ethics-reviews/${id}/`, payload);
    return data;
  },

  getSimilarityChecks: async (
    params: { project?: number; study?: number } = {},
  ): Promise<SimilarityCheckRecord[]> => {
    const { data } = await apiClient.get("/api/compliance/similarity-checks/", { params });
    return data;
  },
  createSimilarityCheck: async (payload: {
    project: number;
    study?: number | null;
    document_type: string;
    document_title?: string;
    similarity_index: string;
    software_used?: string;
    checked_on: string;
  }): Promise<SimilarityCheckRecord> => {
    const { data } = await apiClient.post("/api/compliance/similarity-checks/", payload);
    return data;
  },

  getAIDeclarations: async (params: { project?: number; study?: number } = {}): Promise<AIUseDeclaration[]> => {
    const { data } = await apiClient.get("/api/compliance/ai-declarations/", { params });
    return data;
  },
  createAIDeclaration: async (payload: {
    project: number;
    study?: number | null;
    tool_name: string;
    purpose: string;
    extent: string;
    declared_on: string;
  }): Promise<AIUseDeclaration> => {
    const { data } = await apiClient.post("/api/compliance/ai-declarations/", payload);
    return data;
  },

  getCOIDisclosures: async (params: { project?: number } = {}): Promise<ConflictOfInterestDisclosure[]> => {
    const { data } = await apiClient.get("/api/compliance/coi-disclosures/", { params });
    return data;
  },
  createCOIDisclosure: async (payload: {
    project: number;
    discloser: number;
    description: string;
    mitigation_measures?: string;
    disclosed_on: string;
  }): Promise<ConflictOfInterestDisclosure> => {
    const { data } = await apiClient.post("/api/compliance/coi-disclosures/", payload);
    return data;
  },
  updateCOIDisclosure: async (
    id: number,
    payload: Partial<{ status: string; mitigation_measures: string }>,
  ): Promise<ConflictOfInterestDisclosure> => {
    const { data } = await apiClient.patch(`/api/compliance/coi-disclosures/${id}/`, payload);
    return data;
  },

  getMisconductCases: async (params: { project?: number } = {}): Promise<MisconductCaseReference[]> => {
    const { data } = await apiClient.get("/api/compliance/misconduct-cases/", { params });
    return data;
  },
  createMisconductCase: async (payload: {
    project?: number | null;
    subject?: number | null;
    subject_name?: string;
    case_type: string;
    referred_to: string;
    remarks?: string;
    reported_on: string;
  }): Promise<MisconductCaseReference> => {
    const { data } = await apiClient.post("/api/compliance/misconduct-cases/", payload);
    return data;
  },
  updateMisconductCase: async (
    id: number,
    payload: Partial<{ status: string; remarks: string; resolved_on: string | null }>,
  ): Promise<MisconductCaseReference> => {
    const { data } = await apiClient.patch(`/api/compliance/misconduct-cases/${id}/`, payload);
    return data;
  },
};
