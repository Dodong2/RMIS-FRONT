import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../components/layout/AppShell";
import { NoActualData } from "../components/common/NoActualData";
import { SkeletonRows } from "../components/common/proto";
import { ProcurementAnalytics } from "../components/dashboard/ProcurementDashboard";
import { PROCUREMENT_EVENTS, useRealtime } from "../hooks/useRealtime";
import { dashboardApi } from "../lib/dashboardApi";

export default function ProcurementAnalyticsPage() {
  const q = useQuery({ queryKey: ["dashboard-procurement"], queryFn: dashboardApi.getProcurementDashboard });
  useRealtime(PROCUREMENT_EVENTS, () => q.refetch());
  const [campus, setCampus] = useState("");
  const all = useMemo(() => q.data?.requests ?? [], [q.data]);
  const campuses = useMemo(() => [...new Set(all.map((r) => r.campus).filter(Boolean))].sort(), [all]);

  return (
    <AppShell title="Procurement Analytics">
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col gap-4 rounded-2xl p-5 text-white shadow-lg md:flex-row md:items-center md:justify-between" style={{ background: "linear-gradient(90deg, #071a3e, #0d2a5e, #1e3a7a)" }}>
          <div>
            <span className="mb-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ background: "rgba(8,145,178,0.2)", color: "#cffafe" }}>
              Procurement operations
            </span>
            <p className="text-xl font-black tracking-tight">Procurement Analytics</p>
            <p className="mt-1 text-sm" style={{ color: "#bfdbfe" }}>
              {campus || (campuses.length > 1 ? `${campuses.length} campuses` : campuses[0] ?? "All campuses")} · Which college or Project Leader is on track, and which LIB items are requested most
            </p>
          </div>
          {campuses.length > 1 && (
            <select aria-label="Campus scope" value={campus} onChange={(e) => setCampus(e.target.value)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-white outline-none" style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)" }}>
              <option value="" className="text-slate-800">All campuses</option>
              {campuses.map((c) => <option key={c} value={c} className="text-slate-800">{c}</option>)}
            </select>
          )}
        </div>

        {q.isPending ? (
          <SkeletonRows rows={5} />
        ) : q.isError ? (
          <NoActualData message="Could not load procurement analytics." hint="Check your connection and refresh." />
        ) : !all.length ? (
          <NoActualData message="No procurement requests yet" hint="Requests filed by Project Leaders against a certified LIB will appear here." />
        ) : (
          <ProcurementAnalytics rows={all} campus={campus} />
        )}
      </div>
    </AppShell>
  );
}
