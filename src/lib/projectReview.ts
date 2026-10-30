import type { BudgetReview, FinanceEditRow, LineItem, LineItemBudget } from "../types/budget";
import type { Lead, ReviewStatus } from "../types/research";
import { nameOf } from "./workplan";

/** Client 2026-10-24 (Figma ProjectReviewWorkflow): the project's review status, read from its LIB by the backend
 * (research_projects/workflow.py). Badge classes follow the prototype's STATUS_STYLE. */
// Task 17 (2026-10-30): one colour per status, Active green; the label is always shown, so colour is never the only cue
export const REVIEW_STATUS_STYLE: Record<ReviewStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-300",
  submitted: "bg-blue-50 text-blue-700 ring-blue-200",
  pending_research_review: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  returned_research: "bg-amber-50 text-amber-800 ring-amber-200",
  for_budget_review: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  pending_budget_review: "bg-violet-50 text-violet-700 ring-violet-200",
  returned_budget: "bg-orange-50 text-orange-800 ring-orange-200",
  reviews_completed: "bg-green-100 text-green-800 ring-green-300",
};

// The client's labels (Task 17), the same as the backend's review_status_label
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_research_review: "Ongoing Review - CRC/CRD",
  returned_research: "Returned for Revision - CRC/CRD",
  for_budget_review: "For Budget Review",
  pending_budget_review: "Ongoing Review - Budget",
  returned_budget: "Returned Review - Budget",
  reviews_completed: "Active",
};

// What each status means (Task 17), shown with the status filter on every Project Management dashboard
export const REVIEW_STATUS_MEANINGS: Record<ReviewStatus, string> = {
  draft: "Saved by the Project Leader but not submitted; not visible to CRC/CRD or Finance/Accounting/Budget.",
  submitted: "The Project Leader has submitted the proposal and it is awaiting CRC/CRD review.",
  pending_research_review: "CRC/CRD is currently reviewing the proposal.",
  returned_research: "CRC/CRD returned the proposal to the Project Leader for correction.",
  for_budget_review: "CRC/CRD has forwarded the proposal to Finance/Accounting/Budget.",
  pending_budget_review: "Finance/Accounting/Budget is currently reviewing the proposal for approval and certification.",
  returned_budget: "Finance/Accounting/Budget returned the proposal for the appropriate corrections or review action.",
  reviews_completed: "Finance/Accounting/Budget has approved and certified the proposal; it is available to the Project Leader for the next project-management activities.",
};

export function reviewQueues(projects: { review_status: ReviewStatus }[]) {
  const count = (...statuses: ReviewStatus[]) => projects.filter((p) => statuses.includes(p.review_status)).length;
  return {
    research: count("submitted", "pending_research_review"),
    budget: count("for_budget_review", "pending_budget_review"),
    returned: count("returned_research", "returned_budget"),
    completed: count("reviews_completed"),
  };
}

const CRC = "CRC/CRD";
const BUDGET = "Budget Officer";
const LEADER = "Project Leader";

/** Who holds the project now: the Project Leader (Draft, returned, completed), else the reviewer who started that
 * level's review, or the level's role before anyone has. */
export function assignedReviewer(status: ReviewStatus, project: { lead_detail: Lead }, reviews: BudgetReview[]) {
  const last = (action: BudgetReview["action"]) => [...reviews].reverse().find((r) => r.action === action)?.acted_by_name;
  if (status === "submitted") return { name: CRC, role: CRC };
  if (status === "pending_research_review") return { name: last("review_started") ?? CRC, role: CRC };
  if (status === "for_budget_review") return { name: BUDGET, role: BUDGET };
  if (status === "pending_budget_review") return { name: last("certification_started") ?? BUDGET, role: BUDGET };
  return { name: nameOf(project.lead_detail), role: LEADER };
}

const ACTION_META: Record<BudgetReview["action"], { action: string; role: string; to: ReviewStatus | null }> = {
  submitted: { action: "Project proposal submitted", role: LEADER, to: "submitted" },
  resubmitted: { action: "Revisions resubmitted", role: LEADER, to: "submitted" },
  review_started: { action: "Research review started", role: CRC, to: "pending_research_review" },
  for_checking: { action: "Marked For Checking", role: CRC, to: "pending_research_review" },
  ready: { action: "Research review completed · forwarded to Budget", role: CRC, to: "for_budget_review" },
  endorsed: { action: "Research review completed · forwarded to Budget", role: CRC, to: "for_budget_review" },
  certification_started: { action: "Budget review started", role: BUDGET, to: "pending_budget_review" },
  certified: { action: "Budget review completed · LIB certified", role: BUDGET, to: "reviews_completed" },
  held_crc: { action: "Returned for revision", role: CRC, to: "returned_research" },
  held_budget: { action: "Returned for revision", role: BUDGET, to: "returned_budget" },
  returned: { action: "Returned for revision", role: CRC, to: "returned_research" },
  commented: { action: "Budget review comment", role: BUDGET, to: null },
};

