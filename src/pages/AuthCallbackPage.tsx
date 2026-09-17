import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { completeGoogleLogin } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
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
    };

    run();
  }, [navigate, completeGoogleLogin]);

  return <div>Signing you in...</div>;
}