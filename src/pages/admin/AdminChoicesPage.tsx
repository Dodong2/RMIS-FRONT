import { useEffect, useState } from "react";
import { researchApi } from "../../lib/researchApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import type { AdminChoice, AdminChoiceInput, AdminChoiceKind } from "../../types/research";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard, SkeletonRows } from "../../components/common/proto";

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

type Coded = { codeLabel: string; codePlaceholder: string; titleLabel: string; titlePlaceholder: string };
type ChoiceConfig = { kind: AdminChoiceKind; title: string; field: string; placeholder: string; noun: string; coded?: Coded };

const CONFIGS: Record<AdminChoiceKind, ChoiceConfig> = {
  "college-units": {
    kind: "college-units",
    title: "College / Implementing Units",
    field: "College Unit - Implementing Unit",
    placeholder: "",
    noun: "unit",
    coded: { codeLabel: "Abbrev", codePlaceholder: "e.g. CA", titleLabel: "College", titlePlaceholder: "e.g. College of Agriculture" },
  },
  "rei-thrusts": {
    kind: "rei-thrusts",
    title: "REI Thrusts",
    field: "REI Thrust",
    placeholder: "",
    noun: "REI thrust",
    coded: { codeLabel: "Code", codePlaceholder: "e.g. REI-01", titleLabel: "REI Thrust", titlePlaceholder: "e.g. Agriculture, Fisheries, and Food Security" },
  },
  "cooperating-agencies": { kind: "cooperating-agencies", title: "Cooperating Agencies", field: "Cooperating Agency/ies", placeholder: "e.g. DOST-PCAARRD", noun: "agency" },
};

type Draft = { code: string; title: string; name: string };
const EMPTY_DRAFT: Draft = { code: "", title: "", name: "" };

function ChoiceInputs({ coded, placeholder, draft, onChange, onEnter, onEscape, autoFocus }: {
  coded?: Coded;
  placeholder: string;
  draft: Draft;
  onChange: (d: Draft) => void;
  onEnter: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
}) {
  const keys = (e: { key: string }) => (e.key === "Enter" ? onEnter() : e.key === "Escape" && onEscape?.());
  if (!coded)
    return (
      <input autoFocus={autoFocus} className={inputCls} style={inputSt} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} onKeyDown={keys} placeholder={placeholder} maxLength={100} />
    );
  return (
    <>
      <input
        autoFocus={autoFocus}
        aria-label={coded.codeLabel}
        className={inputCls + " sm:max-w-36"}
        style={inputSt}
        value={draft.code}
        onChange={(e) => onChange({ ...draft, code: e.target.value })}
        onKeyDown={keys}
        placeholder={coded.codePlaceholder}
        maxLength={20}
      />
      <input
        aria-label={coded.titleLabel}
        className={inputCls}
        style={inputSt}
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        onKeyDown={keys}
        placeholder={coded.titlePlaceholder}
        maxLength={100}
      />
    </>
  );
}

function ChoicesContent({ config: { kind, field, placeholder, noun, coded } }: { config: ChoiceConfig }) {
  const [units, setUnits] = useState<AdminChoice[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<({ id: number } & Draft) | null>(null);
  const [busy, setBusy] = useState(false);

  const complete = (d: Draft) => (coded ? !!d.code.trim() && !!d.title.trim() : !!d.name.trim());
  const toInput = (d: Draft): AdminChoiceInput => (coded ? { code: d.code.trim(), title: d.title.trim() } : { name: d.name.trim() });

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
    if (!complete(draft)) {
      if (coded) notify.error(`Enter both the ${coded.codeLabel} and the ${coded.titleLabel}.`);
      return;
    }
    if (await run(() => researchApi.createChoice(kind, toInput(draft)), "Added.")) setDraft(EMPTY_DRAFT);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!complete(editing)) {
      if (coded) notify.error(`Enter both the ${coded.codeLabel} and the ${coded.titleLabel}.`);
      return;
    }
    if (await run(() => researchApi.updateChoice(kind, editing.id, toInput(editing)), "Saved.")) setEditing(null);
  };

  const remove = (u: AdminChoice) => {
    if (!window.confirm(`Delete "${u.name}"? Projects already registered with it keep the name.`)) return;
    run(() => researchApi.deleteChoice(kind, u.id), "Deleted.");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title={field}>
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row gap-2" style={{ borderColor: "#f1f5f9" }}>
          <ChoiceInputs coded={coded} placeholder={placeholder} draft={draft} onChange={setDraft} onEnter={add} />
          <button onClick={add} disabled={busy || !complete(draft)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0 disabled:opacity-60" style={{ background: "#0891b2" }}>
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
                    <div className="flex flex-col sm:flex-row gap-2 flex-1">
                      <ChoiceInputs
                        autoFocus
                        coded={coded}
                        placeholder={placeholder}
                        draft={editing}
                        onChange={(d) => setEditing({ id: u.id, ...d })}
                        onEnter={saveEdit}
                        onEscape={() => setEditing(null)}
                      />
                    </div>
                    <button onClick={saveEdit} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Save</button>
                    <button onClick={() => setEditing(null)} className="text-xs font-semibold shrink-0" style={{ color: "#64748b" }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "#0d2a5e" }}>{u.name}</p>
                      {coded && !u.code && <p className="text-xs" style={{ color: "#b45309" }}>No {coded.codeLabel.toLowerCase()} yet. Edit to add it.</p>}
                    </div>
                    <button onClick={() => setEditing({ id: u.id, code: u.code ?? "", title: u.title || (u.code ? "" : u.name), name: u.name })} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Edit</button>
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
