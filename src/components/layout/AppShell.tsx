import { useState, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  title: string;
  children: ReactNode;
}

/**
 * Wrap any authenticated page in this. The sidebar and top bar read from
 * AuthContext directly, so pages never have to pass the user down.
 */
export function AppShell({ title, children }: AppShellProps) {
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background">
        <aside className="hidden shrink-0 lg:block">
          <AppSidebar user={user} isLoading={isLoading} onLogout={logout} />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <AppSidebar
              user={user}
              isLoading={isLoading}
              onNavigate={() => setMobileOpen(false)}
              onLogout={logout}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            user={user}
            isLoading={isLoading}
            title={title}
            onOpenSidebar={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}