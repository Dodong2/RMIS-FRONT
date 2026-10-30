import { describe, expect, it } from "vitest";
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_MEANINGS, REVIEW_STATUS_STYLE, assignedReviewer, leaderSubmitLabel, registrationOpen, reviewHistory, reviewQueues, workAllowed, workLockedMessage, rowActions, newestFirst, matchesProjectSearch, REVIEW_PAGE_SIZE, financeEditRow, editChangeLines } from "./projectReview";
import type { BudgetReview, LineItem, LineItemEdit } from "../types/budget";
import { pageOf } from "./paging";

const review = (id: number, action: BudgetReview["action"], by = "Ana Cruz", remarks = ""): BudgetReview => ({
  id, action, remarks, snapshot: [], acted_by: id, acted_by_name: by, acted_at: `2026-10-2${id}T09:30:00+08:00`,
});

describe("reviewQueues", () => {
  it("counts the research queue, budget queue, returned and completed projects", () => {
    const statuses = ["submitted", "pending_research_review", "for_budget_review", "pending_budget_review", "returned_research", "returned_budget", "reviews_completed", "draft"] as const;
    expect(reviewQueues(statuses.map((review_status) => ({ review_status })))).toEqual({ research: 2, budget: 2, returned: 2, completed: 1 });
  });
});

describe("assignedReviewer", () => {
  const project = { lead_detail: { id: 1, email: "pl@lspu.test", full_name: "Dr. Herminia Ramos" } };

  it("is the Project Leader while the project is a Draft or returned", () => {
    expect(assignedReviewer("draft", project, [])).toEqual({ name: "Dr. Herminia Ramos", role: "Project Leader" });
    expect(assignedReviewer("returned_budget", project, [])).toEqual({ name: "Dr. Herminia Ramos", role: "Project Leader" });
  });

  it("is whoever took the review step, or the reviewing role before anyone has", () => {
    expect(assignedReviewer("submitted", project, [review(1, "submitted", "Dr. Herminia Ramos")])).toEqual({ name: "CRC/CRD", role: "CRC/CRD" });
    expect(assignedReviewer("pending_research_review", project, [review(1, "submitted"), review(2, "review_started", "Engr. Cruz")]))
      .toEqual({ name: "Engr. Cruz", role: "CRC/CRD" });
    expect(assignedReviewer("for_budget_review", project, [review(3, "ready", "Engr. Cruz")])).toEqual({ name: "Budget Officer", role: "Budget Officer" });
    expect(assignedReviewer("pending_budget_review", project, [review(3, "ready"), review(4, "certification_started", "M. Santos")]))
      .toEqual({ name: "M. Santos", role: "Budget Officer" });
  });
});

