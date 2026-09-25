import type { IndexingTier, IPStatus, IPType, PublicationType, SixPCategory } from "../types/outputs";

export type OutputFamily = "publication" | "ip" | "technology" | "partnership" | "outcome_impact";

export const FAMILY_META: Record<OutputFamily, { label: string; icon: string; color: string; bg: string }> = {
  publication: { label: "Publications", icon: "📄", color: "#0d2a5e", bg: "#e0eaf7" },
  ip: { label: "Intellectual Property", icon: "🔏", color: "#6b21a8", bg: "#faf5ff" },
  technology: { label: "Technologies", icon: "⚙️", color: "#0891b2", bg: "#e0f2fe" },
  partnership: { label: "Partnerships", icon: "🤝", color: "#92400e", bg: "#fef3c7" },
  outcome_impact: { label: "Outcomes & Impacts", icon: "🌱", color: "#166534", bg: "#d1fae5" },
};

export const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  journal_article: "Journal Article",
  book: "Book",
  book_chapter: "Book Chapter",
  conference_proceeding: "Conference Proceeding",
  instructional_material: "Instructional Material",
};

export const INDEXING_LABELS: Record<Exclude<IndexingTier, "">, string> = {
  isi: "ISI-indexed",
  scopus: "Scopus-indexed",
  lspu_refereed: "LSPU Refereed Journal",
  non_indexed: "Not Indexed",
};

export const IP_TYPE_LABELS: Record<IPType, string> = {
  patent: "Patent",
  utility_model: "Utility Model",
  industrial_design: "Industrial Design",
  trademark: "Trademark",
};

export const IP_STATUS_LABELS: Record<IPStatus, string> = {
  disclosed: "Disclosed",
  filed: "Filed",
  registered: "Registered",
  adopted: "Adopted by Community",
};

export const SIX_P_META: Record<SixPCategory, { label: string; icon: string; computed: boolean }> = {
  publications: { label: "Publications", icon: "📄", computed: true },
  patents: { label: "Patents / IP", icon: "🔏", computed: true },
  products: { label: "Products", icon: "⚙️", computed: false },
  people_services: { label: "People Services", icon: "👥", computed: false },
  places_partnerships: { label: "Places and Partnerships", icon: "🤝", computed: false },
  policies: { label: "Policies", icon: "🏛", computed: false },
};
