import type { BudgetStatus, BudgetStep, LineItemBudget } from "../types/budget";

/** Client 2026-10-21 LIB workflow. Codes endorsed/returned are kept from 2026-10-18 for older LIBs. */
export const LIB_STATUS_META: Record<BudgetStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft: { label: "Draft", bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  submitted: { label: "Awaiting CRC Chair", bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  crc_processing: { label: "Processing", bg: "#e0f2fe", text: "#0369a1", dot: "#0891b2" },
  for_checking: { label: "For Checking", bg: "#ede9fe", text: "#5b21b6", dot: "#8b5cf6" },
  endorsed: { label: "Ready for Certification", bg: "#e0f2fe", text: "#0369a1", dot: "#0891b2" },
  certifying: { label: "In Progress", bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  returned: { label: "On Hold", bg: "#fee2e2", text: "#b91c1c", dot: "#ef4444" },
  certified: { label: "Certified", bg: "#d1fae5", text: "#166534", dot: "#22c55e" },
};

export const LIB_STATUS_ORDER: BudgetStatus[] = ["draft", "submitted", "crc_processing", "for_checking", "endorsed", "certifying", "returned", "certified"];

export interface LibViewer {
  isOwnLeader: boolean;
  canEndorse: boolean;
  canCertify: boolean;
}

export interface LibAction {
  step: BudgetStep;
  label: string;
  /** Opens the remarks modal first (required for Put on Hold, optional for Resubmit). */
  remarks?: "required" | "optional";
  danger?: boolean;
  done: string;
}

const CRC_STATUSES: BudgetStatus[] = ["submitted", "crc_processing", "for_checking"];
const BUDGET_STATUSES: BudgetStatus[] = ["endorsed", "certifying"];

const HOLD: LibAction = { step: "hold", label: "Put on Hold", remarks: "required", danger: true, done: "LIB put on hold for the Project Leader." };

/** The buttons this viewer gets on this LIB; mirrors the backend's TRANSITIONS/HOLDS (budget_lib/views.py). */
export function libActions(status: BudgetStatus, v: LibViewer): LibAction[] {
  const actions: LibAction[] = [];
  if (v.isOwnLeader && status === "draft") actions.push({ step: "submit", label: "Submit to CRC Chair", done: "LIB submitted to the CRC Chair." });
  if (v.isOwnLeader && status === "returned") actions.push({ step: "resubmit", label: "Resubmit to CRC Chair", remarks: "optional", done: "LIB resubmitted to the CRC Chair." });
  if (v.canEndorse && CRC_STATUSES.includes(status)) actions.push({ step: "for-checking", label: "Mark for checking", done: "Proposal forwarded to Finance/Accounting/Budget for budget review." });
  if (v.canCertify && status === "endorsed") actions.push({ step: "start-certification", label: "Start Certification", done: "Certification started." });
  if (v.canCertify && status === "certifying") actions.push({ step: "certify", label: "Certify LIB", done: "LIB certified." });
  if ((v.canEndorse && CRC_STATUSES.includes(status)) || (v.canCertify && BUDGET_STATUSES.includes(status))) actions.push(HOLD);
  return actions;
}

/** What this viewer has to do on this LIB, for the project list and the bell; null when nothing. */
export function libToDo(b: Pick<LineItemBudget, "status" | "hold_level">, v: LibViewer): string | null {
  if (v.canEndorse) {
    if (CRC_STATUSES.includes(b.status)) return "Awaiting your review · mark it for checking";
  }
  if (v.canCertify) {
    if (b.status === "endorsed") return "Ready for certification";
    if (b.status === "certifying") return "Certification in progress";
  }
  if (v.isOwnLeader) {
    if (b.status === "returned") return `${holdLabel(b.hold_level)} · edit and resubmit`;
    if (b.status === "draft") return "Draft · submit it to the CRC Chair";
  }
  return null;
}

export function holdLabel(level: LineItemBudget["hold_level"]) {
  return level === "crc" ? "On Hold by the CRC Chair" : level === "budget" ? "On Hold by the Budget Officer" : "On Hold";
}
