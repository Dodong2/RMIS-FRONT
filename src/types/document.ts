export type DocumentType =
  | "toe"
  | "lib"
  | "work_plan"
  | "midterm_report"
  | "terminal_report"
  | "accomplishment_report"
  | "thesis"
  | "dissertation"
  | "dataset"
  | "manuscript"
  | "other";

export type DocumentStage = "inception" | "midterm" | "terminal" | "post_completion" | "";

export type DocumentSensitivity = "project_team" | "financial" | "restricted";
export type DocumentReviewStatus = "pending" | "approved" | "returned";

export interface ProjectDocument {
  id: number;
  project: number;
  study: number | null;
  document_type: DocumentType;
  stage: DocumentStage;
  sensitivity: DocumentSensitivity;
  version_number: number;
  is_current: boolean;
  review_status: DocumentReviewStatus;
  review_remarks: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  file_name: string;
  file_size: number;
  content_type: string;
  is_archived: boolean;
  retention_until: string;
  uploaded_by: number;
  uploaded_at: string;
  download_url?: string;
}

export interface DocumentShare {
  id: number;
  document: number;
  user: number;
  user_email: string;
  user_role: string;
  reason: string;
  expires_on: string;
  granted_by: number;
  granted_by_email: string;
  granted_at: string;
  revoked_by: number | null;
  revoked_at: string | null;
  is_active: boolean;
}
