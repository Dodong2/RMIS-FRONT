import type { ReactNode } from "react";

const PALETTE = ["#0d2a5e", "#0891b2", "#059669", "#7c3aed", "#f59e0b", "#ea580c", "#dc2626", "#64748b"];

export function KpiBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="text-3xl font-black mt-1 break-words" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>{sub}</p>}
    </div>
  );
}

export function ChartCard({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col ${className}`} style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <div className="flex items-center justify-between gap-3 mb-4 shrink-0 flex-wrap">
        <p className="text-sm font-black uppercase tracking-wide" style={{ color: "#0d2a5e" }}>{title}</p>
        {aside}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ color: "#94a3b8" }}>
      <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18M7 16l4-4 4 4 4-4" /></svg>
      <p className="text-sm font-semibold">No actual data</p>
      <p className="text-xs text-center">{message}</p>
    </div>
  );
}

export function HBar({ label, val, max, color, valLabel }: { label: string; val: number; max: number; color: string; valLabel: string }) {
  const pct = max ? Math.min(100, (val / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <p className="text-xs w-40 shrink-0 text-right truncate" style={{ color: "#64748b" }} title={label}>{label}</p>
      <div className="flex-1 h-6 rounded-lg overflow-hidden relative" style={{ background: "#f0f4f8" }}>
        <div className="h-full rounded-lg transition-all" style={{ width: `${pct}%`, background: color }} />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: pct > 20 ? "white" : "#334155" }}>{valLabel}</span>
      </div>
    </div>
  );
}

export function CountBars({ data, labelFor, emptyMessage, color }: { data: Record<string, number>; labelFor: (k: string) => string; emptyMessage: string; color?: string }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0 || rows.every(([, v]) => v === 0)) return <EmptyChart message={emptyMessage} />;
  const max = Math.max(...rows.map(([, v]) => v));
  return (
    <div className="space-y-1">
      {rows.map(([k, v], i) => (
        <HBar key={k} label={labelFor(k)} val={v} max={max} color={color ?? PALETTE[i % PALETTE.length]} valLabel={String(v)} />
      ))}
    </div>
  );
}

export function DonutChart({ segments, centerLabel }: { segments: { label: string; value: number; color: string }[]; centerLabel: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const starts = segments.map((_, i) => segments.slice(0, i).reduce((a, s) => a + (total ? s.value / total : 0), 0));
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg viewBox="0 0 100 100" className="w-32 h-32 shrink-0">
        {total === 0 && <circle cx={50} cy={50} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="22" />}
        {segments.map((seg, i) => {
          const pct = total ? seg.value / total : 0;
          const dash = pct * circumference;
          const offset = circumference - starts[i] * circumference;
          return (
            <circle
              key={seg.label}
              cx={50}
              cy={50}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="22"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
            />
          );
        })}
        <text x="50" y="47" textAnchor="middle" style={{ fontSize: "14px", fontWeight: 900, fill: "#0d2a5e" }}>{total}</text>
        <text x="50" y="60" textAnchor="middle" style={{ fontSize: "7px", fill: "#94a3b8" }}>{centerLabel}</text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-xs" style={{ color: "#475569" }}>{seg.label}</span>
            <span className="text-xs font-bold ml-auto pl-4" style={{ color: seg.color }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendBar({ labels, values, color, format }: { labels: string[]; values: number[]; color: string; format: (v: number) => string }) {
  const maxVal = Math.max(0, ...values);
  return (
    <div className="flex items-end gap-2 h-36">
      {labels.map((m, i) => {
        const h = maxVal ? (values[i] / maxVal) * 100 : 0;
        return (
          <div key={m} className="flex flex-col items-center justify-end gap-1 flex-1 h-full" title={`${m}: ${format(values[i])}`}>
            <div className="w-full rounded-t-lg" style={{ height: `${h}%`, minHeight: values[i] > 0 ? 3 : 0, background: color, opacity: 0.85 }} />
            <span className="text-xs" style={{ color: "#94a3b8", fontSize: "10px" }}>{m}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MiniBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "#64748b" }}>{label}</span>
        <span className="font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}
