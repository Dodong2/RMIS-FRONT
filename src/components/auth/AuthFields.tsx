import type { InputHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export const AUTH_SELECT_TRIGGER =
  "w-full h-auto px-4 py-3 rounded-xl border-2 border-[#e2e8f0] text-sm bg-white data-[placeholder]:text-[#94a3b8] focus-visible:ring-0 focus-visible:border-[#0891b2] aria-invalid:border-[#dc2626]";

export function AuthLabel({ htmlFor, children, required }: { htmlFor?: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#475569" }}>
      {children}
      {required && <span style={{ color: "#dc2626" }} aria-hidden="true"> *</span>}
    </label>
  );
}

export function AuthInput({ invalid, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all bg-white ${
        invalid ? "border-[#dc2626]" : "border-[#e2e8f0] focus:border-[#0891b2]"
      } ${className}`}
      style={{ color: "#0d2a5e" }}
    />
  );
}

export function AuthHint({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <p className={`mt-1.5 text-xs ${tone === "error" ? "font-semibold" : ""}`} style={{ color: tone === "error" ? "#dc2626" : "#94a3b8" }}>
      {children}
    </p>
  );
}

export function AuthSubmit({ busy, busyLabel, children, disabled }: { busy?: boolean; busyLabel: string; children: ReactNode; disabled?: boolean }) {
  const off = busy || disabled;
  return (
    <button
      type="submit"
      disabled={off}
      className="w-full py-3 rounded-xl text-white font-black text-sm transition-all flex items-center justify-center gap-2"
      style={{
        background: off ? "#94a3b8" : "linear-gradient(135deg, #0d2a5e, #1a3f7a)",
        cursor: off ? "not-allowed" : "pointer",
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {busy ? busyLabel : children}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: "#e2e8f0" }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94a3b8" }}>or</span>
      <div className="flex-1 h-px" style={{ background: "#e2e8f0" }} />
    </div>
  );
}

export function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2"
      style={{ color: "#94a3b8" }}
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}
