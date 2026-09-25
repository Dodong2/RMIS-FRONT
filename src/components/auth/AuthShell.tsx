import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const CAMPUSES = ["SPC", "Siniloan", "Los Baños", "Sta. Cruz"];

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(150deg, #05122e 0%, #0d2a5e 55%, #1a3f7a 100%)" }}>
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xl shrink-0">
              <span className="text-base font-black" style={{ color: "#0d2a5e" }}>LSPU</span>
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest">Republic of the Philippines</p>
              <p className="text-white font-bold leading-tight">Laguna State Polytechnic University</p>
              <p className="text-white/60 text-xs">Research &amp; Development Office</p>
            </div>
          </div>

          <div className="border-l-4 pl-6 mb-8" style={{ borderColor: "#0891b2" }}>
            <h1 className="text-white font-black text-4xl xl:text-5xl leading-tight">
              Research<br />Management<br />
              <span style={{ color: "#67e8f9" }}>Information</span><br />System
            </h1>
            <p className="text-white/60 mt-3 text-sm leading-relaxed max-w-sm">
              A campus- and college-based platform designed to manage, monitor, and analyze research projects,
              resources, compliance, outputs, and performance across the LSPU campuses and their respective colleges.
            </p>
          </div>
        </div>

        <p className="relative text-white/20 text-xs">
          LSPU–RMIS&nbsp;&nbsp;· LSPU-ICTS · Campus- &amp; College-Based Research Platform
        </p>
      </div>

      <div className="w-full lg:w-[45%] flex items-center justify-center p-5 lg:p-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#f8fafc" }}>
            <div className="px-7 py-6" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
              <div className="flex items-center gap-3 lg:hidden mb-5">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <span className="text-xs font-black" style={{ color: "#0d2a5e" }}>LSPU</span>
                </div>
                <p className="text-white font-bold text-sm">LSPU–RMIS</p>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {CAMPUSES.map((c) => (
                  <span
                    key={c}
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                  >
                    {c}
                  </span>
                ))}
              </div>

              <h2 className="text-white font-black text-2xl leading-tight">{title}</h2>
              {subtitle && <p className="text-white/50 text-sm mt-1">{subtitle}</p>}
            </div>

            <div className="p-6">{children}</div>

            {footer && (
              <div className="px-7 pb-5 text-center text-sm" style={{ color: "#64748b" }}>{footer}</div>
            )}

            <div className="px-7 py-3 border-t" style={{ borderColor: "#e2e8f0", background: "#f1f5f9" }}>
              <p className="text-xs text-center" style={{ color: "#94a3b8" }}>
                LSPU–RMIS&nbsp;&nbsp;· ICTS-Supported · Campus- &amp; College-Based
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
