import { apiClient } from "./apiClient";
import { errorMessage } from "./errorMessage";
import { notify } from "./notify";
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
  /** Upload before the project exists (Register Approved Project); the token is traded for a Document later. */
  stageDocument: async (file: File, onProgress: (percent: number) => void, documentType?: DocumentType): Promise<{ staged_token: string }> => {
    const form = new FormData();
    form.append("file", file);
    if (documentType) form.append("document_type", documentType);
    const { data } = await apiClient.post("/api/documents/documents/staged/", form, {
      onUploadProgress: (e) => e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
    });
    return data;
  },
  /** Task 13: a short-lived signed URL of the user's own staged upload, for View before Register. */
  stagedFileUrl: async (staged_token: string): Promise<string> => {
    const { data } = await apiClient.post("/api/documents/documents/staged-url/", { staged_token });
    return data.url;
  },
  registerStagedDocument: async (payload: { project: number; document_type: DocumentType; stage?: DocumentStage; staged_token: string }): Promise<ProjectDocument> => {
    const { data } = await apiClient.post("/api/documents/documents/", payload);
    return data;
  },
  /** Saves the project's Research Proposal Form (SF-018) as a PDF document; Register Project calls it last. */
  saveProposalForm: async (project: number): Promise<ProjectDocument> => {
    const { data } = await apiClient.post("/api/documents/documents/proposal-form/", { project });
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

/** Mirrors ALLOWED_FILE_TYPES in document_management/serializers.py (= the Supabase bucket's allowed MIME types). */
export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";
/** Task 19: Approve Proposal, NTP and MOA are PDF only (the backend also checks the file's content). */
export const PDF_ACCEPT = ".pdf,application/pdf";

// Task 13: View opens the file through a short-lived URL. The tab is opened before the request so the browser doesn't
// block it as a pop-up; a PDF shows in it, Word and Excel files download.
export async function openDocument(getUrl: () => Promise<string>, failure = "Could not open the file.") {
  const tab = window.open("", "_blank");
  try {
    const url = await getUrl();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.open(url, "_blank", "noopener");
    }
  } catch (err) {
    tab?.close();
    // an axios error carries the server's reason (errorMessage); a thrown Error (documentUrl) its own message
    const own = err instanceof Error && !("response" in err) ? err.message : "";
    notify.error(errorMessage(err, own || failure));
  }
}

/** A saved document's fresh signed URL; a missing or unreachable file is an error, not a broken tab. */
export async function documentUrl(id: number): Promise<string> {
  const full = await documentApi.getDocument(id);
  if (!full.download_url) throw new Error("This file is missing or can't be opened right now.");
  return full.download_url;
}
