import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { initialsFrom, roleLabel, roleScopeLine } from "../../lib/roles";
import type { User } from "../../types/auth";

interface TopbarProps {
  user: User | null;
  isLoading?: boolean;
  title: string;
  onOpenSidebar: () => void;
}

export function Topbar({ user, isLoading, title, onOpenSidebar }: TopbarProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-navy lg:text-lg">{title}</h1>
          {isLoading ? (
            <Skeleton className="mt-1 h-3 w-48" />
          ) : (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {roleScopeLine(user?.role)}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-40 rounded-lg" />
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-navy text-xs font-bold text-white">
            {initialsFrom(user?.email)}
          </span>
          <div className="hidden min-w-0 md:block">
            <p className="max-w-[180px] truncate text-xs font-semibold text-navy">
              {user?.email ?? "—"}
            </p>
            {user?.role ? (
              <p className="text-[11px] font-medium text-muted-foreground">
                {roleLabel(user.role)}
              </p>
            ) : (
              <Badge variant="outline" className="mt-0.5 h-4 px-1.5 text-[10px]">
                Role pending
              </Badge>
            )}
          </div>
        </div>
      )}
    </header>
  );
}