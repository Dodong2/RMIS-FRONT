import { useEffect, useMemo, useState } from "react";
import { researchApi } from "../../lib/researchApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { buildRdeAgenda, nextPriorityCode, rdeLabel, type RdeThrust } from "../../lib/rdeAgenda";
import type { AdminChoice } from "../../types/research";
import { SectionCard, SkeletonRows } from "../../components/common/proto";

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

type Draft = { code: string; title: string };
const EMPTY: Draft = { code: "", title: "" };

function CodeTitleInputs({ draft, onChange, onEnter, onEscape, codePlaceholder, titlePlaceholder, autoFocus }: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onEnter: () => void;
  onEscape?: () => void;
  codePlaceholder: string;
  titlePlaceholder: string;
  autoFocus?: boolean;
}) {
  const keys = (e: { key: string }) => (e.key === "Enter" ? onEnter() : e.key === "Escape" && onEscape?.());
  return (
    <>
      <input autoFocus={autoFocus} aria-label="Code" className={inputCls + " sm:max-w-24"} style={inputSt} value={draft.code} onChange={(e) => onChange({ ...draft, code: e.target.value })} onKeyDown={keys} placeholder={codePlaceholder} maxLength={20} />
      <input aria-label="Title" className={inputCls} style={inputSt} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} onKeyDown={keys} placeholder={titlePlaceholder} maxLength={100} />
    </>
  );
}

