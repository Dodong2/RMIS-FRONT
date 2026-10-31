import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../lib/authApi";
import { supabase } from "../lib/supabaseClient";
import { AuthShell } from "../components/auth/AuthShell";
import { AuthHint, AuthInput, AuthLabel, AuthSubmit } from "../components/auth/AuthFields";
import { RegistrationProfileFields } from "../components/auth/RegistrationProfileFields";
import { notify } from "../lib/notify";
import { errorMessage } from "../lib/errorMessage";
import { EMPTY_PROFILE, fieldErrors, profilePayload, profileProblems, type RegistrationProfile } from "../lib/registration";

export default function GoogleChooseRolePage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profile, setProfile] = useState<RegistrationProfile>(EMPTY_PROFILE);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const problems = profileProblems(profile);
  const profileErrors = { ...(attempted ? problems : {}), ...serverErrors };

  const changeProfile = (patch: Partial<RegistrationProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    setServerErrors((errors) => Object.fromEntries(Object.entries(errors).filter(([field]) => !(field in patch))));
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();

    const token = sessionStorage.getItem("pending_google_token");
    if (!token) {
      navigate("/register", { replace: true });
      return;
    }
    setAttempted(true);
    if (!firstName.trim() || !lastName.trim() || Object.keys(problems).length) {
      notify.error("Fill in every field. The ones still missing or invalid are marked in red.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.googleRequestRole(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...profilePayload(profile),
      });
      sessionStorage.removeItem("pending_google_token");
      await supabase.auth.signOut();
      navigate("/registration-pending");
    } catch (err) {
      setServerErrors(fieldErrors(err));
      notify.error(errorMessage(err, "The request could not be submitted. Check the fields marked in red and try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell scrollBody title="One More Step" subtitle="Complete your details so an administrator can review your request">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <AuthLabel htmlFor="first_name" required>First Name</AuthLabel>
            <AuthInput
              id="first_name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Aimee Concepcion"
              required
              invalid={attempted && !firstName.trim()}
            />
          </div>
          <div>
            <AuthLabel htmlFor="last_name" required>Last Name</AuthLabel>
            <AuthInput
              id="last_name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Chavez"
              required
              invalid={attempted && !lastName.trim()}
            />
          </div>
        </div>
        <RegistrationProfileFields value={profile} onChange={changeProfile} errors={profileErrors} />
        <AuthHint>Your Google account is already verified, so no password or verification e-mail is needed.</AuthHint>

        <AuthSubmit busy={isSubmitting} busyLabel="Submitting…">
          Submit Request
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
