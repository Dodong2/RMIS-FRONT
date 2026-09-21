import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { personnelApi } from "../lib/personnelApi";
import { ROLE_META } from "../lib/roles";
import type { LeaderLoad } from "../types/personnel";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "../lib/notify";

function CountBadge({ count, cap }: { count: number; cap: number }) {
  return (
    <Badge variant={count >= cap ? "destructive" : "outline"}>
      {count} / {cap}
    </Badge>
  );
}

function LeaderLoadContent() {
  const [leaders, setLeaders] = useState<LeaderLoad[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    personnelApi
      .getLeaderLoad()
      .then((data) => {
        setLeaders(
          [...data].sort(
            (a, b) =>
              b.active_programs + b.active_projects - (a.active_programs + a.active_projects),
          ),
        );
      })
      .catch(() => notify.error("Could not load leader workload. Check your connection and refresh."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Leader load"
        description="Active programs and projects each leader currently handles, against the concurrency limits."
      />

      <p className="mb-4 max-w-prose text-xs text-muted-foreground">
        A leader may lead up to 2 active programs and 3 active projects. Institutional-funded
        records are stricter: a leader who already leads any active record cannot take on another
        institutional-funded one.
      </p>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Leader</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active Programs</TableHead>
              <TableHead>Active Projects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={4} columns={4} />
            ) : leaders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    icon={<Gauge className="size-7" />}
                    title="No leaders yet"
                    description="Active program and project leaders will appear here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              leaders.map((l) => (
                <TableRow key={l.user}>
                  <TableCell className="font-medium">{l.email}</TableCell>
                  <TableCell>{ROLE_META[l.role]?.name ?? l.role}</TableCell>
                  <TableCell>
                    <CountBadge count={l.active_programs} cap={l.program_cap} />
                  </TableCell>
                  <TableCell>
                    <CountBadge count={l.active_projects} cap={l.project_cap} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function LeaderLoadPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Leader load">
        <LeaderLoadContent />
      </AppShell>
    </ProtectedRoute>
  );
}
