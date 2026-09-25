import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavIcon } from "./NavIcon";
import { visibleSections } from "../../lib/nav";
import { initialsFrom, resolveTier, roleLabel } from "../../lib/roles";
import { protoRoleStyle } from "../../lib/protoRole";
import type { User } from "../../types/auth";

interface AppSidebarProps {
  user: User | null;
  isLoading?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}

const MUTED = "rgba(168,196,232,0.8)";

export function AppSidebar({ user, isLoading, onNavigate, onLogout }: AppSidebarProps) {
  const tier = resolveTier(user?.role);
  const sections = visibleSections(tier);
  const navRef = useRef<HTMLElement>(null);
  const roleStyle = protoRoleStyle(user?.role);

  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <div className="flex h-full flex-col" style={{ width: "256px", background: "#0a2050" }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
          <span className="text-xs font-black" style={{ color: "#0d2a5e" }}>LSPU</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-black text-sm leading-tight">LSPU–RMIS</p>
          <p className="text-xs" style={{ color: "rgba(168,196,232,0.55)" }}>Research Mgmt. IS</p>
        </div>
      </div>

      <nav ref={navRef} className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main">
        {isLoading ? (
          <SidebarNavSkeleton />
        ) : sections.length === 0 ? (
          <p className="px-3 py-6 text-xs leading-relaxed" style={{ color: "rgba(168,196,232,0.55)" }}>
            Your role has not been assigned yet. A system administrator needs to approve your account before any
            module opens.
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.heading} className="mb-4">
              <p
                className="px-3 mb-1 text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(168,196,232,0.35)", fontSize: "10px" }}
              >
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    {item.ready ? (
                      <NavLink
                        to={item.to}
                        end={item.to === "/budget"}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive ? "" : "hover:bg-white/[0.06] hover:text-white"
                          }`
                        }
                        style={({ isActive }) => ({
                          background: isActive ? "rgba(8,145,178,0.2)" : undefined,
                          color: isActive ? "#67e8f9" : MUTED,
                          borderLeft: `3px solid ${isActive ? "#0891b2" : "transparent"}`,
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <span style={{ color: isActive ? "#67e8f9" : "rgba(168,196,232,0.5)", flexShrink: 0 }}>
                              <NavIcon name={item.icon} />
                            </span>
                            <span className="truncate text-left text-xs font-semibold">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-disabled="true"
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed"
                            style={{ color: "rgba(168,196,232,0.3)", borderLeft: "3px solid transparent" }}
                          >
                            <span style={{ flexShrink: 0 }}>
                              <NavIcon name={item.icon} />
                            </span>
                            <span className="truncate text-left text-xs font-semibold">{item.label}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">Not built yet</TooltipContent>
                      </Tooltip>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {isLoading ? (
          <div className="h-12 rounded-xl mb-1 animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: roleStyle.color }}
            >
              {initialsFrom(user?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-bold truncate">{user?.email ?? "—"}</p>
              <p className="text-xs truncate" style={{ color: "rgba(168,196,232,0.55)" }}>{roleLabel(user?.role)}</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/[0.06] hover:text-[rgba(168,196,232,0.9)]"
          style={{ color: "rgba(168,196,232,0.55)" }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}

function SidebarNavSkeleton() {
  return (
    <div className="space-y-5">
      {[4, 3, 2].map((count, s) => (
        <div key={s} className="space-y-2">
          <div className="ml-3 h-3 w-20 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          ))}
        </div>
      ))}
    </div>
  );
}