describe("reviewHistory", () => {
  it("lists the LIB's review steps newest first, with the actor's role and the status it led to", () => {
    const events = reviewHistory([review(1, "submitted", "PL"), review(2, "held_crc", "CRC", "Clarify the methodology")]);

    expect(events.map((e) => [e.action, e.actor, e.actorRole, e.toStatus, e.comments])).toEqual([
      ["Returned for revision", "CRC", "CRC/CRD", "Returned for Revision - CRC/CRD", "Clarify the methodology"],
      ["Project proposal submitted", "PL", "Project Leader", "Submitted", ""],
    ]);
  });
  it("shows a Finance review comment without a status change (Task 20)", () => {
    const [event] = reviewHistory([review(1, "commented", "Fe Cruz", "Check the unit cost")]);
    expect([event.action, event.actorRole, event.toStatus, event.comments]).toEqual(["Budget review comment", "Budget Officer", "Status unchanged", "Check the unit cost"]);
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
  const all = ["draft", "submitted", "pending_research_review", "returned_research", "for_budget_review", "pending_budget_review", "returned_budget", "reviews_completed"] as const;

  it("opens the registration only for a Draft or a returned project", () => {
    expect(all.filter(registrationOpen)).toEqual(["draft", "returned_research", "returned_budget"]);
  });

  it("allows work only once the reviews are completed", () => {
    expect(all.filter(workAllowed)).toEqual(["reviews_completed"]);
  });

  it("explains the lock with the backend's words", () => {
    expect(workLockedMessage("Draft")).toBe(
      "This project is Draft. Work on it starts once its reviews are completed (the Budget Officer certifies its LIB).",
    );
  });
});

describe("rowActions (Task 16, 2026-10-30)", () => {
  const leader = { isOwnLeader: true, isAdmin: false };
  const reviewer = { isOwnLeader: false, isAdmin: false };
  const admin = { isOwnLeader: false, isAdmin: true };

  it("lets the leader edit and delete a Draft and open its review", () => {
    expect(rowActions("draft", leader)).toEqual({ edit: true, remove: true, openReview: true });
  });

  it("hides edit, delete and Open Review from the leader while a reviewer has the proposal", () => {
    for (const status of ["submitted", "pending_research_review", "for_budget_review", "pending_budget_review"] as const) {
      expect(rowActions(status, leader)).toEqual({ edit: false, remove: false, openReview: false });
    }
  });

  it("reopens editing and the review, not deleting, when it is returned", () => {
    for (const status of ["returned_research", "returned_budget"] as const) {
      expect(rowActions(status, leader)).toEqual({ edit: true, remove: false, openReview: true });
    }
  });

  it("shows an Active proposal's review read-only to the leader", () => {
    expect(rowActions("reviews_completed", leader)).toEqual({ edit: false, remove: false, openReview: true });
  });

  it("keeps Open Review for the reviewers and gives them no edit or delete", () => {
    expect(rowActions("submitted", reviewer)).toEqual({ edit: false, remove: false, openReview: true });
    expect(rowActions("draft", admin)).toEqual({ edit: true, remove: true, openReview: true });
  });
});

describe("review statuses (Task 17, 2026-10-30)", () => {
  it("uses the client's labels, the same on the leader's and the CRC/CRD's dashboard", () => {
    expect(REVIEW_STATUS_LABELS).toEqual({
      draft: "Draft", submitted: "Submitted", pending_research_review: "Ongoing Review - CRC/CRD",
      returned_research: "Returned for Revision - CRC/CRD", for_budget_review: "For Budget Review",
      pending_budget_review: "Ongoing Review - Budget", returned_budget: "Returned Review - Budget", reviews_completed: "Active",
    });
  });

  it("explains every status and colours Active green, each status with its own colour", () => {
    for (const status of Object.keys(REVIEW_STATUS_LABELS) as (keyof typeof REVIEW_STATUS_LABELS)[]) {
      expect(REVIEW_STATUS_MEANINGS[status].length).toBeGreaterThan(20);
    }
    expect(REVIEW_STATUS_MEANINGS.for_budget_review).toContain("forwarded");
    expect(REVIEW_STATUS_STYLE.reviews_completed).toContain("green");
    expect(new Set(Object.values(REVIEW_STATUS_STYLE)).size).toBe(Object.keys(REVIEW_STATUS_STYLE).length);
  });
});

describe("Project Management list (Task 16, 2026-10-30)", () => {
  const project = (id: number, created_at: string, extra: Partial<{ project_code: string; title: string; campus: string; full_name: string }> = {}) => ({
    id, created_at, project_code: extra.project_code ?? `P-${id}`, title: extra.title ?? `Project ${id}`, campus: extra.campus ?? "Siniloan",
    lead_detail: { id: 9, email: "pl@lspu.test", full_name: extra.full_name ?? "Ana Reyes" },
  });

  it("lists the latest projects first, ties by newest id", () => {
    const rows = [project(1, "2026-10-01T08:00:00Z"), project(3, "2026-10-20T08:00:00Z"), project(2, "2026-10-20T08:00:00Z")];
    expect(newestFirst(rows).map((p) => p.id)).toEqual([3, 2, 1]);
  });

  it("searches the code, title, leader and campus, ignoring case", () => {
    const p = project(1, "2026-10-01T08:00:00Z", { project_code: "LSPU-2027-01", title: "Bridging Academia", full_name: "Ana Reyes", campus: "Sta. Cruz" });
    for (const q of ["lspu-2027", "academia", "reyes", "sta. cruz", "  "]) expect(matchesProjectSearch(p, q)).toBe(true);
    expect(matchesProjectSearch(p, "siniloan")).toBe(false);
  });

  it("shows at most five per page with no project on two pages", () => {
    const rows = newestFirst(Array.from({ length: 12 }, (_, i) => project(i + 1, `2026-10-${String(i + 1).padStart(2, "0")}T08:00:00Z`)));
    const pages = [1, 2, 3].map((n) => pageOf(rows, n, REVIEW_PAGE_SIZE));
    expect(pages.map((p) => p.rows.length)).toEqual([5, 5, 2]);
    expect(pages[0].rows[0].id).toBe(12);
    expect(new Set(pages.flatMap((p) => p.rows.map((r) => r.id))).size).toBe(12);
    expect(pageOf(rows, 9, REVIEW_PAGE_SIZE).page).toBe(3);
  });
});

describe("financeEditRow (Task 20, 2026-10-30)", () => {
  const item = {
    id: 5, specification: "", unit: "pax", quantity: "20.00", unit_cost: "500.50", amount: "10010.00",
    allocations: [{ period: "Y1Q1", amount: "4010.00" }, { period: "Y1Q4", amount: "6000.00" }],
  } as LineItem;
  const periods = ["Y1Q1", "Y1Q4"];
  const draft = { specification: "", unit: "pax", quantity: "20", unit_cost: "500.5", split: { Y1Q1: "4010", Y1Q4: "6000" }, reason: "" };

  it("is null when nothing really changed (20 = 20.00)", () => {
    expect(financeEditRow(item, draft, periods)).toBeNull();
  });

  it("sends only the changed fields, with the split whenever the cost changes", () => {
    expect(financeEditRow(item, { ...draft, unit_cost: "450.50", split: { Y1Q1: "3010", Y1Q4: "6000" }, reason: " COA ceiling " }, periods)).toEqual({
      id: 5, reason: "COA ceiling", unit_cost: "450.50", allocations: [{ period: "Y1Q1", amount: "3010" }, { period: "Y1Q4", amount: "6000" }],
    });
    expect(financeEditRow(item, { ...draft, specification: "Venue", reason: "x" }, periods)).toEqual({ id: 5, reason: "x", specification: "Venue" });
  });
});

describe("editChangeLines (Task 20, 2026-10-30)", () => {
  it("shows each changed field as old and new, pesos and periods formatted", () => {
    const edit = {
      id: 1, reason: "COA ceiling", edited_by: 3, edited_by_name: "Fe Cruz", edited_at: "2026-10-30T10:00:00+08:00",
      changes: {
        unit_cost: ["500.50", "450.50"], quantity: ["20.00", "18.00"], specification: ["", "Venue"],
        allocations: [[{ period: "Y1Q1", amount: "4010.00" }, { period: "Y1Q2", amount: "0.00" }], [{ period: "Y1Q1", amount: "3010.00" }]],
      },
    } as LineItemEdit;
    expect(editChangeLines(edit)).toEqual([
      { field: "Unit Cost", before: "₱500.50", after: "₱450.50" },
      { field: "Qty", before: "20", after: "18" },
      { field: "Specification", before: "—", after: "Venue" },
      { field: "Budget periods", before: "Y1Q1 ₱4,010.00", after: "Y1Q1 ₱3,010.00" },
    ]);
  });
});
