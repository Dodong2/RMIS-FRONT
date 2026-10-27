import { useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "../components/auth/AuthShell";
import { GoogleButton } from "../components/auth/GoogleButton";
import { AuthDivider, AuthHint, AuthInput, AuthLabel, AuthSubmit, EyeToggle } from "../components/auth/AuthFields";
import { RegistrationProfileFields } from "../components/auth/RegistrationProfileFields";
import { notify } from "../lib/notify";
import { errorMessage } from "../lib/errorMessage";
import { EMPTY_PROFILE, fieldErrors, profilePayload, profileProblems, type RegistrationProfile } from "../lib/registration";

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profile, setProfile] = useState<RegistrationProfile>(EMPTY_PROFILE);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);

  const passwordsMatch = password === password2;
  const problems = profileProblems(profile);
  const profileErrors = { ...(attempted ? problems : {}), ...serverErrors };

  const changeProfile = (patch: Partial<RegistrationProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    setServerErrors((errors) => Object.fromEntries(Object.entries(errors).filter(([field]) => !(field in patch))));
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setAttempted(true);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !password2 || Object.keys(problems).length) {
      notify.error("Fill in every field. The ones still missing or invalid are marked in red.");
      return;
    }

    if (!passwordsMatch) {
      notify.error("The two passwords do not match. Retype them and submit again.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
        password2,
        ...profilePayload(profile),
      });
    } catch (err) {
      setServerErrors(fieldErrors(err));
      notify.error(errorMessage(err, "The account could not be created. Check the fields marked in red and try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsGooglePending(true);
    try {
      await loginWithGoogle("register");
    } catch {
      setIsGooglePending(false);
      notify.error("Google sign-up could not start. Check your connection and try again.");
    }
  };

  return (
    <AuthShell
      title="Request Access"
      subtitle="Verify your e-mail, then an administrator confirms your role before your account opens"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-bold hover:underline" style={{ color: "#0891b2" }}>
            Sign in
          </Link>
        </>
      }
    >
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

        <div>
          <AuthLabel htmlFor="email" required>Email</AuthLabel>
          <AuthInput
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@lspu.edu.ph"
            required
            invalid={attempted && !email.trim()}
          />
        </div>

        <div>
          <AuthLabel htmlFor="password" required>Password</AuthLabel>
          <div className="relative">
            <AuthInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters, not only numbers"
              required
              className="pr-11"
              invalid={(attempted && !password) || !!serverErrors.password}
            />
            <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
          {serverErrors.password && <AuthHint tone="error">{serverErrors.password}</AuthHint>}
        </div>

        <div>
          <AuthLabel htmlFor="password2" required>Confirm Password</AuthLabel>
          <AuthInput
            id="password2"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Retype your password"
            required
            invalid={(password2.length > 0 && !passwordsMatch) || (attempted && !password2)}
          />
          {password2.length > 0 && !passwordsMatch && <AuthHint tone="error">The passwords do not match yet.</AuthHint>}
        </div>

        <RegistrationProfileFields value={profile} onChange={changeProfile} errors={profileErrors} />

        <AuthSubmit busy={isSubmitting} busyLabel="Submitting…">Submit Request</AuthSubmit>
      </form>

      <AuthDivider />

      <GoogleButton
        label="Sign up with Google"
        onClick={handleGoogle}
        isPending={isGooglePending}
        disabled={isSubmitting}
      />
    </AuthShell>
  );
}
