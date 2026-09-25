import { useState, useEffect, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/authApi";
import type { Role } from "../types/auth";
import { AuthShell } from "../components/auth/AuthShell";
import { GoogleButton } from "../components/auth/GoogleButton";
import {
  AUTH_SELECT_TRIGGER,
  AuthDivider,
  AuthHint,
  AuthInput,
  AuthLabel,
  AuthSubmit,
  EyeToggle,
} from "../components/auth/AuthFields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "../lib/notify";

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requestedRole, setRequestedRole] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);

  useEffect(() => {
    let active = true;
    authApi
      .getRoles()
      .then((data) => {
        if (!active) return;
        setRoles(data);
      })
      .catch(() => {
        if (!active) return;
        setRoles([]);
        notify.info("The role list could not be loaded. Reload the page to try again.");
      })
      .finally(() => {
        if (active) setRolesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const passwordsMatch = password === password2;

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setAttempted(true);

    if (!email.trim() || !password || !password2 || !requestedRole) {
      notify.error("Fill in all required fields: email, password, confirm password, and role.");
      return;
    }

    if (!passwordsMatch) {
      notify.error("The two passwords do not match. Retype them and submit again.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email,
        password,
        password2,
        requested_role: requestedRole ? Number(requestedRole) : null,
      });
    } catch {
      notify.error(
        "The account could not be created. The email may already be registered, or the password may be too short.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsGooglePending(true);
    try {
      await loginWithGoogle("register");
    } catch {
      setIsGooglePending(false);
      notify.error("Google sign-up could not start. Check your connection and try again.");
    }
  };

  return (
    <AuthShell
      title="Request Access"
      subtitle="An administrator confirms your role before your account opens"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-bold hover:underline" style={{ color: "#0891b2" }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <AuthLabel htmlFor="email" required>Email</AuthLabel>
          <AuthInput
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@lspu.edu.ph"
            required
            invalid={attempted && !email.trim()}
          />
        </div>

        <div>
          <AuthLabel htmlFor="password" required>Password</AuthLabel>
          <div className="relative">
            <AuthInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="pr-11"
              invalid={attempted && !password}
            />
            <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </div>

        <div>
          <AuthLabel htmlFor="password2" required>Confirm Password</AuthLabel>
          <AuthInput
            id="password2"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Retype your password"
            required
            invalid={(password2.length > 0 && !passwordsMatch) || (attempted && !password2)}
          />
          {password2.length > 0 && !passwordsMatch && <AuthHint tone="error">The passwords do not match yet.</AuthHint>}
        </div>

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
          <AuthHint>An administrator can assign a different role than the one you request.</AuthHint>
        </div>

        <AuthSubmit busy={isSubmitting} busyLabel="Submitting…">Submit Request</AuthSubmit>
      </form>

      <AuthDivider />

      <GoogleButton
        label="Sign up with Google"
        onClick={handleGoogle}
        isPending={isGooglePending}
        disabled={isSubmitting}
      />
    </AuthShell>
  );
}
