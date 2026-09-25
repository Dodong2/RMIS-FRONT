import type { ProjectRiskFlags, RiskCategory, RiskLevel, RiskRegisterStatus } from "../types/risk";

export const CAT_META: Record<RiskCategory, { label: string; color: string; bg: string; icon: string }> = {
  technical: { label: "Technical", color: "#0d2a5e", bg: "#e0eaf7", icon: "⚙️" },
  financial: { label: "Financial", color: "#0891b2", bg: "#e0f2fe", icon: "💰" },
  schedule: { label: "Schedule", color: "#7c3aed", bg: "#ede9fe", icon: "📅" },
  personnel: { label: "Personnel", color: "#059669", bg: "#d1fae5", icon: "👤" },
  compliance: { label: "Compliance", color: "#f59e0b", bg: "#fef3c7", icon: "📋" },
  procurement: { label: "Procurement", color: "#ea580c", bg: "#ffedd5", icon: "🛒" },
  other: { label: "Other", color: "#64748b", bg: "#f1f5f9", icon: "🌐" },
};

export const LEVEL_META: Record<RiskLevel, { label: string; color: string; bg: string; heat: string; range: string; action: string }> = {
  critical: { label: "Critical", color: "#dc2626", bg: "#fee2e2", heat: "#fca5a5", range: "17–25", action: "Escalation to VP / DRD" },
  high: { label: "High", color: "#ea580c", bg: "#ffedd5", heat: "#fdba74", range: "10–16", action: "Notice to RIUH and CRC Chairperson" },
  medium: { label: "Medium", color: "#f59e0b", bg: "#fef3c7", heat: "#fde68a", range: "5–9", action: "Reminder to the Project Leader" },
  low: { label: "Low", color: "#059669", bg: "#d1fae5", heat: "#bbf7d0", range: "1–4", action: "Monitor only" },
};

export const STATUS_META: Record<RiskRegisterStatus, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "#dc2626", bg: "#fee2e2" },
  mitigating: { label: "Mitigating", color: "#0891b2", bg: "#e0f2fe" },
  escalated: { label: "Escalated", color: "#7c3aed", bg: "#ede9fe" },
  closed: { label: "Closed", color: "#64748b", bg: "#f1f5f9" },
};

export const LH_LABELS: Record<number, string> = { 1: "Rare", 2: "Unlikely", 3: "Possible", 4: "Likely", 5: "Almost Certain" };
export const IMP_LABELS: Record<number, string> = { 1: "Negligible", 2: "Minor", 3: "Moderate", 4: "Major", 5: "Catastrophic" };

export function levelOf(score: number): RiskLevel {
  if (score <= 4) return "low";
  if (score <= 9) return "medium";
  if (score <= 16) return "high";
  return "critical";
}

export const ALERT_ROUTING: Record<Exclude<RiskLevel, "low">, { to: string; roles: string[] }> = {
  medium: { to: "Project Leader", roles: ["program_leader", "project_leader"] },
  high: { to: "RIUH + CRC Chairperson", roles: ["riuh", "crc_chair"] },
  critical: { to: "VP-REI / DRD", roles: ["vprei", "drd"] },
};

export const FLAG_LABELS: Record<keyof ProjectRiskFlags, string> = {
  non_submission_warning: "Non-Submission Warning",
  budget_underutilization: "Budget Underutilization",
  deliverable_shortfall: "Deliverable Shortfall",
  deliverable_slippage: "Deliverable Slippage",
  personnel_change_frequency: "Personnel Change Frequency",
  procurement_delay: "Procurement Delay",
  forecast_overrun: "Forecast Overrun Risk",
};

export const FLAG_ORDER = Object.keys(FLAG_LABELS) as (keyof ProjectRiskFlags)[];

const ESCALATION_LABELS: Record<string, string> = {
  on_track: "On Track",
  notify_dean_riuh: "Notify Dean/RIUH",
  terminate_recommended: "Termination Recommended",
  unknown: "No monthly report yet",
};

export function flagDetail(key: keyof ProjectRiskFlags, flags: ProjectRiskFlags): string {
  switch (key) {
    case "non_submission_warning": {
      const f = flags.non_submission_warning;
      return `${ESCALATION_LABELS[f.status]}${f.months_since_last_report !== null ? ` · ${f.months_since_last_report} mo. since last report` : ""}`;
    }
    case "budget_underutilization": {
      const f = flags.budget_underutilization;
      return f.budget_used_pct === null ? "No certified budget yet" : `${f.budget_used_pct}% of budget used${f.near_renewal ? " · near renewal" : ""}`;
    }
    case "deliverable_shortfall": {
      const f = flags.deliverable_shortfall;
      return f.deliverables_pct === null ? "No milestones yet" : `${f.deliverables_pct}% of deliverables done${f.near_renewal ? " · near renewal" : ""}`;
    }
    case "deliverable_slippage": {
      const f = flags.deliverable_slippage;
      return `${f.overdue_count} overdue milestone${f.overdue_count === 1 ? "" : "s"}`;
    }
    case "personnel_change_frequency": {
      const f = flags.personnel_change_frequency;
      return `${f.changes_in_window} change${f.changes_in_window === 1 ? "" : "s"} in the last ${f.window_months} months`;
    }
    case "procurement_delay": {
      const f = flags.procurement_delay;
      return `${f.delayed_requests} request${f.delayed_requests === 1 ? "" : "s"} pending over ${f.delay_days} days`;
    }
    case "forecast_overrun": {
      const f = flags.forecast_overrun;
      if (!f.has_forecast) return "No forecast run yet";
      return f.is_overrun_risk ? "Overrun risk flagged" : "No overrun risk";
    }
  }
}
