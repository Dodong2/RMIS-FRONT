import { useState } from "react";
import { initialsFrom, resolveTier, roleLabel, roleScopeLine } from "../../lib/roles";
import { protoRoleStyle } from "../../lib/protoRole";
import { NOTIFICATIONS } from "../../mocks/notifications";
import type { User } from "../../types/auth";

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
  const [notifOpen, setNotifOpen] = useState(false);
  const roleStyle = protoRoleStyle(user?.role);

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
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
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
                <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>Notifications</p>
                <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: "#ef4444" }}>
                  {NOTIFICATIONS.length}
                </span>
              </div>
              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {NOTIFICATIONS.map((n) => (
                  <li key={n.id} className="px-4 py-3 flex gap-3 hover:bg-slate-50 cursor-pointer">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        n.type === "warning"
                          ? "bg-amber-400"
                          : n.type === "danger"
                            ? "bg-red-400"
                            : n.type === "success"
                              ? "bg-green-400"
                              : "bg-cyan-400"
                      }`}
                    />
                    <div>
                      <p className="text-xs leading-relaxed" style={{ color: "#334155" }}>{n.text}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{n.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-3 border-t" style={{ borderColor: "#e2e8f0" }}>
                <button className="text-xs font-bold" style={{ color: "#0891b2" }}>View all notifications →</button>
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
              {initialsFrom(user?.email)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate max-w-[180px]" style={{ color: "#0d2a5e" }}>
                {user?.email ?? "—"}
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
