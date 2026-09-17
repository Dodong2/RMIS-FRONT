import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Users as UsersIcon } from "lucide-react";
import { authApi } from "../../lib/authApi";
import type { User, AdminUser } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { FormAlert } from "../../components/common/FormAlert";
import { EmptyState, PageHeader, TableSkeletonRows } from "../../components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "../../lib/roles";

function UsersListContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      setUsers(await authApi.getUsers());
      setError("");
    } catch {
      setError("The user list could not be loaded. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.role?.name ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every account on the system, with the role currently assigned to it."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <FormAlert message={error} className="mb-4" />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or role"
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={6} columns={3} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={<UsersIcon className="size-7" />}
                    title={query ? "No matching users" : "No users yet"}
                    description={
                      query
                        ? "Try a different email or role name."
                        : "Accounts appear here as soon as people register."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    {u.role ? (
                      roleLabel(u.role)
                    ) : (
                      <span className="text-muted-foreground">Not assigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <Badge className="border-0 bg-lspu-green/12 text-lspu-green hover:bg-lspu-green/12">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {!isLoading && filtered.length > 0 && (
        <p className="mt-3 font-mono text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {users.length} accounts
        </p>
      )}
    </div>
  );
}

export default function UsersListPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Users">
        <UsersListContent />
      </AppShell>
    </ProtectedRoute>
  );
}