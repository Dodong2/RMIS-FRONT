import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../lib/authApi";
import { notify } from "../../lib/notify";
import { MOBILE_HINT, STAFF_ID_HINT, needsCollegeUnit, orderRequestableRoles, type ProfileField, type RegistrationProfile } from "../../lib/registration";
import { AUTH_SELECT_TRIGGER, AuthHint, AuthInput, AuthLabel } from "./AuthFields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RegistrationProfileFields({
  value,
  onChange,
  errors,
}: {
  value: RegistrationProfile;
  onChange: (patch: Partial<RegistrationProfile>) => void;
  errors: Partial<Record<ProfileField, string>>;
}) {
  const optionsQ = useQuery({ queryKey: ["registration-options"], queryFn: authApi.getRegistrationOptions });
  const options = optionsQ.data;

  useEffect(() => {
    if (optionsQ.isError) notify.error("The registration lists could not be loaded. Reload the page to try again.");
  }, [optionsQ.isError]);

  const roles = orderRequestableRoles(options?.roles ?? []);
  const collegeNeeded = needsCollegeUnit(value);

  const select = (
    field: ProfileField,
    label: string,
    items: { value: string; label: string }[],
    placeholder: string,
    opts: { off?: boolean; onPick?: (v: string) => void } = {},
  ) => (
    <div>
      <AuthLabel htmlFor={field} required={!opts.off}>{label}</AuthLabel>
      {optionsQ.isPending ? (
        <div className="h-12 w-full rounded-xl animate-pulse" style={{ background: "#e2e8f0" }} />
      ) : (
        <Select value={opts.off ? "" : value[field]} onValueChange={(v) => (opts.onPick ? opts.onPick(v) : onChange({ [field]: v }))} disabled={items.length === 0 || opts.off}>
          <SelectTrigger id={field} className={AUTH_SELECT_TRIGGER} aria-invalid={!!errors[field]}>
            <SelectValue placeholder={opts.off ? "Not needed for this role" : items.length === 0 ? "No options available" : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {errors[field] && <AuthHint tone="error">{errors[field]}</AuthHint>}
    </div>
  );

  const names = (list: string[] = []) => list.map((name) => ({ value: name, label: name }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {select("gender", "Gender", options?.genders ?? [], "Choose")}
        <div>
          <AuthLabel htmlFor="staff_id" required>Staff ID</AuthLabel>
          <AuthInput
            id="staff_id"
            inputMode="numeric"
            maxLength={6}
            value={value.staff_id}
            onChange={(e) => onChange({ staff_id: e.target.value.replace(/\D/g, "") })}
            placeholder={STAFF_ID_HINT}
            required
            invalid={!!errors.staff_id}
          />
          {errors.staff_id && <AuthHint tone="error">{errors.staff_id}</AuthHint>}
        </div>
      </div>

      {select("campus", "Campus", names(options?.campuses), "Choose your campus")}
      {select("college_unit", "College Unit", names(options?.college_units), "Choose your College Unit", { off: !collegeNeeded })}

      <div>
        <AuthLabel htmlFor="mobile_number" required>Mobile Number</AuthLabel>
        <AuthInput
          id="mobile_number"
          type="tel"
          autoComplete="tel"
          value={value.mobile_number}
          onChange={(e) => onChange({ mobile_number: e.target.value })}
          placeholder={MOBILE_HINT}
          required
          invalid={!!errors.mobile_number}
        />
        {errors.mobile_number && <AuthHint tone="error">{errors.mobile_number}</AuthHint>}
      </div>

      {select(
        "requested_role",
        "Role You Are Requesting",
        roles.map((role) => ({ value: String(role.id), label: role.name })),
        "Choose a role",
        {
          onPick: (id) => {
            const code = roles.find((role) => String(role.id) === id)?.code ?? "";
            onChange({ requested_role: id, requested_role_code: code });
          },
        },
      )}
      {!errors.requested_role && <AuthHint>An administrator can assign a different role than the one you request.</AuthHint>}
    </>
  );
}
