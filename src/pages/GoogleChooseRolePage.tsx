import { useState, useEffect, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authApi } from "../lib/authApi";
import { supabase } from "../lib/supabaseClient";
import type { Role } from "../types/auth";
import { AuthShell } from "../components/auth/AuthShell";
import { FormAlert } from "../components/common/FormAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GoogleChooseRolePage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [requestedRole, setRequestedRole] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    authApi
      .getRoles()
      .then((data) => active && setRoles(data))
      .catch(() => {
        if (!active) return;
        setRoles([]);
        setError("The role list could not be loaded. Reload the page to try again.");
      })
      .finally(() => active && setRolesLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError("");

    const token = sessionStorage.getItem("pending_google_token");
    if (!token) {
      navigate("/register", { replace: true });
      return;
    }
    if (!requestedRole) {
      setError("Choose the role you are requesting before you submit.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.googleRequestRole(token, Number(requestedRole));
      sessionStorage.removeItem("pending_google_token");
      await supabase.auth.signOut();
      navigate("/registration-pending");
    } catch {
      setError("The request could not be submitted. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="One more step"
      subtitle="Tell us which role you need so an administrator can review it"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />

        <div className="space-y-1.5">
          <Label htmlFor="role">Role you are requesting</Label>
          {rolesLoading ? (
            <Skeleton className="h-9 w-full rounded-md" />
          ) : (
            <Select
              value={requestedRole}
              onValueChange={setRequestedRole}
              disabled={roles.length === 0}
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue
                  placeholder={roles.length === 0 ? "No roles available" : "Choose a role"}
                />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            Your Google account is already verified. Only the role is still needed.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting || rolesLoading}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </AuthShell>
  );
}