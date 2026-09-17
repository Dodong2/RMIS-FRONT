import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { LspuMark } from "../components/common/LspuMark";
import { Button } from "@/components/ui/button";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { completeGoogleLogin } = useAuth();
  const hasRun = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const intent = sessionStorage.getItem("google_intent");
        sessionStorage.removeItem("google_intent");

        if (!token) {
          navigate("/login", { replace: true });
          return;
        }

        if (intent === "register") {
          sessionStorage.setItem("pending_google_token", token);
          navigate("/register/choose-role", { replace: true });
          return;
        }

        await completeGoogleLogin(token);
        await supabase.auth.signOut();
      } catch {
        setFailed(true);
      }
    };

    run();
  }, [navigate, completeGoogleLogin]);

  return (
    <div className="grid min-h-screen place-items-center bg-[linear-gradient(155deg,#081a3d_0%,#0d2a5e_55%,#1a3f7a_100%)] p-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <LspuMark size={52} className="mb-6" />

        {failed ? (
          <>
            <h1 className="text-lg font-bold text-white">Sign-in did not complete</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Google returned you here, but the session could not be verified.
              This usually means the sign-in window was closed too early.
            </p>
            <Button
              variant="secondary"
              className="mt-5"
              onClick={() => navigate("/login", { replace: true })}
            >
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-6 animate-spin text-gold" />
            <p className="mt-4 text-sm font-medium text-white">Signing you in</p>
            <p className="mt-1 text-xs text-white/50">
              Verifying your Google account with LSPU RMIS
            </p>
          </>
        )}
      </div>
    </div>
  );
}