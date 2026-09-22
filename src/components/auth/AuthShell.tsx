import type { ReactNode } from "react";
import { LspuMark } from "../common/LspuMark";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-navy-deep">
      {/* Left panel — the one bold moment on these pages. Cyan rule, navy field. */}
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex lg:w-[52%] bg-[linear-gradient(155deg,#081a3d_0%,#0d2a5e_55%,#1a3f7a_100%)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative">
          <div className="mb-12 flex items-center gap-4">
            <LspuMark size={52} />
            <div>
              <p className="text-sm font-semibold leading-tight text-white">
                Laguna State Polytechnic University
              </p>
              <p className="text-xs text-white/55">
                Office of the VP for Research, Development and Extension
              </p>
            </div>
          </div>

          <div className="border-l-[3px] border-cyan pl-6">
            <h2 className="text-4xl font-extrabold leading-[1.1] text-white xl:text-5xl">
              Research Management
              <br />
              Information System
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
              Proposals, budgets, compliance, personnel and research outputs for
              every LSPU campus and college, in one place.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-white/25">
          Phase 1 — authentication and role-based access
        </p>
      </section>

      <section className="flex w-full items-center justify-center p-5 lg:w-[48%] lg:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <LspuMark size={36} />
            <p className="text-sm font-bold text-white">LSPU RMIS</p>
          </div>

          <div className="overflow-hidden rounded-xl bg-card shadow-2xl">
            <div className="border-b-[3px] border-cyan bg-[linear-gradient(135deg,#0d2a5e_0%,#1a3f7a_100%)] px-7 py-6">
              <h1 className="text-2xl font-extrabold leading-tight text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-white/60">{subtitle}</p>
              )}
            </div>
            <div className="p-6">{children}</div>
          </div>

          {footer && (
            <div className="mt-5 text-center text-sm text-white/55">{footer}</div>
          )}
        </div>
      </section>
    </div>
  );
}