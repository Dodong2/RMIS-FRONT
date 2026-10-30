import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

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
        <EyeOff size={16} aria-hidden="true" />
      ) : (
        <Eye size={16} aria-hidden="true" />
      )}
    </button>
  );
}
