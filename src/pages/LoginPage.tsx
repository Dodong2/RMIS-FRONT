import { useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "../components/auth/AuthShell";
import { GoogleButton } from "../components/auth/GoogleButton";
import { notify } from "../lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setAttempted(true);
    if (!email.trim() || !password) {
      notify.error("Enter your email and password to sign in.");
      return;
    }
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch {
      const message =
        "That email and password did not match, or the account is still waiting for admin confirmation.";
      setError(message);
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setIsGooglePending(true);
    try {
      await loginWithGoogle("login");
    } catch {
      setIsGooglePending(false);
      const message = "Google sign-in could not start. Check your connection and try again.";
      setError(message);
      notify.error(message);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your LSPU account to continue"
      footer={
        <>
          No account yet?{" "}
          <Link
            to="/register"
            className="font-semibold text-gold-light underline-offset-4 hover:underline"
          >
            Request access
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email<span className="text-destructive" aria-hidden="true"> *</span></Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@lspu.edu.ph"
            required
            aria-invalid={!!error || (attempted && !email.trim())}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password<span className="text-destructive" aria-hidden="true"> *</span></Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              className="pr-10"
              aria-invalid={!!error || (attempted && !password)}
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <GoogleButton
        label="Continue with Google"
        onClick={handleGoogle}
        isPending={isGooglePending}
        disabled={isSubmitting}
      />
    </AuthShell>
  );
}