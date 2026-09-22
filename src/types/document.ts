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

export interface ProjectDocument {
  id: number;
  project: number;
  study: number | null;
  document_type: DocumentType;
  stage: DocumentStage;
  version_number: number;
  is_current: boolean;
  file_name: string;
  file_size: number;
  content_type: string;
  is_archived: boolean;
  retention_until: string;
  uploaded_by: number;
  uploaded_at: string;
  download_url?: string;
}
