import type { RecordStatus } from "../types/research";

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
