import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { authApi } from "../lib/authApi";
import { setTokens } from "../lib/tokenStorage";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const exchange = async () => {
      const { data } = await supabase.auth.getSession();
      const supabaseAccessToken = data.session?.access_token;

      if (!supabaseAccessToken) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const result = await authApi.googleExchange(supabaseAccessToken);
        setTokens(result.access, result.refresh);
        await supabase.auth.signOut();
        navigate(result.is_pending_role ? "/pending-role" : "/dashboard", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    };

    exchange();
  }, [navigate]);

  return <div>Signing you in...</div>;
}