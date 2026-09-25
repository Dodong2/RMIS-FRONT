import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

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
    <div
      className="grid min-h-screen place-items-center p-6"
      style={{ background: "linear-gradient(150deg, #05122e 0%, #0d2a5e 55%, #1a3f7a 100%)" }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xl mb-6">
          <span className="text-base font-black" style={{ color: "#0d2a5e" }}>LSPU</span>
        </div>

        {failed ? (
          <>
            <h1 className="text-lg font-black text-white">Sign-in did not complete</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Google returned you here, but the session could not be verified. This usually means the sign-in window
              was closed too early.
            </p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-5 px-5 py-2.5 rounded-xl bg-white text-sm font-bold"
              style={{ color: "#0d2a5e" }}
            >
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            <Loader2 className="size-6 animate-spin" style={{ color: "#67e8f9" }} />
            <p className="mt-4 text-sm font-bold text-white">Signing you in</p>
            <p className="mt-1 text-xs text-white/50">Verifying your Google account with LSPU–RMIS</p>
          </>
        )}
      </div>
    </div>
  );
}
