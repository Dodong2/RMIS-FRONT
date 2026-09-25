import { apiClient } from "./apiClient";
import type {
  CreativeWorkRecord,
  ExpectedOutput,
  ExpectedVsActual,
  IndexingTier,
  IPRecord,
  IPStatus,
  IPType,
  OutcomeKind,
  PublicationRecord,
  ProjectOutcome,
  PublicationType,
  SenseRankedPublisher,
  SixPCategory,
} from "../types/outputs";

export const outputsApi = {
  getExpectedVsActual: async (projectId: number): Promise<ExpectedVsActual> => {
    const { data } = await apiClient.get(`/api/outputs/expected-vs-actual/${projectId}/`);
    return data;
  },
  getOutcomes: async (params: { project?: number } = {}): Promise<ProjectOutcome[]> => {
    const { data } = await apiClient.get("/api/outputs/outcomes/", { params });
    return data;
  },
  createOutcome: async (payload: {
    project: number;
    kind: OutcomeKind;
    description: string;
    observed_on?: string | null;
    evidence?: string;
  }): Promise<ProjectOutcome> => {
    const { data } = await apiClient.post("/api/outputs/outcomes/", payload);
    return data;
  },
  getExpectedOutputs: async (params: { project?: number } = {}): Promise<ExpectedOutput[]> => {
    const { data } = await apiClient.get("/api/outputs/expected-outputs/", { params });
    return data;
  },
  createExpectedOutput: async (payload: {
    project: number;
    category: SixPCategory;
    description: string;
    target_count: number;
    manual_actual_count?: number;
  }): Promise<ExpectedOutput> => {
    const { data } = await apiClient.post("/api/outputs/expected-outputs/", payload);
    return data;
  },
  updateExpectedOutput: async (
    id: number,
    payload: Partial<{ description: string; target_count: number; manual_actual_count: number }>,
  ): Promise<ExpectedOutput> => {
    const { data } = await apiClient.patch(`/api/outputs/expected-outputs/${id}/`, payload);
    return data;
  },
  deleteExpectedOutput: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/outputs/expected-outputs/${id}/`);
  },
  getSensePublishers: async (): Promise<SenseRankedPublisher[]> => {
    const { data } = await apiClient.get("/api/outputs/sense-publishers/");
    return data;
  },
  createSensePublisher: async (name: string): Promise<SenseRankedPublisher> => {
    const { data } = await apiClient.post("/api/outputs/sense-publishers/", { name });
    return data;
  },

  getPublications: async (params: { project?: number; study?: number } = {}): Promise<PublicationRecord[]> => {
    const { data } = await apiClient.get("/api/outputs/publications/", { params });
    return data;
  },
  createPublication: async (payload: {
    project: number;
    study?: number | null;
    lead_author: number;
    title: string;
    publication_type: PublicationType;
    indexing_tier?: IndexingTier;
    impact_factor?: string;
    h_index?: string;
    sense_publisher?: number | null;
    has_isbn?: boolean;
    is_lspu_published?: boolean;
    is_thesis_derived?: boolean;
    is_supervised_approved_thesis?: boolean;
    publisher_name?: string;
    doi_or_isbn?: string;
    published_on: string;
  }): Promise<PublicationRecord> => {
    const { data } = await apiClient.post("/api/outputs/publications/", payload);
    return data;
  },

  getIPRecords: async (params: { project?: number; study?: number } = {}): Promise<IPRecord[]> => {
    const { data } = await apiClient.get("/api/outputs/ip-records/", { params });
    return data;
  },
  createIPRecord: async (payload: {
    project: number;
    study?: number | null;
    creator: number;
    co_creators?: string;
    title: string;
    ip_type: IPType;
    trl?: number;
    is_commercialization_intended?: boolean;
    is_adopted_by_community?: boolean;
    adoption_moa_reference?: string;
    registration_number?: string;
    registered_on?: string;
  }): Promise<IPRecord> => {
    const { data } = await apiClient.post("/api/outputs/ip-records/", payload);
    return data;
  },
  updateIPRecord: async (
    id: number,
    payload: Partial<{
      status: IPStatus;
      incentive_claimed: boolean;
      registration_number: string;
      registered_on: string;
    }>,
  ): Promise<IPRecord> => {
    const { data } = await apiClient.patch(`/api/outputs/ip-records/${id}/`, payload);
    return data;
  },

  getCreativeWorks: async (params: { project?: number } = {}): Promise<CreativeWorkRecord[]> => {
    const { data } = await apiClient.get("/api/outputs/creative-works/", { params });
    return data;
  },
  createCreativeWork: async (payload: {
    project?: number | null;
    creator: number;
    title: string;
    work_type: string;
    description?: string;
    date_created: string;
    rights_holder?: string;
  }): Promise<CreativeWorkRecord> => {
    const { data } = await apiClient.post("/api/outputs/creative-works/", payload);
    return data;
  },
  updateCreativeWork: async (
    id: number,
    payload: Partial<{ is_registered: boolean; rights_holder: string }>,
  ): Promise<CreativeWorkRecord> => {
    const { data } = await apiClient.patch(`/api/outputs/creative-works/${id}/`, payload);
    return data;
  },
};
