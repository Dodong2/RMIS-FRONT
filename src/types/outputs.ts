export type PublicationType =
  | "journal_article"
  | "book"
  | "book_chapter"
  | "conference_proceeding"
  | "instructional_material";

export type IndexingTier = "isi" | "scopus" | "lspu_refereed" | "non_indexed" | "";

export interface SenseRankedPublisher {
  id: number;
  name: string;
  created_at: string;
}

export interface PublicationRecord {
  id: number;
  project: number;
  study: number | null;
  lead_author: number;
  title: string;
  publication_type: PublicationType;
  indexing_tier: IndexingTier;
  impact_factor: string | null;
  h_index: string | null;
  sense_publisher: number | null;
  has_isbn: boolean;
  is_lspu_published: boolean;
  is_thesis_derived: boolean;
  is_supervised_approved_thesis: boolean;
  publisher_name: string;
  doi_or_isbn: string;
  published_on: string;
  estimated_incentive: number | null;
  recorded_by: number;
  created_at: string;
}

export type IPType = "patent" | "utility_model" | "industrial_design" | "trademark";
export type IPStatus = "disclosed" | "filed" | "registered" | "adopted";

export interface IPRecord {
  id: number;
  project: number;
  study: number | null;
  creator: number;
  co_creators: string;
  title: string;
  ip_type: IPType;
  status: IPStatus;
  trl: number | null;
  is_commercialization_intended: boolean;
  is_adopted_by_community: boolean;
  adoption_moa_reference: string;
  registration_number: string;
  registered_on: string | null;
  incentive_claimed: boolean;
  incentive_eligible: boolean;
  recorded_by: number;
  created_at: string;
}

export interface CreativeWorkRecord {
  id: number;
  project: number | null;
  creator: number;
  title: string;
  work_type: string;
  description: string;
  date_created: string;
  is_registered: boolean;
  rights_holder: string;
  recorded_by: number;
  created_at: string;
}

export type SixPCategory =
  | "publications"
  | "patents"
  | "products"
  | "people_services"
  | "places_partnerships"
  | "policies";

export interface ExpectedOutput {
  id: number;
  project: number;
  category: SixPCategory;
  description: string;
  target_count: number;
  manual_actual_count: number;
  actual_count: number;
  created_at: string;
}

export interface ExpectedVsActual {
  project: number;
  by_category: { category: SixPCategory; label: string; target: number; actual: number; met: boolean }[];
  expected_outputs: ExpectedOutput[];
}

export type OutcomeKind = "outcome" | "impact";

export interface ProjectOutcome {
  id: number;
  project: number;
  kind: OutcomeKind;
  description: string;
  observed_on: string | null;
  evidence: string;
  recorded_by: number;
  created_at: string;
}
