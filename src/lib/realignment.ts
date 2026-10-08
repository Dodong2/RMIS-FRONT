import type { RealignmentStatus } from "../types/financial";

export const REALIGNMENT_STATUS_META: Record<RealignmentStatus, { label: string; bg: string; color: string }> = {
  implemented: { label: "Implemented", bg: "#d1fae5", color: "#166534" },
  pending_approval: { label: "Pending University Admin", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#d1fae5", color: "#166534" },
  pending_bor: { label: "Pending Board of Regents", bg: "#faf5ff", color: "#6b21a8" },
  bor_approved: { label: "BOR Approved", bg: "#d1fae5", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};
