import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../lib/authApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { fieldErrors, MOBILE_HINT, MOBILE_PATTERN } from "../lib/registration";
import { roleLabel } from "../lib/roles";
import { BTN_GHOST_STYLE, BTN_PRIMARY, BTN_PRIMARY_STYLE, INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type { SelfProfile, SelfProfileUpdate } from "../types/auth";
import { useAuth } from "../context/AuthContext";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { Field, ProtoModal, SectionCard, SkeletonRows } from "../components/common/proto";
import { AppShell } from "../components/layout/AppShell";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const LOCKED_STYLE = { ...INPUT_STYLE, background: "#f1f5f9", color: "#475569" };

function ReadOnly({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Field label={label}>
      <input readOnly value={value || "—"} className={INPUT_CLS} style={LOCKED_STYLE} aria-readonly />
      {note && <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>{note}</p>}
    </Field>
  );
}

const genderLabel = (g: string) => GENDERS.find((x) => x.value === g)?.label ?? "";

function editsLeftText(n: number) {
  return n === 0
    ? "You have used all 3 profile edits. Your profile is locked; ask the RMIS System Admin to change it."
    : `You can change your profile ${n} more time${n === 1 ? "" : "s"}.`;
}

function EditProfileModal({ profile, onSaved, onClose }: { profile: SelfProfile; onSaved: (p: SelfProfile) => void; onClose: () => void }) {
  const [form, setForm] = useState<SelfProfileUpdate>({
    first_name: profile.first_name, last_name: profile.last_name, gender: profile.gender, mobile_number: profile.mobile_number,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const set = (key: keyof SelfProfileUpdate) => (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    const data = { ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), mobile_number: form.mobile_number.trim() };
    const problems: Record<string, string> = {};
    if (!data.first_name) problems.first_name = "Enter your first name.";
    if (!data.last_name) problems.last_name = "Enter your last name.";
    if (!data.gender) problems.gender = "Choose your gender.";
    if (!MOBILE_PATTERN.test(data.mobile_number)) problems.mobile_number = `Enter a mobile number like ${MOBILE_HINT.replace("e.g. ", "")}.`;
    setErrors(problems);
    if (Object.keys(problems).length) {
      notify.error("Fill in every field correctly.");
      return;
    }
    if ((Object.keys(data) as (keyof SelfProfileUpdate)[]).every((k) => data[k] === profile[k])) {
      notify.error("Nothing changed. Change at least one field.");
      return;
    }
    setIsSaving(true);
    try {
      const saved = await authApi.updateProfile(data);
      onSaved(saved);
      notify.success(`Profile updated. ${editsLeftText(saved.edits_left)}`);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      notify.error(errorMessage(err, "Could not update your profile."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Edit Profile"
      subtitle={editsLeftText(profile.edits_left)}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button onClick={onClose} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {isSaving ? "Saving…" : "Change profile info"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" required>
          <input value={form.first_name} onChange={set("first_name")} className={INPUT_CLS} style={invalidStyle(!!errors.first_name)} />
          {errors.first_name && <p className="mt-1 text-xs" style={{ color: "#dc2626" }}>{errors.first_name}</p>}
        </Field>
        <Field label="Last Name" required>
          <input value={form.last_name} onChange={set("last_name")} className={INPUT_CLS} style={invalidStyle(!!errors.last_name)} />
          {errors.last_name && <p className="mt-1 text-xs" style={{ color: "#dc2626" }}>{errors.last_name}</p>}
        </Field>
      </div>
      <Field label="Gender" required>
        <select value={form.gender} onChange={set("gender")} className={INPUT_CLS} style={invalidStyle(!!errors.gender)}>
          <option value="">Choose...</option>
          {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        {errors.gender && <p className="mt-1 text-xs" style={{ color: "#dc2626" }}>{errors.gender}</p>}
      </Field>
      <Field label="Mobile Number" required>
        <input value={form.mobile_number} onChange={set("mobile_number")} type="tel" className={INPUT_CLS} style={invalidStyle(!!errors.mobile_number)} placeholder={MOBILE_HINT} />
        {errors.mobile_number && <p className="mt-1 text-xs" style={{ color: "#dc2626" }}>{errors.mobile_number}</p>}
      </Field>
    </ProtoModal>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ old_password: "", new_password1: "", new_password2: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    const problems: Record<string, string> = {};
    if (!form.old_password) problems.old_password = "Enter your current password.";
    if (!form.new_password1) problems.new_password1 = "Enter a new password.";
    if (form.new_password1 !== form.new_password2) problems.new_password2 = "The two new passwords don't match.";
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setIsSaving(true);
    try {
      await authApi.changePassword(form);
      notify.success("Password changed.");
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      notify.error(errorMessage(err, "Could not change your password."));
    } finally {
      setIsSaving(false);
    }
  };

  const input = (key: keyof typeof form, label: string, autoComplete: string) => (
    <Field label={label} required>
      <input type="password" value={form[key]} onChange={set(key)} autoComplete={autoComplete} className={INPUT_CLS} style={invalidStyle(!!errors[key])} />
      {errors[key] && <p className="mt-1 text-xs" style={{ color: "#dc2626" }}>{errors[key]}</p>}
    </Field>
  );

  return (
    <ProtoModal
      title="Change Password"
      subtitle="Changing your password doesn't use a profile edit."
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button onClick={onClose} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {isSaving ? "Saving…" : "Change password"}
          </button>
        </>
      }
    >
      {input("old_password", "Current Password", "current-password")}
      {input("new_password1", "New Password", "new-password")}
      {input("new_password2", "Confirm New Password", "new-password")}
    </ProtoModal>
  );
}

function ProfileContent() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError } = useQuery({ queryKey: ["profile"], queryFn: authApi.getProfile });
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  if (isLoading) return <SkeletonRows rows={5} />;
  if (isError || !profile) return <p className="text-sm" style={{ color: "#dc2626" }}>Could not load your profile.</p>;

  const locked = profile.edits_left === 0;

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <SectionCard
        title="Profile Details"
        aside={
          <button onClick={() => setEditing(true)} disabled={locked} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
            Edit Profile
          </button>
        }
      >
        <div className="p-5 space-y-4">
          <p className="text-xs font-bold px-3 py-2 rounded-lg" style={locked ? { background: "#fef2f2", color: "#b91c1c" } : { background: "#f0f9ff", color: "#0369a1" }}>
            {editsLeftText(profile.edits_left)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadOnly label="First Name" value={profile.first_name} />
            <ReadOnly label="Last Name" value={profile.last_name} />
            <ReadOnly label="Gender" value={genderLabel(profile.gender)} />
            <ReadOnly label="Mobile Number" value={profile.mobile_number} />
            <ReadOnly label="Campus" value={profile.campus} note="Set by the RMIS System Admin." />
            <ReadOnly label="College Unit" value={profile.college_unit} note="Set by the RMIS System Admin." />
            <ReadOnly label="Role" value={roleLabel(profile.role)} />
            <ReadOnly label="Staff ID" value={profile.staff_id ?? ""} />
            <ReadOnly label="Email" value={profile.email} />
            <Field label="Password">
              {user?.has_password ? (
                <div className="flex gap-2">
                  <input readOnly type="password" value="••••••••" className={INPUT_CLS} style={LOCKED_STYLE} aria-label="Password (hidden)" />
                  <button onClick={() => setChangingPassword(true)} className="px-3 rounded-xl text-xs font-bold whitespace-nowrap" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                    Change Password
                  </button>
                </div>
              ) : (
                <input readOnly value="Signed in with Google — no password" className={INPUT_CLS} style={LOCKED_STYLE} />
              )}
            </Field>
          </div>
        </div>
      </SectionCard>

      {editing && (
        <EditProfileModal
          profile={profile}
          onSaved={(saved) => {
            queryClient.setQueryData(["profile"], saved);
            void refreshUser();
          }}
          onClose={() => setEditing(false)}
        />
      )}
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <AppShell title="My Profile">
        <ProfileContent />
      </AppShell>
    </ProtectedRoute>
  );
}
