import { useEffect, useState } from "react";
import { personnelApi } from "../lib/personnelApi";
import { ROLE_META } from "../lib/roles";
import { notify } from "../lib/notify";
import type { LeaderLoad } from "../types/personnel";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { KpiCard, SkeletonRows } from "../components/common/proto";
import { AppShell } from "../components/layout/AppShell";

function LoadBar({ label, count, cap }: { label: string; count: number; cap: number }) {
  const full = count >= cap;
  const pct = cap > 0 ? Math.min(100, (count / cap) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span className="font-mono font-bold" style={{ color: full ? "#dc2626" : "#0891b2" }}>
          {count} / {cap}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: full ? "#ef4444" : "#0891b2" }} />
      </div>
    </div>
  );
}

function LeaderLoadContent() {
  const [leaders, setLeaders] = useState<LeaderLoad[] | null>(null);

  useEffect(() => {
    let active = true;
    personnelApi
      .getLeaderLoad()
      .then((data) => {
        if (!active) return;
        setLeaders([...data].sort((a, b) => b.active_programs + b.active_projects - (a.active_programs + a.active_projects)));
      })
      .catch(() => {
        if (!active) return;
        setLeaders([]);
        notify.error("Could not load leader workload. Check your connection and refresh.");
      });
    return () => {
      active = false;
    };
  }, []);

  const atCap = (leaders ?? []).filter((l) => l.active_programs >= l.program_cap || l.active_projects >= l.project_cap).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Leaders" value={leaders === null ? "…" : leaders.length} />
        <KpiCard label="Active Programs" value={leaders === null ? "…" : leaders.reduce((s, l) => s + l.active_programs, 0)} />
        <KpiCard label="Active Projects" value={leaders === null ? "…" : leaders.reduce((s, l) => s + l.active_projects, 0)} />
        <KpiCard label="At Concurrency Cap" value={leaders === null ? "…" : atCap} color={atCap ? "#dc2626" : "#0d2a5e"} />
      </div>

      <div className="rounded-xl p-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
        A leader may lead up to 2 active programs and 3 active projects. Institutional-funded records are stricter: a leader who already
        leads any active record cannot take on another institutional-funded one.
      </div>

      {leaders === null ? (
        <SkeletonRows rows={3} />
      ) : leaders.length === 0 ? (
        <NoActualData hint="Active program and project leaders will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaders.map((l) => (
            <div key={l.user} className="rounded-xl p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: "#1a3f7a" }}>
                  {l.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: "#0d2a5e" }}>{l.email}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: "#0891b2" }}>{ROLE_META[l.role]?.name ?? l.role}</p>
                </div>
              </div>
              <div className="space-y-3">
                <LoadBar label="Active Programs" count={l.active_programs} cap={l.program_cap} />
                <LoadBar label="Active Projects" count={l.active_projects} cap={l.project_cap} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeaderLoadPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Leader Load">
        <LeaderLoadContent />
      </AppShell>
    </ProtectedRoute>
  );
}
