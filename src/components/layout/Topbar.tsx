import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { realignmentsQuery, useBudgets, useProjects } from "../../lib/queries";
import { initialsFrom, personName, resolveTier, roleLabel, roleScopeLine } from "../../lib/roles";
import { protoRoleStyle } from "../../lib/protoRole";
import { riskApi } from "../../lib/riskApi";
import type { User } from "../../types/auth";
import type { RiskAlertInbox } from "../../types/risk";

const BUDGET_REVIEWER_ROLE_CODES = ["system_admin", "finance_budget"];

interface TopbarProps {
  user: User | null;
  isLoading?: boolean;
  title: string;
  onOpenSidebar: () => void;
}

function scopeSubtitle(user: User | null): string {
  const tier = resolveTier(user?.role);
  if (tier === "system_admin" || tier === "institution_oversight") return "All Campuses · LSPU–RMIS";
  const scope = user?.office || roleScopeLine(user?.role);
  return scope ? `${scope} · LSPU–RMIS` : "LSPU–RMIS";
}

export function Topbar({ user, isLoading, title, onOpenSidebar }: TopbarProps) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [inbox, setInbox] = useState<RiskAlertInbox | null>(null);
  const roleStyle = protoRoleStyle(user?.role);
  const alerts = inbox?.alerts ?? [];

  const userId = user?.pk;

  // Budget Officer (+ system_admin for testing): LIBs to certify and realignments to approve.
  const isBudgetReviewer = BUDGET_REVIEWER_ROLE_CODES.includes(user?.role?.code ?? "");
  const budgetsQ = useBudgets(undefined, { enabled: isBudgetReviewer });
  const projectsQ = useProjects({ enabled: isBudgetReviewer });
  const realignmentsQ = useQuery({ ...realignmentsQuery(), enabled: isBudgetReviewer });
  const budgetItems: { key: string; text: string; sub: string; link: string }[] = [];
  if (isBudgetReviewer) {
    for (const b of budgetsQ.data ?? []) {
      if (!b.is_current || b.status !== "draft" || b.line_items.length === 0) continue;
      const p = projectsQ.data?.find((x) => x.id === b.project);
      budgetItems.push({
        key: `lib${b.id}`,
        text: `${p?.project_code ?? `Project #${b.project}`} submitted LIB v${b.version_number}${p ? ` · ${p.title}` : ""}`,
        sub: "Waiting for certification",
        link: `/budget?project=${b.project}`,
      });
    }
    const pending = (realignmentsQ.data ?? []).filter((r) => r.status === "pending_approval" || r.status === "pending_bor").length;
    if (pending > 0) {
      budgetItems.push({
        key: "realign",
        text: `${pending} realignment request${pending !== 1 ? "s" : ""} submitted`,
        sub: "Waiting for approval",
        link: "/budget?view=realignments",
      });
    }
  }
  const total = alerts.length + budgetItems.length;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    riskApi
      .getAlerts()
      .then((data) => active && setInbox(data))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <header
      className="flex items-center justify-between px-4 lg:px-6 py-3 border-b shrink-0"
      style={{ background: "white", borderColor: "#e2e8f0" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg"
          style={{ color: "#64748b" }}
          aria-label="Open navigation"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="font-black text-base lg:text-lg truncate" style={{ color: "#0d2a5e" }}>{title}</h1>
          {isLoading ? (
            <div className="mt-1 h-3 w-48 rounded animate-pulse hidden sm:block" style={{ background: "#e2e8f0" }} />
          ) : (
            <p className="text-xs hidden sm:block truncate" style={{ color: "#94a3b8" }}>{scopeSubtitle(user)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-xl transition-colors hover:bg-slate-100"
            style={{ color: "#64748b" }}
            aria-label="Notifications"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" />
            </svg>
            {total > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />}
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 top-full mt-2 rounded-2xl shadow-2xl border z-50 overflow-hidden"
              style={{ background: "white", borderColor: "#e2e8f0", width: "340px", maxWidth: "calc(100vw - 2rem)" }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between border-b"
                style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}
              >
                <div>
                  <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>Notifications</p>
                  {inbox && (
                    <p className="text-xs" style={{ color: "#94a3b8" }}>
                      Live · as of {inbox.as_of}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: total ? "#ef4444" : "#94a3b8" }}>
                  {total}
                </span>
              </div>
              {budgetItems.length > 0 && (
                <ul className="divide-y divide-slate-100 border-b" style={{ borderColor: "#e2e8f0" }}>
                  {budgetItems.map((n) => (
                    <li
                      key={n.key}
                      onClick={() => {
                        setNotifOpen(false);
                        navigate(n.link);
                      }}
                      className="px-4 py-3 flex gap-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-red-400" />
                      <div>
                        <p className="text-xs leading-relaxed" style={{ color: "#334155" }}>{n.text}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>Budget · {n.sub}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {alerts.length === 0 ? (
                <p className="px-4 py-6 text-xs text-center" style={{ color: "#94a3b8" }}>
                  {inbox ? "No risk alerts in your scope." : "Loading alerts…"}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {alerts.map((n) => (
                    <li
                      key={n.kind === "milestone" ? `m${n.milestone}` : `p${n.project}`}
                      onClick={() => {
                        setNotifOpen(false);
                        navigate(n.link);
                      }}
                      className="px-4 py-3 flex gap-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === "danger" ? "bg-red-400" : "bg-amber-400"}`} />
                      <div>
                        <p className="text-xs leading-relaxed" style={{ color: "#334155" }}>{n.text}</p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: "#94a3b8" }}>
                          {n.kind === "milestone" ? "Work plan · overdue milestone" : `${n.risk_level} risk · score ${n.risk_score}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-4 py-3 border-t" style={{ borderColor: "#e2e8f0" }}>
                <button
                  onClick={() => {
                    setNotifOpen(false);
                    navigate("/risks");
                  }}
                  className="text-xs font-bold"
                  style={{ color: "#0891b2" }}
                >
                  View risk management →
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="hidden md:block h-11 w-40 rounded-xl animate-pulse" style={{ background: "#e2e8f0" }} />
        ) : (
          <div
            className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{ background: roleStyle.bg, border: `1px solid ${roleStyle.color}30` }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: roleStyle.color }}
            >
              {initialsFrom(personName(user))}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate max-w-[180px]" style={{ color: "#0d2a5e" }}>
                {personName(user) || "—"}
              </p>
              <p className="text-xs leading-tight font-semibold" style={{ color: roleStyle.color }}>
                {user?.role ? roleLabel(user.role) : "Role pending"}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
