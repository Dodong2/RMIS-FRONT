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
  | "cart";

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
    heading: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "grid", tiers: "all", ready: true },
    ],
  },
  {
    heading: "Research operations",
    items: [
      {
        label: "Projects",
        to: "/projects",
        icon: "folder",
        tiers: ALL_RESEARCH,
        ready: false,
      },
      {
        label: "Work plan",
        to: "/work-plan",
        icon: "calendar",
        tiers: [...OVERSIGHT, "project_management", "study_management"],
        ready: false,
      },
      {
        label: "Tasks",
        to: "/tasks",
        icon: "users",
        tiers: ALL_RESEARCH,
        ready: false,
      },
      {
        label: "Ethics and compliance",
        to: "/compliance",
        icon: "shield",
        tiers: [...OVERSIGHT, "project_management", "study_management"],
        ready: false,
      },
      {
        label: "Documents",
        to: "/documents",
        icon: "file",
        tiers: ALL_RESEARCH,
        ready: false,
      },
      {
        label: "Research outputs",
        to: "/outputs",
        icon: "book",
        tiers: ALL_RESEARCH,
        ready: false,
      },
      {
        label: "Monitoring",
        to: "/monitoring",
        icon: "activity",
        tiers: OVERSIGHT,
        ready: false,
      },
      {
        label: "Risks",
        to: "/risks",
        icon: "alert",
        tiers: [...OVERSIGHT, "project_management"],
        ready: false,
      },
    ],
  },
  {
    heading: "Finance",
    items: [
      {
        label: "Budget",
        to: "/budget",
        icon: "wallet",
        tiers: [...OVERSIGHT, "finance", "project_management"],
        ready: false,
      },
      {
        label: "Budget forecast",
        to: "/budget/forecast",
        icon: "trending",
        tiers: ["system_admin", "institution_oversight", "finance"],
        ready: false,
      },
      {
        label: "Disbursements",
        to: "/disbursements",
        icon: "receipt",
        tiers: [...OVERSIGHT, "finance", "project_management"],
        ready: false,
      },
      {
        label: "Procurement",
        to: "/procurement",
        icon: "cart",
        tiers: ["system_admin", "institution_oversight", "procurement", "finance"],
        ready: false,
      },
    ],
  },
  {
    heading: "Insights",
    items: [
      {
        label: "Analytics",
        to: "/analytics",
        icon: "chart",
        tiers: [...OVERSIGHT, "finance"],
        ready: false,
      },
      {
        label: "Funding recommendations",
        to: "/decision-support",
        icon: "compass",
        tiers: ["system_admin", "institution_oversight", "finance"],
        ready: false,
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      {
        label: "Users",
        to: "/admin/users",
        icon: "userCog",
        tiers: ["system_admin"],
        ready: true,
      },
      {
        label: "Pending registrations",
        to: "/admin/pending-users",
        icon: "clipboard",
        tiers: ["system_admin"],
        ready: true,
      },
      {
        label: "Audit logs",
        to: "/admin/audit",
        icon: "activity",
        tiers: ["system_admin"],
        ready: false,
      },
      {
        label: "Settings",
        to: "/admin/settings",
        icon: "settings",
        tiers: ["system_admin"],
        ready: false,
      },
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