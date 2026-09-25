export interface TemporaryReplacement {
  replacementName: string;
  designation: string;
  coverage: string;
  from: string;
  until: string;
  basis: string;
}

export const TEMPORARY_REPLACEMENTS: TemporaryReplacement[] = [
  { replacementName: "Dr. Natividad Reyes", designation: "Campus Research Coordinator (OIC)", coverage: "Project approvals and monthly report review", from: "2026-09-01", until: "2026-10-31", basis: "Office Order No. 2026-118" },
  { replacementName: "Engr. Carlo Mendoza", designation: "Study Leader (Acting)", coverage: "Milestone updates and team coordination", from: "2026-08-15", until: "2026-09-30", basis: "Memo RIUH-2026-044" },
];
