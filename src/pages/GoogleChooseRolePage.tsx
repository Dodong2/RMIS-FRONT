import { useState, useEffect, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../lib/authApi";
import { supabase } from "../lib/supabaseClient";
import type { Role } from "../types/auth";
import { AuthShell } from "../components/auth/AuthShell";
import { AUTH_SELECT_TRIGGER, AuthHint, AuthLabel, AuthSubmit } from "../components/auth/AuthFields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "../lib/notify";

export default function GoogleChooseRolePage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [requestedRole, setRequestedRole] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    authApi
      .getRoles()
      .then((data) => active && setRoles(data))
      .catch(() => {
        if (!active) return;
        setRoles([]);
        notify.error("The role list could not be loaded. Reload the page to try again.");
      })
      .finally(() => active && setRolesLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    const token = sessionStorage.getItem("pending_google_token");
    if (!token) {
      navigate("/register", { replace: true });
      return;
    }
    setAttempted(true);
    if (!requestedRole) {
      notify.error("Choose the role you are requesting before you submit.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.googleRequestRole(token, Number(requestedRole));
      sessionStorage.removeItem("pending_google_token");
      await supabase.auth.signOut();
      navigate("/registration-pending");
    } catch {
      notify.error("The request could not be submitted. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="One More Step" subtitle="Tell us which role you need so an administrator can review it">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <AuthLabel htmlFor="role" required>Role You Are Requesting</AuthLabel>
          {rolesLoading ? (
            <div className="h-12 w-full rounded-xl animate-pulse" style={{ background: "#e2e8f0" }} />
          ) : (
            <Select value={requestedRole} onValueChange={setRequestedRole} disabled={roles.length === 0}>
              <SelectTrigger id="role" className={AUTH_SELECT_TRIGGER} aria-invalid={attempted && !requestedRole}>
                <SelectValue placeholder={roles.length === 0 ? "No roles available" : "Choose a role"} />
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
          <AuthHint>Your Google account is already verified. Only the role is still needed.</AuthHint>
        </div>

        <AuthSubmit busy={isSubmitting} busyLabel="Submitting…" disabled={rolesLoading}>
          Submit Request
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
