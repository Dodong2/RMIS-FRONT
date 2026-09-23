import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavIcon } from "./NavIcon";
import { LspuMark } from "../common/LspuMark";
import { visibleSections } from "../../lib/nav";
import { initialsFrom, resolveTier, roleLabel, roleScopeLine } from "../../lib/roles";
import type { User } from "../../types/auth";

interface AppSidebarProps {
  user: User | null;
  isLoading?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}

/**
 * One sidebar for every role. Which items appear is decided entirely by the
 * user's role tier, so no role needs its own copy of this component.
 */
export function AppSidebar({ user, isLoading, onNavigate, onLogout }: AppSidebarProps) {
  const tier = resolveTier(user?.role);
  const sections = visibleSections(tier);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <LspuMark size={36} />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-white">LSPU RMIS</p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            Research Management
          </p>
        </div>
      </div>

      <nav ref={navRef} className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        {isLoading ? (
          <SidebarNavSkeleton />
        ) : sections.length === 0 ? (
          <p className="px-3 py-6 text-xs leading-relaxed text-sidebar-foreground/60">
            Your role has not been assigned yet. A system administrator needs to
            approve your account before any module opens.
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.heading} className="mb-5">
              <p className="px-3 pb-1.5 text-[11px] font-semibold text-sidebar-foreground/45">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) =>
                  item.ready ? (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-[13px] font-medium transition-colors",
                            isActive
                              ? "border-sidebar-primary bg-sidebar-accent text-sidebar-primary"
                              : "border-transparent text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )
                        }
                      >
                        <NavIcon name={item.icon} className="size-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  ) : (
                    <li key={item.to}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-disabled="true"
                            className="flex cursor-not-allowed items-center gap-3 rounded-lg border-l-[3px] border-transparent px-3 py-2 text-[13px] font-medium text-sidebar-foreground/35"
                          >
                            <NavIcon name={item.icon} className="size-[18px] shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Not built yet
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {isLoading ? (
          <Skeleton className="h-12 w-full bg-white/10" />
        ) : (
          <div className="mb-1 flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-2.5 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {initialsFrom(user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {user?.email ?? "—"}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">
                {roleLabel(user?.role)}
              </p>
            </div>
          </div>
        )}
        <p className="px-2.5 pb-2 text-[11px] leading-snug text-sidebar-foreground/45">
          {roleScopeLine(user?.role)}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

function SidebarNavSkeleton() {
  return (
    <div className="space-y-5">
      {[4, 3, 2].map((count, s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="ml-3 h-3 w-20 bg-white/10" />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full bg-white/[0.07]" />
          ))}
        </div>
      ))}
    </div>
  );
}