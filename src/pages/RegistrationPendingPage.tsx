import { Link } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";

export default function RegistrationPendingPage() {
  return (
    <AuthShell title="Request Received" subtitle="Your account is waiting for approval">
      <div className="space-y-5">
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "#d1fae5", border: "1px solid #6ee7b7" }}>
          <svg width="20" height="20" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0 mt-0.5">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-sm leading-relaxed">
            <p className="font-black" style={{ color: "#065f46" }}>What happens next</p>
            <p className="mt-1" style={{ color: "#047857" }}>
              A system administrator reviews your request and assigns your role. You will get an email at the address
              you registered once that is done, and you can sign in from there.
            </p>
          </div>
        </div>

        <p className="text-sm" style={{ color: "#64748b" }}>
          Nothing is needed from you in the meantime. If a week passes with no email, contact the Research and
          Development Office.
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
