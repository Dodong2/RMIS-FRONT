import { useState, useEffect, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../lib/authApi";
import { supabase } from "../lib/supabaseClient";
import type { Role } from "../types/auth";

export default function GoogleChooseRolePage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [requestedRole, setRequestedRole] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    authApi.getRoles().then(setRoles).catch(() => setRoles([]));
  }, []);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError("");
    const token = sessionStorage.getItem("pending_google_token");
    if (!token) {
      navigate("/register", { replace: true });
      return;
    }
    if (!requestedRole) {
      setError("Please choose a role.");
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.googleRequestRole(token, Number(requestedRole));
      sessionStorage.removeItem("pending_google_token");
      await supabase.auth.signOut();
      navigate("/registration-pending");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value)} required>
          <option value="">Choose role to request</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        {error && <p>{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}