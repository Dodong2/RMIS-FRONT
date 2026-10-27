import { useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "../components/auth/AuthShell";
import { GoogleButton } from "../components/auth/GoogleButton";
import { notify } from "../lib/notify";
import { authApi } from "../lib/authApi";
import { errorMessage, throttledMessage } from "../lib/errorMessage";
import { loginBlock } from "../lib/registration";
import type { AccountState } from "../types/auth";
import { AuthDivider, AuthHint, AuthInput, AuthLabel, AuthSubmit, EyeToggle } from "../components/auth/AuthFields";

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [blockedState, setBlockedState] = useState<AccountState | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setBlockedState(null);
    setAttempted(true);
    if (!email.trim() || !password) {
      notify.error("Enter your email and password to sign in.");
      return;
    }
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch (err) {
      const blocked = loginBlock(err);
      const message = throttledMessage(err) ?? blocked?.message ?? "That email and password did not match.";
      setBlockedState(blocked?.state ?? null);
      setError(message);
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { detail } = await authApi.resendVerification(email.trim());
      notify.success(detail);
    } catch (err) {
      notify.error(errorMessage(err, "A new link could not be sent. Try again in a moment."));
    } finally {
      setIsResending(false);
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
      title="Sign In to RMIS"
      subtitle="Enter your LSPU account email and password"
      footer={
        <>
          No account yet?{" "}
          <Link to="/register" className="font-bold hover:underline" style={{ color: "#0891b2" }}>
            Request access
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
            invalid={!!error || (attempted && !email.trim())}
          />
        </div>

        <div>
          <AuthLabel htmlFor="password" required>Password</AuthLabel>
          <div className="relative">
            <AuthInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="pr-11"
              invalid={!!error || (attempted && !password)}
            />
            <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
          {error && <AuthHint tone="error">{error}</AuthHint>}
          {blockedState === "unverified" && (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="mt-2 text-xs font-bold hover:underline disabled:opacity-60"
              style={{ color: "#0891b2" }}
            >
              {isResending ? "Sending…" : "Send me a new verification link"}
            </button>
          )}
        </div>

        <AuthSubmit busy={isSubmitting} busyLabel="Signing in…">Sign In</AuthSubmit>
      </form>

      <AuthDivider />

      <GoogleButton
        label="Continue with Google"
        onClick={handleGoogle}
        isPending={isGooglePending}
        disabled={isSubmitting}
      />
    </AuthShell>
  );
}
