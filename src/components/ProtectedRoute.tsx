import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return <AppShellSkeleton />;
  }

  return <>{children}</>;
}

/** Mirrors the real shell so the page does not jump when auth resolves. */
function AppShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden w-64 shrink-0 flex-col gap-5 bg-sidebar p-4 lg:flex">
        <Skeleton className="h-9 w-40 bg-white/10" />
        {[4, 3].map((count, s) => (
          <div key={s} className="space-y-2">
            <Skeleton className="h-3 w-20 bg-white/10" />
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full bg-white/[0.07]" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}