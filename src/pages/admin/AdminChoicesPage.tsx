import { useEffect, useState } from "react";
import { researchApi } from "../../lib/researchApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import type { AdminChoice, AdminChoiceKind } from "../../types/research";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard, SkeletonRows } from "../../components/common/proto";

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

type ChoiceConfig = { kind: AdminChoiceKind; title: string; field: string; placeholder: string; noun: string };

const CONFIGS: Record<AdminChoiceKind, ChoiceConfig> = {
  "college-units": { kind: "college-units", title: "College / Implementing Units", field: "College Unit - Implementing Unit", placeholder: "e.g. CCS", noun: "unit" },
  "rei-thrusts": { kind: "rei-thrusts", title: "REI Thrusts", field: "REI Thrust", placeholder: "e.g. Sustainable Agriculture", noun: "REI thrust" },
  "cooperating-agencies": { kind: "cooperating-agencies", title: "Cooperating Agencies", field: "Cooperating Agency/ies", placeholder: "e.g. DOST-PCAARRD", noun: "agency" },
};

function ChoicesContent({ config: { kind, field, placeholder, noun } }: { config: ChoiceConfig }) {
  const [units, setUnits] = useState<AdminChoice[] | null>(null);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    researchApi
      .getChoices(kind)
      .then(setUnits)
      .catch(() => {
        setUnits([]);
        notify.error(`Could not load the ${field} choices.`);
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when switching lists
  }, [kind]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      notify.success(success);
      await load();
      return true;
    } catch (err) {
      notify.error(errorMessage(err, "Could not save the change."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!newName.trim()) return;
    if (await run(() => researchApi.createChoice(kind, newName.trim()), "Added.")) setNewName("");
  };

  const saveEdit = async () => {
    if (!editing?.name.trim()) return;
    if (await run(() => researchApi.updateChoice(kind, editing.id, editing.name.trim()), "Renamed.")) setEditing(null);
  };

  const remove = (u: AdminChoice) => {
    if (!window.confirm(`Delete "${u.name}"? Projects already registered with it keep the name.`)) return;
    run(() => researchApi.deleteChoice(kind, u.id), "Deleted.");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title={field}>
        <div className="px-5 py-4 border-b flex gap-2" style={{ borderColor: "#f1f5f9" }}>
          <input
            className={inputCls}
            style={inputSt}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={placeholder}
            maxLength={100}
          />
          <button onClick={add} disabled={busy || !newName.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0 disabled:opacity-60" style={{ background: "#0891b2" }}>
            Add
          </button>
        </div>
        {units === null ? (
          <SkeletonRows rows={3} />
        ) : units.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "#94a3b8" }}>No {noun} yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {units.map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                {editing?.id === u.id ? (
                  <>
                    <input
                      autoFocus
                      className={inputCls}
                      style={inputSt}
                      value={editing.name}
                      onChange={(e) => setEditing({ id: u.id, name: e.target.value })}
                      onKeyDown={(e) => (e.key === "Enter" ? saveEdit() : e.key === "Escape" && setEditing(null))}
                      maxLength={100}
                    />
                    <button onClick={saveEdit} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Save</button>
                    <button onClick={() => setEditing(null)} className="text-xs font-semibold shrink-0" style={{ color: "#64748b" }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold flex-1" style={{ color: "#0d2a5e" }}>{u.name}</p>
                    <button onClick={() => setEditing({ id: u.id, name: u.name })} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Edit</button>
                    <button onClick={() => remove(u)} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#dc2626" }}>Delete</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
          <p className="text-xs" style={{ color: "#64748b" }}>
            These are the choices for "{field}" on Register Approved Project (manual entry and Excel import). Renaming or deleting one doesn't change projects already registered.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

export default function AdminChoicesPage({ kind }: { kind: AdminChoiceKind }) {
  return (
    <ProtectedRoute>
      <AppShell title={CONFIGS[kind].title}>
        <ChoicesContent key={kind} config={CONFIGS[kind]} />
      </AppShell>
    </ProtectedRoute>
  );
}
