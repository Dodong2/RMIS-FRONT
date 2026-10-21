import type { ProcurementStatus } from "../types/financial";

// Shared by the Procurement page and the Procurement Officer dashboard.
export const STATUS_META: Record<ProcurementStatus, { label: string; bg: string; color: string; dot: string }> = {
  requested: { label: "Request Submitted", bg: "#e0eaf7", color: "#0d2a5e", dot: "#0d2a5e" },
  under_review: { label: "Under Review", bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  returned_for_revision: { label: "Returned for Revision", bg: "#fef08a", color: "#b45309", dot: "#d97706" },
  for_procurement: { label: "For Procurement", bg: "#e0f2fe", color: "#0369a1", dot: "#0891b2" },
  procurement_in_progress: { label: "Procurement in Progress", bg: "#dbeafe", color: "#0284c7", dot: "#0284c7" },
  order_placed: { label: "Order Placed", bg: "#bfdbfe", color: "#1d4ed8", dot: "#1d4ed8" },
  awaiting_delivery: { label: "Awaiting Delivery", bg: "#ffedd5", color: "#a16207", dot: "#f59e0b" },
  delivered: { label: "Delivered", bg: "#ccfbf1", color: "#0f766e", dot: "#14b8a6" },
  ready_for_release: { label: "Ready for Release", bg: "#d1fae5", color: "#166534", dot: "#22c55e" },
  completed: { label: "Completed", bg: "#86efac", color: "#065f46", dot: "#059669" },
  cancelled: { label: "Cancelled", bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
};
