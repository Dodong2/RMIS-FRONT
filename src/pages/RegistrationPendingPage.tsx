import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export default function RegistrationPendingPage() {
  return (
    <AuthShell title="Request received" subtitle="Your account is waiting for approval">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-lspu-green/25 bg-lspu-green/5 p-4">
          <MailCheck className="size-5 shrink-0 text-lspu-green" />
          <div className="text-sm leading-relaxed text-foreground">
            <p className="font-semibold text-navy">What happens next</p>
            <p className="mt-1 text-muted-foreground">
              A system administrator reviews your request and assigns your role.
              You will get an email at the address you registered once that is
              done, and you can sign in from there.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Nothing is needed from you in the meantime. If a week passes with no
          email, contact the Research and Development Office.
        </p>

        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}