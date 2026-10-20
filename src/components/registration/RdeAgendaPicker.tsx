import { useMemo, useState } from "react";
import { buildRdeAgenda, rdeLabel } from "../../lib/rdeAgenda";
import type { AdminChoice } from "../../types/research";

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

function Required({ show }: { show: boolean }) {
  return show ? <p className="mt-1 text-xs font-semibold" style={{ color: "#dc2626" }}>Required</p> : null;
}

export function RdeAgendaPicker({ choices, thrust, priority, onChange, showErrors }: {
  choices: AdminChoice[];
  thrust: string;
  priority: string;
  onChange: (thrust: string, priority: string) => void;
  showErrors: boolean;
}) {
  const [showReference, setShowReference] = useState(false);
  const agenda = useMemo(() => buildRdeAgenda(choices), [choices]);
  const active = agenda.find((t) => t.name === thrust);
  const picked = active?.priorities.find((p) => p.name === priority);
  const unlisted = (value: string, list: AdminChoice[]) => !!value && !list.some((c) => c.name === value);

  return (
    <div className="md:col-span-2 rounded-xl p-4 space-y-3" style={{ background: "#f8fafc", border: "1px solid #cbd5e1" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-xs font-bold" style={{ color: "#0d2a5e" }}>RDE Agenda</span>
        {agenda.length > 0 && (
          <button
            type="button"
            onClick={() => setShowReference((v) => !v)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all"
            style={{
              background: showReference ? "#0891b2" : "white",
              borderColor: showReference ? "#0891b2" : "#cbd5e1",
              color: showReference ? "white" : "#0891b2",
            }}
          >
            {showReference ? "Hide Full RDE Agenda" : `View All ${agenda.length} Thrusts & Priorities`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label-field">
            RDE Thrust<span style={{ color: "#dc2626" }}> *</span>
          </label>
          <select className={inputCls} style={inputSt} value={thrust} onChange={(e) => onChange(e.target.value, "")}>
            <option value="">{agenda.length ? "Select RDE thrust..." : "No choices yet, ask the System Admin to add them"}</option>
            {unlisted(thrust, agenda) && <option value={thrust}>{thrust}</option>}
            {agenda.map((t) => (
              <option key={t.id} value={t.name}>{rdeLabel(t)}</option>
            ))}
          </select>
          <Required show={showErrors && !thrust} />
        </div>
        <div>
          <label className="label-field">
            RDE Priority Area<span style={{ color: "#dc2626" }}> *</span>
          </label>
          <select className={inputCls} style={inputSt} value={priority} onChange={(e) => onChange(thrust, e.target.value)} disabled={!thrust}>
            <option value="">{thrust ? "Select RDE priority area..." : "Select an RDE thrust first"}</option>
            {unlisted(priority, active?.priorities ?? []) && <option value={priority}>{priority}</option>}
            {active?.priorities.map((p) => (
              <option key={p.id} value={p.name}>{rdeLabel(p)}</option>
            ))}
          </select>
          <Required show={showErrors && !priority} />
        </div>
      </div>

      {active && picked && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "#e0f2fe", border: "1px solid #bae6fd", color: "#0369a1" }}>
          <span className="font-bold">Selected RDE Alignment:</span> <span>Thrust {active.code} ({active.title}) → </span>
          <span className="font-mono font-bold">{picked.code}</span> <span>{picked.title}</span>
        </div>
      )}

      {showReference && (
        <div className="rounded-xl p-3 space-y-3 max-h-64 overflow-y-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0d2a5e" }}>
            LSPU 2024–2028 RDE Thrusts and Priorities Reference (Click a priority to select)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agenda.map((t) => (
              <div
                key={t.id}
                className="rounded-lg p-2.5 border"
                style={{ borderColor: t.name === thrust ? "#0891b2" : "#e2e8f0", background: t.name === thrust ? "#f0f9ff" : "#f8fafc" }}
              >
                <p className="text-xs font-bold mb-1.5" style={{ color: "#0d2a5e" }}>{rdeLabel(t)}</p>
                <div className="space-y-1">
                  {t.priorities.map((p) => {
                    const isPicked = t.name === thrust && p.name === priority;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onChange(t.name, p.name)}
                        className="w-full text-left px-2 py-1 rounded text-[11px] transition-all flex items-start gap-1.5"
                        style={{ background: isPicked ? "#0d2a5e" : "transparent", color: isPicked ? "white" : "#334155", fontWeight: isPicked ? 700 : 500 }}
                      >
                        <span className="font-mono shrink-0">{p.code}.</span>
                        <span>{p.title || p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
