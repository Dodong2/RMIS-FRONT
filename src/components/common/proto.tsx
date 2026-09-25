import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function SectionCard({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "#f1f5f9", background: "#f8fafc" }}>
        <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{title}</p>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, color = "#0d2a5e" }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>{label}</p>
      <p className="text-3xl font-black mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

export function Field({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label-field">
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

export function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: "#f0f4f8" }}>
        {cols.map((h, i) => (
          <th key={`${h}-${i}`} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "#64748b" }}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Pill({ children, bg = "#f1f5f9", color = "#475569" }: { children: ReactNode; bg?: string; color?: string }) {
  return (
    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />
      ))}
    </div>
  );
}

export function ProtoModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "max-w-xl",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 pb-4" style={{ background: "rgba(8,26,61,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className={`w-full ${width} rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[95vh]`} style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-start justify-between gap-3 shrink-0" style={{ background: "#0d2a5e" }}>
          <div className="min-w-0">
            <div className="text-white font-bold">{title}</div>
            {subtitle && <div className="text-white/50 text-xs mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white shrink-0" aria-label="Close">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t flex gap-3 shrink-0" style={{ borderColor: "#e2e8f0" }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
