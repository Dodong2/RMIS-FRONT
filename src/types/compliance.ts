export type EthicsReviewBody = "trc" | "ethics_review_board" | "iacuc";
export type EthicsReviewStatus = "pending" | "approved" | "conditional" | "revision_required" | "rejected";

export interface EthicsReviewReference {
  id: number;
  project: number;
  study: number | null;
  review_body: EthicsReviewBody;
  reference_number: string;
  status: EthicsReviewStatus;
  decision_date: string | null;
  remarks: string;
  recorded_by: number;
  created_at: string;
}

export type SimilarityDocumentType = "published_article" | "thesis_dissertation" | "other";

export interface SimilarityCheckRecord {
  id: number;
  project: number;
  study: number | null;
  document_type: SimilarityDocumentType;
  document_title: string;
  similarity_index: string;
  is_within_threshold: boolean;
  software_used: string;
  checked_on: string;
  recorded_by: number;
  created_at: string;
}

export interface AIUseDeclaration {
  id: number;
  project: number;
  study: number | null;
  declared_by: number;
  tool_name: string;
  purpose: string;
  extent: string;
  declared_on: string;
  created_at: string;
}

export type COIStatus = "disclosed" | "under_review" | "resolved";

export interface ConflictOfInterestDisclosure {
  id: number;
  project: number;
  discloser: number;
  description: string;
  mitigation_measures: string;
  status: COIStatus;
  disclosed_on: string;
  recorded_by: number;
  created_at: string;
}

export type MisconductCaseType = "plagiarism" | "fabrication" | "falsification" | "other";
export type MisconductCaseStatus = "reported" | "under_investigation" | "upheld" | "dismissed";

export interface MisconductCaseReference {
  id: number;
  project: number | null;
  subject: number | null;
  subject_name: string;
  case_type: MisconductCaseType;
  referred_to: string;
  status: MisconductCaseStatus;
  remarks: string;
  reported_by: number;
  reported_on: string;
  resolved_on: string | null;
  created_at: string;
}
