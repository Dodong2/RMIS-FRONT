import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";

export default function RegistrationPendingPage() {
  return (
    <AuthShell scrollBody title="Request Received" subtitle="Two steps before your account opens">
      <div className="space-y-5">
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "#d1fae5", border: "1px solid #6ee7b7" }}>
          <Mail size={20} color="#059669" className="shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm leading-relaxed">
            <p className="font-black" style={{ color: "#065f46" }}>What happens next</p>
            <p className="mt-1" style={{ color: "#047857" }}>
              1. If you registered with your e-mail and password, open the verification link we sent to your e-mail
              within 48 hours. If you signed up with Google, your e-mail is already verified.
            </p>
            <p className="mt-1" style={{ color: "#047857" }}>
              2. A system administrator then reviews your request and assigns your role. You will get an e-mail once
              that is done, and you can sign in from there.
            </p>
          </div>
        </div>

        <p className="text-sm" style={{ color: "#64748b" }}>
          No verification e-mail? Check your spam folder, or sign in with your e-mail and password to send a new
          link. If a week passes with no answer, contact the Research and Development Office.
        </p>

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
