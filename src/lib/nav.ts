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
 *
 * `roles` is the one exception to "tiers only": extra role codes for when a
 * client request splits a tier (Analytics, 2026-10-13: Program and Project
 * Leader yes, Study Leader no, though all are project_management).
 *
 * `tabs` turns an item into a group (client sidebar_layout.png, 2026-10-14):
 * the sidebar shows one entry, and every page in the group gets the group's
 * tabs above it. Each tab keeps its own tiers/roles (the group's own tiers are
 * not used); the group links to its first visible tab, and a role that sees
 * only one tab gets that page as a plain item.
 */

export interface NavItem {
  label: string;
  to: string;
  icon: IconName;
  tiers: RoleTier[] | "all";
  roles?: string[];
  ready: boolean;
  tabs?: NavItem[];
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

const ALL_RESEARCH_BUT_STAFF = ALL_RESEARCH.filter((t) => t !== "execution");

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
        ready: true,
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
        tiers: ["system_admin", "institution_oversight", "procurement", "finance", "project_management"],
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
      { label: "Document and Records Management", to: "/documents", icon: "file", tiers: ALL_RESEARCH_BUT_STAFF, ready: true },
      { label: "Research Outputs", to: "/outputs", icon: "book", tiers: ALL_RESEARCH_BUT_STAFF, ready: true },
      { label: "Monitoring & Evaluation", to: "/monitoring", icon: "activity", tiers: ALL_RESEARCH, ready: true },
      { label: "Accomplishment Report", to: "/accomplishment", icon: "clipboard", tiers: ["execution"], ready: true },
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
      {
        label: "Analytics",
        to: "/analytics",
        icon: "chart",
        tiers: [...OVERSIGHT, "finance"],
        roles: ["procurement_officer_lib", "program_leader", "project_leader"],
        ready: true,
      },
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
      {
        label: "User & Access Management",
        to: "/admin/users",
        icon: "userCog",
        tiers: ["system_admin"],
        ready: true,
        tabs: [
          { label: "Users", to: "/admin/users", icon: "userCog", tiers: ["system_admin"], ready: true },
          { label: "College Units", to: "/admin/college-units", icon: "settings", tiers: ["system_admin"], ready: true },
          { label: "REI Thrusts", to: "/admin/rei-thrusts", icon: "settings", tiers: ["system_admin"], ready: true },
          {
            label: "Cooperating Agencies",
            to: "/admin/cooperating-agencies",
            icon: "settings",
            tiers: ["system_admin"],
            ready: true,
          },
          { label: "Endorsers", to: "/admin/endorsers", icon: "settings", tiers: ["system_admin"], ready: true },
        ],
      },
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
        tiers: [...OVERSIGHT, "project_management", "study_management", "procurement"],
        ready: true,
        tabs: [
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
            tiers: ["system_admin", "campus_coordination", "college_oversight", "project_management"],
            roles: ["drd"],
            ready: true,
          },
          {
            label: "Personnel Changes",
            to: "/personnel-changes",
            icon: "userCog",
            tiers: [...OVERSIGHT, "procurement"],
            ready: true,
          },
        ],
      },
      {
        label: "Audit Logs",
        to: "/admin/audit",
        icon: "clipboard",
        tiers: ["system_admin"],
        ready: true,
        tabs: [
          { label: "Audit Logs", to: "/admin/audit", icon: "clipboard", tiers: ["system_admin"], ready: true },
          { label: "System Settings", to: "/admin/settings", icon: "settings", tiers: ["system_admin"], ready: true },
        ],
      },
    ],
  },
];

function canSee(item: NavItem, tier: RoleTier | null, roleCode?: string): boolean {
  return (
    item.tiers === "all" ||
    (tier !== null && item.tiers.includes(tier)) ||
    (!!roleCode && !!item.roles?.includes(roleCode))
  );
}

export function visibleSections(tier: RoleTier | null, roleCode?: string): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.flatMap((item) => {
      if (!item.tabs) return canSee(item, tier, roleCode) ? [item] : [];
      const tabs = item.tabs.filter((tab) => canSee(tab, tier, roleCode));
      // One visible tab is just that page under its own name (e.g. procurement → Personnel Changes).
      if (tabs.length <= 1) return tabs;
      return [{ ...item, to: tabs[0].to, tabs }];
    }),
  })).filter((section) => section.items.length > 0);
}

/** Every page path the user may open, group tabs included. */
export function visibleTargets(tier: RoleTier | null, roleCode?: string): string[] {
  return visibleSections(tier, roleCode).flatMap((s) =>
    s.items.flatMap((i) => i.tabs ?? [i]).filter((i) => i.ready).map((i) => i.to),
  );
}

/** The visible tabs of the group that owns `pathname`, or [] when it isn't grouped. */
export function groupTabsFor(pathname: string, tier: RoleTier | null, roleCode?: string): NavItem[] {
  for (const section of visibleSections(tier, roleCode)) {
    for (const item of section.items) {
      if (item.tabs?.some((tab) => tab.to === pathname)) return item.tabs;
    }
  }
  return [];
}
