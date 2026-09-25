import type { RoleTier } from "./roles";

/**
 * One source of truth for the sidebar.
 *
 * `tiers` lists the access LEVELS that can see an item — never individual role
 * codes. Adding a new title to an existing tier on the backend automatically
 * gives it the right navigation here, with no change to this file.
 *
 * `ready` marks whether the module's backend actually exists yet. Items that are
 * not ready render disabled with a "Not yet built" note instead of linking to a
 * page full of invented numbers. Flip the flag when the module lands.
 */

export interface NavItem {
  label: string;
  to: string;
  icon: IconName;
  tiers: RoleTier[] | "all";
  ready: boolean;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export type IconName =
  | "grid"
  | "folder"
  | "calendar"
  | "users"
  | "wallet"
  | "trending"
  | "receipt"
  | "shield"
  | "file"
  | "book"
  | "activity"
  | "alert"
  | "chart"
  | "compass"
  | "userCog"
  | "clipboard"
  | "settings"
  | "cart"
  | "sync"
  | "team"
  | "reports";

const ALL_RESEARCH: RoleTier[] = [
  "system_admin",
  "institution_oversight",
  "campus_coordination",
  "college_oversight",
  "project_management",
  "study_management",
  "execution",
];

const OVERSIGHT: RoleTier[] = [
  "system_admin",
  "institution_oversight",
  "campus_coordination",
  "college_oversight",
];

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Core",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "grid", tiers: "all", ready: true },
      { label: "Project Management", to: "/projects", icon: "folder", tiers: ALL_RESEARCH, ready: true },
      {
        label: "Work Plan",
        to: "/work-plan",
        icon: "calendar",
        tiers: [...OVERSIGHT, "project_management", "study_management"],
        ready: true,
      },
      { label: "Personnel & Tasks", to: "/tasks", icon: "users", tiers: ALL_RESEARCH, ready: true },
    ],
  },
  {
    heading: "Financial",
    items: [
      {
        label: "Budget Management",
        to: "/budget",
        icon: "wallet",
        tiers: [...OVERSIGHT, "finance", "procurement", "project_management", "study_management"],
        ready: true,
      },
      {
        label: "Budget Forecasting",
        to: "/budget/forecast",
        icon: "trending",
        tiers: ["system_admin", "institution_oversight", "finance"],
        ready: true,
      },
      {
        label: "Budget Office Sync",
        to: "/budget-sync",
        icon: "sync",
        tiers: ["system_admin", "institution_oversight", "finance"],
        ready: false,
      },
    ],
  },
  {
    heading: "Procurement, Realignment & Financial Monitoring",
    items: [
      {
        label: "Financial Monitoring",
        to: "/disbursements",
        icon: "receipt",
        tiers: [...OVERSIGHT, "finance", "project_management"],
        ready: true,
      },
      {
        label: "Procurement",
        to: "/procurement",
        icon: "cart",
        tiers: ["system_admin", "institution_oversight", "procurement", "finance"],
        ready: true,
      },
    ],
  },
  {
    heading: "Research",
    items: [
      {
        label: "Compliance Tracking",
        to: "/compliance",
        icon: "shield",
        tiers: [...OVERSIGHT, "project_management", "study_management"],
        ready: true,
      },
      { label: "Document and Records Management", to: "/documents", icon: "file", tiers: ALL_RESEARCH, ready: true },
      { label: "Research Outputs", to: "/outputs", icon: "book", tiers: ALL_RESEARCH, ready: true },
      { label: "Monitoring & Evaluation", to: "/monitoring", icon: "activity", tiers: ALL_RESEARCH, ready: true },
      {
        label: "Risk Management",
        to: "/risks",
        icon: "alert",
        tiers: [...OVERSIGHT, "project_management"],
        ready: true,
      },
      { label: "Reports & Data Export", to: "/reports", icon: "reports", tiers: [...OVERSIGHT, "finance"], ready: true },
    ],
  },
  {
    heading: "Insights",
    items: [
      { label: "Analytics", to: "/analytics", icon: "chart", tiers: [...OVERSIGHT, "finance"], ready: true },
      {
        label: "Decision Support System",
        to: "/decision-support",
        icon: "compass",
        tiers: ["system_admin", "institution_oversight", "finance"],
        ready: true,
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "User & Access Management", to: "/admin/users", icon: "userCog", tiers: ["system_admin"], ready: true },
      {
        label: "Pending Registrations",
        to: "/admin/pending-users",
        icon: "clipboard",
        tiers: ["system_admin"],
        ready: true,
      },
      {
        label: "Personnel Coordination",
        to: "/staff",
        icon: "team",
        tiers: [...OVERSIGHT, "project_management", "study_management"],
        ready: true,
      },
      {
        label: "Leader Load",
        to: "/leader-load",
        icon: "activity",
        tiers: [...OVERSIGHT, "project_management"],
        ready: true,
      },
      {
        label: "Personnel Changes",
        to: "/personnel-changes",
        icon: "userCog",
        tiers: [...OVERSIGHT, "procurement"],
        ready: true,
      },
      { label: "Audit Logs", to: "/admin/audit", icon: "clipboard", tiers: ["system_admin"], ready: true },
      { label: "System Settings", to: "/admin/settings", icon: "settings", tiers: ["system_admin"], ready: false },
    ],
  },
];

export function visibleSections(tier: RoleTier | null): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => item.tiers === "all" || (tier !== null && item.tiers.includes(tier)),
    ),
  })).filter((section) => section.items.length > 0);
}