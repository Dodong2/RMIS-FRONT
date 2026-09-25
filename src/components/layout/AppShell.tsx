import { useState, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  const { user, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden" style={{ background: "#f0f4f8" }}>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 lg:hidden"
            style={{ background: "rgba(5,18,46,0.6)", backdropFilter: "blur(2px)" }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ width: "256px", minHeight: "100vh", flexShrink: 0 }}
        >
          <AppSidebar user={user} isLoading={isLoading} onNavigate={() => setSidebarOpen(false)} onLogout={logout} />
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar user={user} isLoading={isLoading} title={title} onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
