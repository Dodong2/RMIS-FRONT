import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { authApi } from "../../lib/authApi";
import type { AdminUser, AuditLog } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyOption } from "../../components/common/EmptyOption";
import { FieldLabel } from "../../components/common/FieldLabel";
import { EmptyState, PageHeader, TableSkeletonRows } from "../../components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "../../lib/notify";

const METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

function StatusBadge({ code }: { code: number }) {
  if (code >= 500) return <Badge variant="destructive">{code}</Badge>;
  if (code >= 400) return <Badge variant="outline" className="text-destructive">{code}</Badge>;
  return <Badge variant="outline">{code}</Badge>;
}

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actor, setActor] = useState("");
  const [method, setMethod] = useState("");

  const load = async (params: { actor?: number; method?: string }) => {
    setIsLoading(true);
    try {
      setLogs(await authApi.getAuditLogs(params));
    } catch {
      notify.error("Could not load the audit log. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setUsers(await authApi.getUsers());
      } catch {
        notify.error("Could not load the user list for the actor filter.");
      }
      await load({});
    })();
  }, []);

  const applyFilters = (nextActor: string, nextMethod: string) =>
    load({ actor: nextActor ? Number(nextActor) : undefined, method: nextMethod || undefined });

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Every authenticated mutating API call (POST/PUT/PATCH/DELETE), logged by the request middleware — who called what, when, and what it returned. Not a per-field change history."
        action={
          <Button variant="outline" size="sm" onClick={() => applyFilters(actor, method)} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="w-72">
          <FieldLabel>Actor</FieldLabel>
          <Select
            value={actor}
            onValueChange={(v) => {
              const next = v === "all" ? "" : v;
              setActor(next);
              applyFilters(next, method);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.length === 0 && <EmptyOption message="No users found" />}
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <FieldLabel>Method</FieldLabel>
          <Select
            value={method}
            onValueChange={(v) => {
              const next = v === "all" ? "" : v;
              setMethod(next);
              applyFilters(actor, next);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={8} columns={6} />
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState icon={<Activity className="size-7" />} title="No matching audit log entries" />
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell>{l.actor_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.method}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.path}</TableCell>
                  <TableCell>
                    <StatusBadge code={l.status_code} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.ip_address ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Audit Logs">
        <AuditLogsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
