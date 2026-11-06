import { describe, expect, it } from "vitest";
import { issueBlocks, issueOpen, issueStep, issueText, snapshotIssues, type ExcelReviewIssue, type ReviewValues } from "./excelReview";

const values = (over: Partial<ReviewValues["fields"]> = {}, team: unknown[] = [{ name: "", user: null }]): ReviewValues => ({
  fields: { title: "T", campus: "", implementing_unit: "", lead: "5", ...over },
  tables: { team, line_items: [{ description: "Bad Item" }, { description: "Travel" }] },
});

const campus: ExcelReviewIssue = { sheet: "Project", row: 14, field: "Campus", message: "Unknown value 'Calamba'.", key: "campus" };
const unit: ExcelReviewIssue = { sheet: "Project", row: 15, field: "College Unit", message: "Not in the list.", key: "implementing_unit" };
const teamRow: ExcelReviewIssue = { sheet: "Project Team", row: 2, field: "Staff ID", message: "Required.", key: "team", index: 0 };
const libRow: ExcelReviewIssue = { sheet: "Budget Requirements", row: 2, field: "Particulars", message: "Not active.", key: "line_items", index: 0 };

describe("excelReview", () => {
  it("maps each issue to its wizard step", () => {
    expect([campus, teamRow, libRow, { ...campus, key: "title" }, { ...campus, key: undefined }].map(issueStep)).toEqual([1, 1, 3, 0, 0]);
    expect(issueStep({ ...teamRow, key: "milestones" })).toBe(2);
  });

  it("closes a field issue once the field changes, and a row issue once that row changes or is removed", () => {
    const issues = [campus, teamRow, libRow];
    const snaps = snapshotIssues(issues, values());
    expect(issues.map((i, n) => issueOpen(i, snaps[n], values()))).toEqual([true, true, true]);
    const fixed = values({ campus: "Siniloan" }, [{ name: "Ben Reyes", user: 7 }]);
    fixed.tables.line_items = [{ description: "Travel" }];
    expect(issues.map((i, n) => issueOpen(i, snaps[n], fixed))).toEqual([false, false, false]);
  });

  it("keeps a row issue open while the flagged row is still there after other rows move", () => {
    const snaps = snapshotIssues([libRow], values());
    const moved = values();
    moved.tables.line_items = [{ description: "New" }, { description: "Bad Item" }];
    expect(issueOpen(libRow, snaps[0], moved)).toBe(true);
  });

  it("blocks unless the field is optional and blank, or the wizard can't show it", () => {
    expect(issueBlocks(campus, values())).toBe(true);
    expect(issueBlocks(unit, values())).toBe(false);
    expect(issueBlocks(unit, values({ implementing_unit: "CTE" }))).toBe(true);
    expect(issueBlocks({ ...campus, key: "project" }, values())).toBe(false);
    expect(issueBlocks(teamRow, values())).toBe(true);
  });

  it("names the field and the workbook row", () => {
    expect(issueText(teamRow)).toBe("Staff ID (Project Team row 2): Required.");
    expect(issueText({ ...campus, row: null })).toBe("Campus: Unknown value 'Calamba'.");
  });
});
