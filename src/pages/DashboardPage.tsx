import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, ShieldAlert, Users } from "lucide-react";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { RoleGate } from "../components/RoleGate";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/authApi";
import { AppShell } from "../components/layout/AppShell";
import { FormAlert } from "../components/common/FormAlert";
import { PageHeader } from "../components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { visibleSections } from "../lib/nav";
import { resolveTier, roleLabel } from "../lib/roles";

function DashboardContent() {
  const { user } = useAuth();
  const tier = resolveTier(user?.role);
  const hasRole = !!user?.role;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.email?.split("@")[0] ?? "there"}`}
        description={
          hasRole
            ? `Signed in as ${roleLabel(user?.role)}.`
            : "Your account is active but no role has been assigned yet."
        }
        action={
          hasRole ? (
            <Badge className="bg-navy text-white hover:bg-navy">
              {roleLabel(user?.role)}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-warning/40 text-warning">
              Role pending
            </Badge>
          )
        }
      />

      {!hasRole && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <ShieldAlert className="size-5 shrink-0 text-warning" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold text-navy">Waiting for role assignment</p>
              <p className="mt-1 text-muted-foreground">
                Modules stay locked until a system administrator assigns your role.
                You will receive an email as soon as that happens.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <RoleGate allow={["system_admin"]}>
        <AdminOverview />
      </RoleGate>

      {hasRole && <ModuleStatus tier={tier} />}
    </div>
  );
}

/** Counts come straight from the two endpoints that already exist. Nothing invented. */
function AdminOverview() {
  const [counts, setCounts] = useState<{ users: number; pending: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([authApi.getUsers(), authApi.getPendingUsers()])
      .then(([users, pending]) => {
        if (!active) return;
        setCounts({ users: users.length, pending: pending.length });
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("Account figures could not be loaded. Reload the page to try again.");
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-navy">Accounts</h3>
      <FormAlert message={error} className="mb-3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<Users className="size-5" />}
          label="Registered accounts"
          value={counts?.users}
          isLoading={isLoading}
          to="/admin/users"
          linkLabel="Manage users"
        />
        <StatCard
          icon={<Clock className="size-5" />}
          label="Waiting for a role"
          value={counts?.pending}
          isLoading={isLoading}
          to="/admin/pending-users"
          linkLabel="Review requests"
          highlight={!!counts?.pending}
        />
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  isLoading,
  to,
  linkLabel,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  isLoading: boolean;
  to: string;
  linkLabel: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-gold/50" : undefined}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-9 w-16" />
            ) : (
              <p className="mt-1 font-mono text-3xl font-semibold text-navy tabular-nums">
                {value ?? "—"}
              </p>
            )}
          </div>
          <span
            className={`grid size-10 place-items-center rounded-lg ${
              highlight ? "bg-gold/15 text-gold" : "bg-secondary text-navy"
            }`}
          >
            {icon}
          </span>
        </div>
        <Button asChild variant="link" className="mt-3 h-auto p-0 text-navy">
          <Link to={to}>
            {linkLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Honest build status instead of placeholder charts. Reads the same nav config
 * the sidebar uses, so the two can never disagree.
 */
function ModuleStatus({ tier }: { tier: ReturnType<typeof resolveTier> }) {
  const sections = visibleSections(tier).filter((s) => s.heading !== "Overview");
  const total = sections.flatMap((s) => s.items).length;
  const ready = sections.flatMap((s) => s.items).filter((i) => i.ready).length;

  if (total === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-navy">Your modules</h3>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {ready} of {total} available
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.heading}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-navy">{section.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.to}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span
                      className={item.ready ? "text-foreground" : "text-muted-foreground"}
                    >
                      {item.label}
                    </span>
                    {item.ready ? (
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                        <Link to={item.to}>Open</Link>
                      </Button>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground/70">
                        Not built yet
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Dashboard">
        <DashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}