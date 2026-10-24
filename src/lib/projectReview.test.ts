import { describe, expect, it } from "vitest";
import { assignedReviewer, leaderSubmitLabel, registrationOpen, reviewHistory, reviewQueues, workAllowed } from "./projectReview";
import type { BudgetReview } from "../types/budget";

const review = (id: number, action: BudgetReview["action"], by = "Ana Cruz", remarks = ""): BudgetReview => ({
  id, action, remarks, snapshot: [], acted_by: id, acted_by_name: by, acted_at: `2026-10-2${id}T09:30:00+08:00`,
});

describe("reviewQueues", () => {
  it("counts the research queue, budget queue, returned and completed projects", () => {
    const statuses = ["submitted", "pending_research_review", "pending_budget_review", "returned_research", "returned_budget", "reviews_completed", "draft"] as const;
    expect(reviewQueues(statuses.map((review_status) => ({ review_status })))).toEqual({ research: 2, budget: 1, returned: 2, completed: 1 });
  });
});

describe("assignedReviewer", () => {
  const project = { lead_detail: { id: 1, email: "pl@lspu.test", full_name: "Dr. Herminia Ramos" } };

  it("is the Project Leader while the project is a Draft or returned", () => {
    expect(assignedReviewer("draft", project, [])).toEqual({ name: "Dr. Herminia Ramos", role: "Project Leader" });
    expect(assignedReviewer("returned_budget", project, [])).toEqual({ name: "Dr. Herminia Ramos", role: "Project Leader" });
  });

  it("is whoever took the review step, or the reviewing role before anyone has", () => {
    expect(assignedReviewer("submitted", project, [review(1, "submitted", "Dr. Herminia Ramos")])).toEqual({ name: "CRC Chairperson", role: "CRC Chairperson" });
    expect(assignedReviewer("pending_research_review", project, [review(1, "submitted"), review(2, "review_started", "Engr. Cruz")]))
      .toEqual({ name: "Engr. Cruz", role: "CRC Chairperson" });
    expect(assignedReviewer("pending_budget_review", project, [review(3, "ready", "Engr. Cruz")])).toEqual({ name: "Budget Officer", role: "Budget Officer" });
  });
});

describe("reviewHistory", () => {
  it("lists the LIB's review steps newest first, with the actor's role and the status it led to", () => {
    const events = reviewHistory([review(1, "submitted", "PL"), review(2, "held_crc", "CRC", "Clarify the methodology")]);

    expect(events.map((e) => [e.action, e.actor, e.actorRole, e.toStatus, e.comments])).toEqual([
      ["Returned for revision", "CRC", "CRC Chairperson", "Returned for Revision – Research", "Clarify the methodology"],
      ["Project proposal submitted", "PL", "Project Leader", "Submitted", ""],
    ]);
  });
});

describe("leaderSubmitLabel", () => {
  it("names the submit or resubmit like the prototype", () => {
    expect(leaderSubmitLabel("draft")).toBe("Submit Project Proposal");
    expect(leaderSubmitLabel("returned_research")).toBe("Resubmit Research Revisions");
    expect(leaderSubmitLabel("returned_budget")).toBe("Resubmit Budget Revisions");
    expect(leaderSubmitLabel("pending_research_review")).toBeNull();
  });
});

describe("registrationOpen / workAllowed", () => {
  const all = ["draft", "submitted", "pending_research_review", "returned_research", "pending_budget_review", "returned_budget", "reviews_completed"] as const;

  it("opens the registration only for a Draft or a returned project", () => {
    expect(all.filter(registrationOpen)).toEqual(["draft", "returned_research", "returned_budget"]);
  });

  it("allows work only once the reviews are completed", () => {
    expect(all.filter(workAllowed)).toEqual(["reviews_completed"]);
  });
});
