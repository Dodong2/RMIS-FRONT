type PlanRow = { title: string; start_date: string; target_date: string };

// Same as the backend's _norm (research_projects/importer.py): spaces collapsed, trailing dots dropped, case ignored
const norm = (value: string) => value.replace(/\s+/g, " ").trim().replace(/\.+$/, "").toLowerCase();
const key = (r: PlanRow) => `${norm(r.title)}|${r.start_date}|${r.target_date}`;

/** Imported rows that repeat an activity already in XI. Work Plan, by the import's own rule: same activity name and
 * the same start and end dates (client 2026-10-29). */
export function duplicateWorkPlanRows(existing: PlanRow[], incoming: PlanRow[]): PlanRow[] {
  const have = new Set(existing.filter((r) => r.title.trim()).map(key));
  return incoming.filter((r) => have.has(key(r)));
}
