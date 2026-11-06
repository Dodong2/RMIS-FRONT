import type { ProjectImportError } from "../types/research";

/** One issue of POST projects/import/?review=1 (client Task 45): `key` is the draft field or table, `index` the row in it. */
export interface ExcelReviewIssue extends ProjectImportError {
  key?: string;
  index?: number | null;
}

/** The wizard's current values the issues point at: one per project field, one list per table. */
export type ReviewValues = { fields: Record<string, unknown>; tables: Record<string, unknown[]> };

const TABLE_STEPS: Record<string, number> = { team: 1, studies: 0, outputs: 0, beneficiaries: 0, milestones: 2, line_items: 3, endorsers: 4 };
const TEAM_STEP_FIELDS = new Set(["lead", "lead_gender", "contact_number", "campus", "implementing_unit", "college", "cooperating_agencies"]);
/** Optional in Manual Entry: an issue on one of these is shown, but a blank value doesn't stop registering. */
const OPTIONAL_FIELDS = new Set(["implementing_unit", "college", "cooperating_agencies", "contact_number"]);

export const issueStep = (issue: ExcelReviewIssue) =>
  issue.key && issue.key in TABLE_STEPS ? TABLE_STEPS[issue.key] : issue.key && TEAM_STEP_FIELDS.has(issue.key) ? 1 : 0;

const text = (value: unknown) => JSON.stringify(value ?? null);
const isBlank = (value: unknown) => (Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim());

/** Where an issue points: one table row, one project field, or nowhere the wizard shows. */
const located = (issue: ExcelReviewIssue, values: ReviewValues) =>
  issue.key !== undefined && issue.index != null && issue.key in values.tables
    ? ("row" as const)
    : issue.key !== undefined && issue.key in values.fields
      ? ("field" as const)
      : null;

/** Each issue's value as loaded from the workbook, taken once. */
export function snapshotIssues(issues: ExcelReviewIssue[], values: ReviewValues): string[] {
  return issues.map((issue) => {
    const where = located(issue, values);
    if (where === "row") return text(values.tables[issue.key!][issue.index!]);
    if (where === "field") return text(values.fields[issue.key!]);
    return "";
  });
}

/** Open while what the workbook gave is still there unchanged: the field still holds it, or a row of the table still
 * equals the flagged row (so removing other rows doesn't close it). Editing the field or row closes the issue; the
 * wizard's own required checks and the backend then judge the new value. */
export function issueOpen(issue: ExcelReviewIssue, snapshot: string, values: ReviewValues): boolean {
  const where = located(issue, values);
  if (where === "row") return values.tables[issue.key!].some((row) => text(row) === snapshot);
  if (where === "field") return text(values.fields[issue.key!]) === snapshot;
  return true;
}

/** Blocks registering, unless it's on an optional field now left blank, or the wizard has no place to fix it (the
 * backend checks those again on Register). */
export const issueBlocks = (issue: ExcelReviewIssue, values: ReviewValues) =>
  located(issue, values) !== null && !(issue.key && OPTIONAL_FIELDS.has(issue.key) && isBlank(values.fields[issue.key]));

/** "Field (row 3): message", as the workbook names it. */
export const issueText = (issue: ExcelReviewIssue) =>
  `${issue.field}${issue.row ? ` (${issue.sheet} row ${issue.row})` : ""}: ${issue.message}`;
