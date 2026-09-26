import { apiClient } from "./apiClient";
import type {
  DocumentReviewStatus,
  DocumentSensitivity,
  DocumentShare,
  DocumentStage,
  DocumentType,
  ProjectDocument,
} from "../types/document";

export const documentApi = {
  getDocuments: async (
    params: {
      project?: number;
      study?: number;
      document_type?: DocumentType;
      stage?: DocumentStage;
      review_status?: DocumentReviewStatus;
      current_only?: boolean;
    } = {},
  ): Promise<ProjectDocument[]> => {
    const { current_only, ...rest } = params;
    const { data } = await apiClient.get("/api/documents/documents/", {
      params: { ...rest, ...(current_only ? { current_only: "true" } : {}) },
    });
    return data;
  },
  getDocument: async (id: number): Promise<ProjectDocument> => {
    const { data } = await apiClient.get(`/api/documents/documents/${id}/`);
    return data;
  },
  uploadDocument: async (payload: {
    project: number;
    study?: number | null;
    document_type: DocumentType;
    stage?: DocumentStage;
    sensitivity?: DocumentSensitivity;
    file: File;
  }): Promise<ProjectDocument> => {
    const form = new FormData();
    form.append("project", String(payload.project));
    if (payload.study) form.append("study", String(payload.study));
    form.append("document_type", payload.document_type);
    if (payload.stage) form.append("stage", payload.stage);
    if (payload.sensitivity) form.append("sensitivity", payload.sensitivity);
    form.append("file", payload.file);
    const { data } = await apiClient.post("/api/documents/documents/", form);
    return data;
  },
  archiveDocument: async (id: number): Promise<ProjectDocument> => {
    const { data } = await apiClient.post(`/api/documents/documents/${id}/archive/`);
    return data;
  },
  reviewDocument: async (id: number, review_status: "approved" | "returned", review_remarks: string): Promise<ProjectDocument> => {
    const { data } = await apiClient.post(`/api/documents/documents/${id}/review/`, { review_status, review_remarks });
    return data;
  },
  getShares: async (id: number): Promise<DocumentShare[]> => {
    const { data } = await apiClient.get(`/api/documents/documents/${id}/shares/`);
    return data;
  },
  createShare: async (id: number, payload: { user: number; expires_on: string; reason?: string }): Promise<DocumentShare> => {
    const { data } = await apiClient.post(`/api/documents/documents/${id}/shares/`, payload);
    return data;
  },
  revokeShare: async (shareId: number): Promise<DocumentShare> => {
    const { data } = await apiClient.post(`/api/documents/documents/shares/${shareId}/revoke/`);
    return data;
  },
};
