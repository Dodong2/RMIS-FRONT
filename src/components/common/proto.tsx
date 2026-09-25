import type { ReactNode } from "react";

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
