import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { AuthHint, AuthInput, AuthLabel, AuthSubmit } from "../components/auth/AuthFields";
import { authApi } from "../lib/authApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";

type Result = { ok: boolean; message: string } | null;

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<Result>(null);
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const uid = params.get("uid") ?? "";
    const token = params.get("token") ?? "";
    authApi
      .verifyEmail(uid, token)
      .then(({ detail }) => setResult({ ok: true, message: detail }))
      .catch((err) => setResult({ ok: false, message: errorMessage(err, "This link is invalid, already used or expired.") }));
  }, [params]);

  const handleResend = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      notify.error("Enter the e-mail you registered with.");
      return;
    }
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

  return (
    <AuthShell title="Verify Your E-mail" subtitle="Confirming the address you registered with">
      <div className="space-y-5">
        {!result && <div className="h-16 w-full rounded-xl animate-pulse" style={{ background: "#e2e8f0" }} />}
        {result && (
          <div
            className="px-4 py-3 rounded-xl text-sm leading-relaxed"
            style={result.ok
              ? { background: "#d1fae5", border: "1px solid #6ee7b7", color: "#065f46" }
              : { background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" }}
          >
            <p className="font-black">{result.ok ? "E-mail verified" : "This link didn't work"}</p>
            <p className="mt-1">{result.message}</p>
          </div>
        )}

        {result && !result.ok && (
          <form onSubmit={handleResend} className="space-y-3" noValidate>
            <div>
              <AuthLabel htmlFor="email" required>Send me a new link</AuthLabel>
              <AuthInput
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@lspu.edu.ph"
              />
              <AuthHint>The new link also works once and expires in 48 hours.</AuthHint>
            </div>
            <AuthSubmit busy={isResending} busyLabel="Sending…">Send New Link</AuthSubmit>
          </form>
        )}

        <Link
          to="/login"
          className="w-full flex items-center justify-center py-3 rounded-xl border-2 border-[#e2e8f0] bg-white text-sm font-bold transition-all hover:border-[#0891b2]"
          style={{ color: "#0d2a5e" }}
        >
          Back to Sign In
        </Link>
      </div>
    </AuthShell>
  );
}
