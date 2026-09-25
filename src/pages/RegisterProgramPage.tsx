import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import type { FundingType } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

function Field({ label, required, invalid, children }: { label: string; required?: boolean; invalid?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="label-field">
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {children}
      {invalid && <p className="mt-1 text-xs font-semibold" style={{ color: "#dc2626" }}>Required</p>}
    </div>
  );
}

function RegisterProgramContent() {
  const navigate = useNavigate();
  const [programLeaders, setProgramLeaders] = useState<AdminUser[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ title: "", funding_type: "", lead: "", rei_thrust: "", start_date: "" });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    let active = true;
    researchApi
      .getUsersByRole("program_leader")
      .then((leaders) => active && setProgramLeaders(leaders))
      .catch(() => active && notify.error("Could not load program leaders. Check your connection and refresh."));
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async () => {
    setAttempted(true);
    if (!form.title.trim() || !form.funding_type || !form.lead) {
      notify.error("Program title, funding type, and lead are required.");
      return;
    }
    setIsCreating(true);
    try {
      await researchApi.createProgram({
        title: form.title,
        funding_type: form.funding_type,
        lead: Number(form.lead),
        rei_thrust: form.rei_thrust || undefined,
        start_date: form.start_date || undefined,
      });
      notify.success("Program registered.");
      navigate("/projects");
    } catch (err) {
      notify.error(errorMessage(err, "Could not register the program."));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Project List
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-semibold" style={{ color: "#64748b" }}>Register Program</span>
      </div>

      <div className="w-full max-w-3xl rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-6 py-4" style={{ background: "#0d2a5e" }}>
          <p className="text-white font-bold text-base">Register Research Program</p>
          <p className="text-white/50 text-xs mt-0.5">Group two or more related approved projects under a shared program</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl p-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
            A Program Leader may lead at most 2 active programs at a time. Projects are linked to the program when they are registered.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Field label="Program Title" required invalid={attempted && !form.title.trim()}>
                <input className={inputCls} style={inputSt} value={form.title} onChange={set("title")} placeholder="Full official title of the research program" />
              </Field>
            </div>
            <Field label="Funding Type" required invalid={attempted && !form.funding_type}>
              <select className={inputCls} style={inputSt} value={form.funding_type} onChange={set("funding_type")}>
                <option value="">Select funding type...</option>
                {Object.entries(FUNDING_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Program Leader" required invalid={attempted && !form.lead}>
              <select className={inputCls} style={inputSt} value={form.lead} onChange={set("lead")}>
                <option value="">{programLeaders.length ? "Select program leader..." : "No active program leaders yet"}</option>
                {programLeaders.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </Field>
            <Field label="REI Thrust">
              <input className={inputCls} style={inputSt} value={form.rei_thrust} onChange={set("rei_thrust")} placeholder="e.g. Sustainable Agriculture" />
            </Field>
            <Field label="Start Date">
              <input type="date" className={inputCls} style={inputSt} value={form.start_date} onChange={set("start_date")} />
            </Field>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <button onClick={() => navigate("/projects")} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: "#0d2a5e" }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {isCreating ? "Registering…" : "Register Program"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RegisterProgramPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Register Program">
        <RegisterProgramContent />
      </AppShell>
    </ProtectedRoute>
  );
}
