import type { RecordStatus, ReviewStatus } from "../types/research";

export const PROJECT_STATUS_LABELS: Record<RecordStatus, string> = {
  active: "Ongoing",
  completed: "Completed",
  archived: "Closed",
};

export const PROJECT_STATUS_STYLE: Record<RecordStatus, { bg: string; text: string; dot: string }> = {
  active: { bg: "#ecfeff", text: "#164e63", dot: "#0891b2" },
  completed: { bg: "#f0fdf4", text: "#14532d", dot: "#16a34a" },
  archived: { bg: "#f8fafc", text: "#334155", dot: "#64748b" },
};

// Task 62 (client 2026-11-16): a project is Ongoing only once Finance/Accounting/Budget certified its LIB (review
// status Active). These four review statuses are "For Approval"; Draft, Submitted and Returned - CRC/CRD are counted
// in neither.
export const FOR_APPROVAL_STATUSES: readonly ReviewStatus[] = [
  "for_budget_review",
  "pending_research_review",
  "pending_budget_review",
  "returned_budget",
];

export type SummaryGroup = "for_approval" | RecordStatus;

export const SUMMARY_GROUPS: readonly SummaryGroup[] = ["for_approval", "active", "completed", "archived"];

export const SUMMARY_LABELS: Record<SummaryGroup, string> = { for_approval: "For Approval", ...PROJECT_STATUS_LABELS };

export const SUMMARY_STYLE: Record<SummaryGroup, { bg: string; text: string; dot: string }> = {
  for_approval: { bg: "#fffbeb", text: "#92400e", dot: "#d97706" },
  ...PROJECT_STATUS_STYLE,
};

export function summaryGroup(p: { status: RecordStatus; review_status: ReviewStatus }): SummaryGroup | null {
  if (p.status !== "active") return p.status;
  if (p.review_status === "reviews_completed") return "active";
  return FOR_APPROVAL_STATUSES.includes(p.review_status) ? "for_approval" : null;
}

/** True when the lifecycle badge (Ongoing/Completed/Closed) applies; otherwise only the review status is shown. */
export const showsLifecycle = (p: { status: RecordStatus; review_status: ReviewStatus }) => {
  const g = summaryGroup(p);
  return g !== null && g !== "for_approval";
};
