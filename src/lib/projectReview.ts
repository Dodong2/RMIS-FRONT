import type { BudgetReview, LineItemBudget } from "../types/budget";
import type { Lead, ReviewStatus } from "../types/research";
import { nameOf } from "./workplan";

/** Client 2026-10-24 (Figma ProjectReviewWorkflow): the project's review status, read from its LIB by the backend
 * (research_projects/workflow.py). Badge classes follow the prototype's STATUS_STYLE. */
export const REVIEW_STATUS_STYLE: Record<ReviewStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  submitted: "bg-blue-50 text-blue-700 ring-blue-200",
  pending_research_review: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  returned_research: "bg-amber-50 text-amber-700 ring-amber-200",
  pending_budget_review: "bg-violet-50 text-violet-700 ring-violet-200",
  returned_budget: "bg-orange-50 text-orange-700 ring-orange-200",
  reviews_completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_research_review: "Pending Research Review",
  returned_research: "Returned for Revision – Research",
  pending_budget_review: "Pending Budget Review",
  returned_budget: "Returned for Revision – Budget",
  reviews_completed: "Reviews Completed",
};

export function reviewQueues(projects: { review_status: ReviewStatus }[]) {
  const count = (...statuses: ReviewStatus[]) => projects.filter((p) => statuses.includes(p.review_status)).length;
  return {
    research: count("submitted", "pending_research_review"),
    budget: count("pending_budget_review"),
    returned: count("returned_research", "returned_budget"),
    completed: count("reviews_completed"),
  };
}

const CRC = "CRC Chairperson";
const BUDGET = "Budget Officer";
const LEADER = "Project Leader";

/** Who holds the project now: the Project Leader (Draft, returned, completed), else the reviewer who started that
 * level's review, or the level's role before anyone has. */
export function assignedReviewer(status: ReviewStatus, project: { lead_detail: Lead }, reviews: BudgetReview[]) {
  const last = (action: BudgetReview["action"]) => [...reviews].reverse().find((r) => r.action === action)?.acted_by_name;
  if (status === "submitted") return { name: CRC, role: CRC };
  if (status === "pending_research_review") return { name: last("review_started") ?? CRC, role: CRC };
  if (status === "pending_budget_review") return { name: last("certification_started") ?? BUDGET, role: BUDGET };
  return { name: nameOf(project.lead_detail), role: LEADER };
}

const ACTION_META: Record<BudgetReview["action"], { action: string; role: string; to: ReviewStatus }> = {
  submitted: { action: "Project proposal submitted", role: LEADER, to: "submitted" },
  resubmitted: { action: "Revisions resubmitted", role: LEADER, to: "submitted" },
  review_started: { action: "Research review started", role: CRC, to: "pending_research_review" },
  for_checking: { action: "Marked For Checking", role: CRC, to: "pending_research_review" },
  ready: { action: "Research review completed", role: CRC, to: "pending_budget_review" },
  endorsed: { action: "Research review completed", role: CRC, to: "pending_budget_review" },
  certification_started: { action: "Budget review started", role: BUDGET, to: "pending_budget_review" },
  certified: { action: "Budget review completed · LIB certified", role: BUDGET, to: "reviews_completed" },
  held_crc: { action: "Returned for revision", role: CRC, to: "returned_research" },
  held_budget: { action: "Returned for revision", role: BUDGET, to: "returned_budget" },
  returned: { action: "Returned for revision", role: CRC, to: "returned_research" },
};

/** The LIB's review steps as the prototype's Transaction history, newest first. */
export function reviewHistory(reviews: BudgetReview[]) {
  return [...reviews].reverse().map((r) => ({
    id: r.id,
    action: ACTION_META[r.action].action,
    actor: r.acted_by_name,
    actorRole: ACTION_META[r.action].role,
    at: r.acted_at,
    toStatus: REVIEW_STATUS_LABELS[ACTION_META[r.action].to],
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

/** Work on the project (tasks etc.) starts once its reviews are completed (backend ensure_work_allowed, decision D5). */
export const workAllowed = (status: ReviewStatus) => status === "reviews_completed";

/** The backend's refusal for work on such a project, shown before anyone tries. */
export const workLockedMessage = (label: string) =>
  `This project is ${label}. Work on it starts once its reviews are completed (the Budget Officer certifies its LIB).`;

/** The project's current LIB (the one its review status is read from). */
export const currentLib = (budgets: LineItemBudget[], project: number) =>
  budgets.filter((b) => b.project === project && b.is_current).sort((a, b) => b.version_number - a.version_number)[0];
