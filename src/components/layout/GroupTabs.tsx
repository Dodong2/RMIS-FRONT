import { NavLink, useLocation } from "react-router-dom";
import { groupTabsFor } from "../../lib/nav";
import { resolveTier } from "../../lib/roles";
import type { User } from "../../types/auth";

/**
 * Tabs for a grouped sidebar entry (grouping.png): one sidebar item, with its
 * pages as tabs above the content. Renders nothing on ungrouped pages.
 */
export function GroupTabs({ user }: { user: User | null }) {
  const { pathname } = useLocation();
  const tabs = groupTabsFor(pathname, resolveTier(user?.role), user?.role?.code);
  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label="Section tabs"
      className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border p-1"
      style={{ borderColor: "#e2e8f0", background: "white" }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={({ isActive }) => ({
            background: isActive ? "#0d2a5e" : "transparent",
            color: isActive ? "white" : "#64748b",
          })}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
