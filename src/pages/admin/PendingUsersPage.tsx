import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { authApi } from "../../lib/authApi";
import type { PendingUser, Role } from "../../types/auth";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { FormAlert } from "../../components/common/FormAlert";
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

function PendingUsersContent() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      const [pending, roleList] = await Promise.all([
        authApi.getPendingUsers(),
        authApi.getRoles(),
      ]);
      setPendingUsers(pending);
      setRoles(roleList);
      setError("");
    } catch {
      setError(
        "Pending registrations could not be loaded. Check your connection and refresh.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAssign = async (userId: number, email: string) => {
    const roleId = selectedRoles[userId];
    if (!roleId) {
      setMessage("");
      setError("Choose a role for that account before assigning it.");
      return;
    }

    setError("");
    setMessage("");
    setAssigningId(userId);
    try {
      await authApi.assignRole(userId, Number(roleId));
      setMessage(`Role assigned. A confirmation email was sent to ${email}.`);
      await load();
    } catch {
      setError(`The role could not be assigned to ${email}. Try again in a moment.`);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pending registrations"
        description="Assign a role to open the account. The person is emailed once you do."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <FormAlert message={error} className="mb-4" />
      <FormAlert tone="success" message={message} className="mb-4" />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Email</TableHead>
              <TableHead className="w-32">Signed up via</TableHead>
              <TableHead className="w-48">Requested role</TableHead>
              <TableHead className="w-56">Assign role</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={4} columns={5} />
            ) : pendingUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={<CheckCircle2 className="size-7 text-lspu-green" />}
                    title="Nothing waiting"
                    description="Every registration has been reviewed. New requests show up here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              pendingUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal capitalize">
                      {u.registration_method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.requested_role?.name ?? (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={selectedRoles[u.id] ?? ""}
                      onValueChange={(v) =>
                        setSelectedRoles({ ...selectedRoles, [u.id]: v })
                      }
                      disabled={assigningId !== null}
                    >
                      <SelectTrigger className="w-full" aria-label={`Role for ${u.email}`}>
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
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleAssign(u.id, u.email)}
                      disabled={assigningId !== null || !selectedRoles[u.id]}
                      className="w-full"
                    >
                      {assigningId === u.id && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      {assigningId === u.id ? "Assigning…" : "Assign"}
                    </Button>
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

export default function PendingUsersPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Pending registrations">
        <PendingUsersContent />
      </AppShell>
    </ProtectedRoute>
  );
}