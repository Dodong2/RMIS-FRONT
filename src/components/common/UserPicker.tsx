import { useState } from "react";
import type { AdminUser } from "../../types/auth";

export type PickedPerson = { user: number | null; name: string };

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]";

export function UserPicker({
  users,
  value,
  onChange,
  placeholder = "Search a registered account, or type a name",
  allowFreeText = true,
  invalid,
  className,
}: {
  users: AdminUser[];
  value: PickedPerson;
  onChange: (next: PickedPerson) => void;
  placeholder?: string;
  allowFreeText?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const query = value.name.trim().toLowerCase();
  const matches = users
    .filter((u) => !query || value.user || [u.full_name, u.email, u.role?.name ?? ""].some((v) => v.toLowerCase().includes(query)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        className={inputCls}
        style={{ borderColor: invalid ? "#dc2626" : "#e2e8f0", background: "#f8fafc", color: "#334155", paddingRight: value.user ? "84px" : undefined }}
        value={value.name}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange({ user: null, name: e.target.value });
          setOpen(true);
        }}
      />
      {value.user && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "#d1fae5", color: "#166534" }}>
          Account
        </span>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl shadow-lg overflow-y-auto max-h-64" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          {matches.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ user: u.id, name: u.full_name });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 cursor-pointer hover:bg-[#f0f9ff]"
              style={{ background: value.user === u.id ? "#e0f2fe" : undefined }}
            >
              <p className="text-sm font-semibold" style={{ color: "#1e293b" }}>{u.full_name}</p>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                {[u.full_name !== u.email ? u.email : "", u.role?.name, u.position].filter(Boolean).join(" · ")}
              </p>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-xs" style={{ color: "#94a3b8" }}>
              {allowFreeText ? "No matching account. The typed name will be saved as is." : "No matching account."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function UserSelect({
  users,
  value,
  onChange,
  placeholder = "Search by name or e-mail",
  invalid,
  className,
}: {
  users: AdminUser[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const [typed, setTyped] = useState("");
  const picked = users.find((u) => String(u.id) === value);
  return (
    <UserPicker
      users={users}
      value={{ user: picked?.id ?? null, name: picked ? picked.full_name : typed }}
      onChange={(next) => {
        setTyped(next.name);
        onChange(next.user ? String(next.user) : "");
      }}
      placeholder={placeholder}
      allowFreeText={false}
      invalid={invalid}
      className={className}
    />
  );
}
