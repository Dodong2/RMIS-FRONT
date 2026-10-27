import type { AccountState, Gender, RegistrationProfilePayload } from "../types/auth";

// Same rules as the backend (rmis-backend accounts/models.py STAFF_ID_PATTERN, MOBILE_PATTERN); change both together.
export const STAFF_ID_PATTERN = /^\d{6}$/;
export const STAFF_ID_HINT = "6 digits, e.g. 123456";
export const MOBILE_PATTERN = /^(09|\+639)\d{9}$/;
export const MOBILE_HINT = "e.g. 09171234567 or +639171234567";

export interface RegistrationProfile {
  gender: Gender | "";
  campus: string;
  college_unit: string;
  mobile_number: string;
  staff_id: string;
  requested_role: string;
}

export type ProfileField = keyof RegistrationProfile;

export const EMPTY_PROFILE: RegistrationProfile = {
  gender: "", campus: "", college_unit: "", mobile_number: "", staff_id: "", requested_role: "",
};

const REQUIRED: Record<ProfileField, string> = {
  gender: "Choose your gender.",
  campus: "Choose your campus.",
  college_unit: "Choose your College Unit.",
  mobile_number: "Enter your mobile number.",
  staff_id: "Enter your Staff ID.",
  requested_role: "Choose the role you are requesting.",
};

export function profileProblems(profile: RegistrationProfile): Partial<Record<ProfileField, string>> {
  const problems: Partial<Record<ProfileField, string>> = {};
  for (const field of Object.keys(REQUIRED) as ProfileField[]) {
    if (!profile[field].trim()) problems[field] = REQUIRED[field];
  }
  if (!problems.staff_id && !STAFF_ID_PATTERN.test(profile.staff_id.trim())) problems.staff_id = "Staff ID must be 6 digits.";
  if (!problems.mobile_number && !MOBILE_PATTERN.test(profile.mobile_number.trim())) {
    problems.mobile_number = `Enter a mobile number like ${MOBILE_HINT.replace("e.g. ", "")}.`;
  }
  return problems;
}

export function profilePayload(profile: RegistrationProfile): RegistrationProfilePayload {
  return {
    gender: profile.gender,
    campus: profile.campus,
    college_unit: profile.college_unit,
    mobile_number: profile.mobile_number.trim(),
    staff_id: profile.staff_id.trim(),
    requested_role: profile.requested_role ? Number(profile.requested_role) : null,
  };
}

/** The backend's field-keyed 400 ({"staff_id": ["..."]}) as one message per field. */
export function fieldErrors(err: unknown): Record<string, string> {
  const data = (err as { response?: { status?: number; data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return {};
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(data as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (field !== "detail" && typeof first === "string") errors[field] = first;
  }
  return errors;
}

/** Why the login was refused, when the password was right but the account can't sign in (backend login_block). */
export function loginBlock(err: unknown): { state: AccountState; message: string } | null {
  const data = (err as { response?: { data?: { account_state?: unknown; detail?: unknown } } })?.response?.data;
  const state = Array.isArray(data?.account_state) ? data.account_state[0] : data?.account_state;
  const detail = Array.isArray(data?.detail) ? data.detail[0] : data?.detail;
  if (typeof state !== "string" || typeof detail !== "string") return null;
  return { state: state as AccountState, message: detail };
}
