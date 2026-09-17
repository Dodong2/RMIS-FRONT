import { useState, useEffect, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/authApi";
import type { Role } from "../types/auth";
import { AuthShell } from "../components/auth/AuthShell";
import { GoogleButton } from "../components/auth/GoogleButton";
import { FormAlert } from "../components/common/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requestedRole, setRequestedRole] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);

  useEffect(() => {
    let active = true;
    setRolesLoading(true);
    authApi
      .getRoles()
      .then((data) => {
        if (!active) return;
        setRoles(data);
        setRolesError("");
      })
      .catch(() => {
        if (!active) return;
        setRoles([]);
        setRolesError("The role list could not be loaded. Reload the page to try again.");
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
    setError("");

    if (!passwordsMatch) {
      setError("The two passwords do not match. Retype them and submit again.");
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
      setError(
        "The account could not be created. The email may already be registered, or the password may be too short.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setIsGooglePending(true);
    try {
      await loginWithGoogle("register");
    } catch {
      setIsGooglePending(false);
      setError("Google sign-up could not start. Check your connection and try again.");
    }
  };

  return (
    <AuthShell
      title="Request access"
      subtitle="An administrator confirms your role before your account opens"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-gold-light underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />
        <FormAlert tone="info" message={rolesError} />

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@lspu.edu.ph"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground hover:text-navy"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password2">Confirm password</Label>
          <Input
            id="password2"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Retype your password"
            required
            aria-invalid={password2.length > 0 && !passwordsMatch}
          />
          {password2.length > 0 && !passwordsMatch && (
            <p className="text-xs text-destructive">The passwords do not match yet.</p>
          )}
        </div>

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
                  placeholder={
                    roles.length === 0 ? "No roles available" : "Choose a role"
                  }
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
            An administrator can assign a different role than the one you request.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Submitting…" : "Submit request"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <GoogleButton
        label="Sign up with Google"
        onClick={handleGoogle}
        isPending={isGooglePending}
        disabled={isSubmitting}
      />
    </AuthShell>
  );
}