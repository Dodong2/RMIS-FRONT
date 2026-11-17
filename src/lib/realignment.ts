import type { RealignmentStatus } from "../types/financial";

export const REALIGNMENT_STATUS_META: Record<RealignmentStatus, { label: string; bg: string; color: string }> = {
  implemented: { label: "Implemented", bg: "#d1fae5", color: "#166534" },
  pending_approval: { label: "Pending", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#d1fae5", color: "#166534" },
  pending_bor: { label: "Pending", bg: "#fef3c7", color: "#92400e" },
  bor_approved: { label: "BOR Approved", bg: "#d1fae5", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};

// Same rule as the backend (REALIGNMENT_MIN_LEAD_DAYS): requests close 60 days before the target end date.
export const REALIGNMENT_MIN_LEAD_DAYS = 60;

export function realignmentClosedReason(targetEndDate: string | null, today: Date = new Date()): string | null {
  if (!targetEndDate) return null;
  const deadline = new Date(`${targetEndDate}T00:00:00`);
  deadline.setDate(deadline.getDate() - REALIGNMENT_MIN_LEAD_DAYS);
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (day <= deadline) return null;
  return `Realignment closed: requests must be filed at least ${REALIGNMENT_MIN_LEAD_DAYS} days before the target end date (${targetEndDate}).`;
}