/** Admin > RDE Thrusts (client 2026-10-20): the 2024-2028 LSPU RDE Agenda as thrusts with their priority areas. */
export function RdeAgendaContent() {
  const [rows, setRows] = useState<AdminChoice[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number[]>([]);
  const [newThrust, setNewThrust] = useState<Draft>(EMPTY);
  const [newPriority, setNewPriority] = useState<{ parent: number } & Draft | null>(null);
  const [editing, setEditing] = useState<({ id: number } & Draft) | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    researchApi
      .getChoices("rde-thrusts")
      .then(setRows)
      .catch(() => {
        setRows([]);
        notify.error("Could not load the RDE Agenda.");
      });

  useEffect(() => {
    load();
  }, []);

  const agenda = useMemo(() => buildRdeAgenda(rows ?? []), [rows]);
  const q = query.trim().toLowerCase();
  const matches = (c: AdminChoice) => !q || rdeLabel(c).toLowerCase().includes(q);
  const visible = agenda
    .map((t) => ({ ...t, priorities: matches(t) ? t.priorities : t.priorities.filter(matches) }))
    .filter((t) => matches(t) || t.priorities.length > 0);
  const filled = (d: Draft) => !!d.code.trim() && !!d.title.trim();

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

  const addThrust = async () => {
    if (!filled(newThrust)) return notify.error("Enter both the code and the thrust.");
    if (await run(() => researchApi.createChoice("rde-thrusts", { code: newThrust.code.trim(), title: newThrust.title.trim() }), "Thrust added.")) setNewThrust(EMPTY);
  };

  const addPriority = async () => {
    if (!newPriority || !filled(newPriority)) return notify.error("Enter both the code and the priority area.");
    const input = { code: newPriority.code.trim(), title: newPriority.title.trim(), parent: newPriority.parent };
    if (await run(() => researchApi.createChoice("rde-thrusts", input), "Priority area added.")) setNewPriority(null);
  };

  const saveEdit = async (row: AdminChoice) => {
    if (!editing || !filled(editing)) return notify.error("Enter both the code and the title.");
    const input = { code: editing.code.trim(), title: editing.title.trim(), parent: row.parent ?? null };
    if (await run(() => researchApi.updateChoice("rde-thrusts", row.id, input), "Saved.")) setEditing(null);
  };

  const remove = async (row: AdminChoice) => {
    if (!(await notify.confirm(`Delete "${rdeLabel(row)}"? Projects already registered with it keep the name.`))) return;
    run(() => researchApi.deleteChoice("rde-thrusts", row.id), "Deleted.");
  };

  const toggle = (id: number) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const startPriority = (t: RdeThrust) => {
    setOpen((o) => (o.includes(t.id) ? o : [...o, t.id]));
    setNewPriority({ parent: t.id, code: nextPriorityCode(t), title: "" });
  };

  const rowView = (row: AdminChoice, priority: boolean) =>
    editing?.id === row.id ? (
      <>
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <CodeTitleInputs autoFocus draft={editing} onChange={(d) => setEditing({ id: row.id, ...d })} onEnter={() => saveEdit(row)} onEscape={() => setEditing(null)} codePlaceholder="Code" titlePlaceholder="Title" />
        </div>
        <button onClick={() => saveEdit(row)} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Save</button>
        <button onClick={() => setEditing(null)} className="text-xs font-semibold shrink-0" style={{ color: "#64748b" }}>Cancel</button>
      </>
    ) : (
      <>
        <p className={`flex-1 min-w-0 text-sm ${priority ? "" : "font-semibold"}`} style={{ color: priority ? "#334155" : "#0d2a5e" }}>
          <span className="font-mono font-bold mr-1.5">{row.code}.</span>
          {row.title || row.name}
        </p>
        <button onClick={() => setEditing({ id: row.id, code: row.code ?? "", title: row.title ?? "" })} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Edit</button>
        <button onClick={() => remove(row)} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#dc2626" }}>Delete</button>
      </>
    );

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard
        title="2024–2028 LSPU RDE Agenda"
        aside={<input className={inputCls + " sm:w-64"} style={{ ...inputSt, background: "white" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search thrusts and priority areas" />}
      >
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row gap-2" style={{ borderColor: "#f1f5f9" }}>
          <CodeTitleInputs draft={newThrust} onChange={setNewThrust} onEnter={addThrust} codePlaceholder="e.g. 9" titlePlaceholder="New RDE Thrust, e.g. Space Science and Technology" />
          <button onClick={addThrust} disabled={busy || !filled(newThrust)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0 disabled:opacity-60" style={{ background: "#0891b2" }}>
            Add Thrust
          </button>
        </div>
        {rows === null ? (
          <SkeletonRows rows={4} />
        ) : visible.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "#94a3b8" }}>{q ? "Nothing matches the search." : "No RDE thrust yet. Add one above."}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((t) => {
              const expanded = !!q || open.includes(t.id);
              return (
                <div key={t.id}>
                  <div className="px-5 py-3 flex items-center gap-3">
                    <button onClick={() => toggle(t.id)} aria-label={expanded ? "Collapse" : "Expand"} aria-expanded={expanded} className="w-6 text-xs font-bold shrink-0" style={{ color: "#64748b" }}>
                      {expanded ? "▾" : "▸"}
                    </button>
                    {rowView(t, false)}
                    {editing?.id !== t.id && (
                      <span className="text-xs shrink-0" style={{ color: "#94a3b8" }}>{t.priorities.length} priority area{t.priorities.length === 1 ? "" : "s"}</span>
                    )}
                  </div>
                  {expanded && (
                    <div className="pb-3 pl-14 pr-5 space-y-1">
                      {t.priorities.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 py-1.5">{rowView(p, true)}</div>
                      ))}
                      {newPriority?.parent === t.id ? (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <CodeTitleInputs autoFocus draft={newPriority} onChange={(d) => setNewPriority({ parent: t.id, ...d })} onEnter={addPriority} onEscape={() => setNewPriority(null)} codePlaceholder={nextPriorityCode(t)} titlePlaceholder="New RDE Priority Area" />
                          <button onClick={addPriority} disabled={busy || !filled(newPriority)} className="px-3 py-2 rounded-lg text-xs font-semibold text-white shrink-0 disabled:opacity-60" style={{ background: "#0891b2" }}>Add</button>
                          <button onClick={() => setNewPriority(null)} className="text-xs font-semibold shrink-0" style={{ color: "#64748b" }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startPriority(t)} disabled={busy} className="text-xs font-semibold pt-1" style={{ color: "#0891b2" }}>+ Add priority area under {t.code}</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="px-5 py-3 border-t" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
          <p className="text-xs" style={{ color: "#64748b" }}>
            These feed "RDE Thrust" and "RDE Priority Area" on Register Approved Project (manual entry and Excel import). A priority area's code is its thrust's number then its own (e.g. 1.10). A thrust with priority areas can't be deleted until those are removed. Renaming or deleting an entry doesn't change projects already registered.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