/** The LIB's review steps as the prototype's Transaction history, newest first. */
export function reviewHistory(reviews: BudgetReview[]) {
  return [...reviews].reverse().map((r) => ({
    id: r.id,
    action: ACTION_META[r.action].action,
    actor: r.acted_by_name,
    actorRole: ACTION_META[r.action].role,
    at: r.acted_at,
    toStatus: ACTION_META[r.action].to ? REVIEW_STATUS_LABELS[ACTION_META[r.action].to!] : "Status unchanged",
    comments: r.remarks,
  }));
}

/** The Project Leader's button, or null when it isn't theirs to act. */
export function leaderSubmitLabel(status: ReviewStatus) {
  if (status === "draft") return "Submit Project Proposal";
  if (status === "returned_research") return "Resubmit Research Revisions";
  if (status === "returned_budget") return "Resubmit Budget Revisions";
  return null;
}

/** The registration (details, team, work plan) can change only while the project is a Draft or returned
 * (backend EDITABLE_REVIEW_STATUSES, ensure_registration_open). */
export const registrationOpen = (status: ReviewStatus) => status === "draft" || status === "returned_research" || status === "returned_budget";

/** Task 16 (2026-10-30): what a Project Management row offers. The project's own Project Leader (and the System Admin)
 * edits a Draft or a returned proposal and deletes only a Draft (the backend refuses the rest too). The leader opens
 * the review on a Draft, a returned proposal or an Active one, not while it is with a reviewer; other roles always can. */
export function rowActions(status: ReviewStatus, viewer: { isOwnLeader: boolean; isAdmin: boolean }) {
  const owner = viewer.isOwnLeader || viewer.isAdmin;
  return {
    edit: owner && registrationOpen(status),
    remove: owner && status === "draft",
    openReview: viewer.isAdmin || !viewer.isOwnLeader || registrationOpen(status) || status === "reviews_completed",
  };
}

// Task 16 (2026-10-30): the review list shows five proposals a page, the latest registered first
export const REVIEW_PAGE_SIZE = 5;

export const newestFirst = <T extends { id: number; created_at: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);

/** Search over what the list shows: code, title, Project Leader and campus. The list is already the user's own scope. */
export function matchesProjectSearch(
  p: { project_code: string; title: string; campus?: string | null; lead_detail?: { email: string; full_name?: string | null } | null },
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.project_code, p.title, p.campus, p.lead_detail?.full_name, p.lead_detail?.email].some((v) => (v ?? "").toLowerCase().includes(q));
}

/** Work on the project (tasks etc.) starts once its reviews are completed (backend ensure_work_allowed, decision D5). */
export const workAllowed = (status: ReviewStatus) => status === "reviews_completed";

/** The backend's refusal for work on such a project, shown before anyone tries. */
export const workLockedMessage = (label: string) =>
  `This project is ${label}. Work on it starts once its reviews are completed (the Budget Officer certifies its LIB).`;

/** The project's current LIB (the one its review status is read from). */
export const currentLib = (budgets: LineItemBudget[], project: number) =>
  budgets.filter((b) => b.project === project && b.is_current).sort((a, b) => b.version_number - a.version_number)[0];

/** Task 20: one item's Update This LIB form (strings as typed). */
export type UpdateDraft = { specification: string; unit: string; quantity: string; unit_cost: string; split: Record<string, string>; reason: string };

/** The changed fields of one item as POST finance-edit/ wants them, or null when nothing changed (Task 20). */
export function financeEditRow(item: LineItem, draft: UpdateDraft, periods: string[]): FinanceEditRow | null {
  const row: FinanceEditRow = { id: item.id, reason: draft.reason.trim() };
  if (draft.specification.trim() !== item.specification) row.specification = draft.specification.trim();
  if (draft.unit !== item.unit) row.unit = draft.unit;
  if (Number(draft.quantity) !== Number(item.quantity)) row.quantity = draft.quantity;
  if (Number(draft.unit_cost) !== Number(item.unit_cost)) row.unit_cost = draft.unit_cost;
  const old = Object.fromEntries(item.allocations.map((a) => [a.period, Number(a.amount)]));
  if (row.quantity !== undefined || row.unit_cost !== undefined || periods.some((p) => Number(draft.split[p] || 0) !== (old[p] ?? 0))) {
    row.allocations = periods.map((p) => ({ period: p, amount: String(Number(draft.split[p] || 0)) }));
  }
  return Object.keys(row).length > 2 ? row : null;
}

