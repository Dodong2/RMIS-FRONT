import { useEffect, useMemo, useState } from "react";
import { Ban, Check, RefreshCw, RotateCcw, Search, Users as UsersIcon } from "lucide-react";
import { authApi } from "../../lib/authApi";
import type { AdminUser, Role } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { FormAlert } from "../../components/common/FormAlert";
import { EmptyState, PageHeader, TableSkeletonRows } from "../..//components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function UsersListContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [pendingRole, setPendingRole] = useState<Record<number, string>>({});
  const [savingRole, setSavingRole] = useState<number | null>(null);
  const [togglingActive, setTogglingActive] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [userList, roleList] = await Promise.all([authApi.getUsers(), authApi.getRoles()]);
      setUsers(userList);
      setRoles(roleList);
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

  const handleSaveRole = async (userId: number) => {
    const roleId = pendingRole[userId];
    if (!roleId) return;
    setSavingRole(userId);
    try {
      await authApi.updateUserRole(userId, Number(roleId));
      setError("");
      await load();
      setPendingRole((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch {
      setError("Could not update the role. Try again.");
    } finally {
      setSavingRole(null);
    }
  };

  const handleToggleActive = async (userId: number) => {
    setTogglingActive(userId);
    try {
      await authApi.toggleUserActive(userId);
      setError("");
      await load();
    } catch {
      setError("Could not update the account status. Try again.");
    } finally {
      setTogglingActive(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every confirmed account on the system, with the role currently assigned to it."
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
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={6} columns={4} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    icon={<UsersIcon className="size-7" />}
                    title={query ? "No matching users" : "No users yet"}
                    description={
                      query
                        ? "Try a different email or role name."
                        : "Confirmed accounts appear here once an admin assigns a role."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const draftRoleId = pendingRole[u.id] ?? (u.role ? String(u.role.id) : "");
                const hasChange = draftRoleId !== "" && draftRoleId !== String(u.role?.id ?? "");

                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={draftRoleId}
                          onValueChange={(value) =>
                            setPendingRole((prev) => ({ ...prev, [u.id]: value }))
                          }
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={String(role.id)}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {hasChange && (
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleSaveRole(u.id)}
                            disabled={savingRole === u.id}
                          >
                            <Check className="size-4" />
                            {savingRole === u.id ? "Saving..." : "Save"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge className="border-0 bg-lspu-green/12 text-lspu-green hover:bg-lspu-green/12">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Deactivated
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={u.is_active ? "outline" : "secondary"}
                        onClick={() => handleToggleActive(u.id)}
                        disabled={togglingActive === u.id}
                      >
                        {u.is_active ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
                        {togglingActive === u.id ? "Working..." : u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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