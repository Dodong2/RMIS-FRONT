import { apiClient } from "./apiClient";
import type { DocumentStage, DocumentType, ProjectDocument } from "../types/document";

export const documentApi = {
  getDocuments: async (
    params: {
      project?: number;
      study?: number;
      document_type?: DocumentType;
      stage?: DocumentStage;
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
    file: File;
  }): Promise<ProjectDocument> => {
    const form = new FormData();
    form.append("project", String(payload.project));
    if (payload.study) form.append("study", String(payload.study));
    form.append("document_type", payload.document_type);
    if (payload.stage) form.append("stage", payload.stage);
    form.append("file", payload.file);
    const { data } = await apiClient.post("/api/documents/documents/", form);
    return data;
  },
  archiveDocument: async (id: number): Promise<ProjectDocument> => {
    const { data } = await apiClient.post(`/api/documents/documents/${id}/archive/`);
    return data;
  },
};
