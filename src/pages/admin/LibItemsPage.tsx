import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi } from "../../lib/budgetApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { libItemsQuery, queryKeys } from "../../lib/queries";
import type { LibItem, LibItemInput, LineItemCategory } from "../../types/budget";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard, SkeletonRows } from "../../components/common/proto";

const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

const CLASSES: { key: LineItemCategory; label: string; full: string }[] = [
  { key: "ps", label: "PS", full: "Personal Services" },
  { key: "mooe", label: "MOOE", full: "Maintenance and Other Operating Expenses" },
  { key: "co", label: "CO", full: "Capital Outlay" },
];
const classLabel = (c: LineItemCategory) => CLASSES.find((x) => x.key === c)?.label ?? c;

type Draft = { category: LineItemCategory; name: string; uacs_code: string };
const EMPTY: Draft = { category: "mooe", name: "", uacs_code: "" };

function DraftInputs({ draft, onChange, onEnter, onEscape, autoFocus }: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onEnter: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
}) {
  const keys = (e: { key: string }) => (e.key === "Enter" ? onEnter() : e.key === "Escape" && onEscape?.());
  return (
    <>
      <select aria-label="Object of Expenditure" className={inputCls + " sm:max-w-28"} style={inputSt} value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value as LineItemCategory })}>
        {CLASSES.map((c) => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </select>
      <input autoFocus={autoFocus} aria-label="Item" className={inputCls} style={inputSt} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} onKeyDown={keys} placeholder="Item, e.g. Honoraria" maxLength={300} />
      <input aria-label="UACS Code" className={inputCls + " sm:max-w-40"} style={inputSt} value={draft.uacs_code} onChange={(e) => onChange({ ...draft, uacs_code: e.target.value })} onKeyDown={keys} placeholder="UACS code (optional)" maxLength={20} />
    </>
  );
}

function LibItemsContent() {
  const queryClient = useQueryClient();
  const { data: items, isLoading, isError } = useQuery(libItemsQuery);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<({ id: number } & Draft) | null>(null);
  const [filter, setFilter] = useState<LineItemCategory | "">("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      notify.success(success);
      await queryClient.invalidateQueries({ queryKey: queryKeys.libItems });
      return true;
    } catch (err) {
      notify.error(errorMessage(err, "Could not save the change."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toInput = (d: Draft): Omit<LibItemInput, "is_active"> => ({ category: d.category, name: d.name.trim(), uacs_code: d.uacs_code.trim() });
  const add = async () => {
    if (!draft.name.trim()) return notify.error("Enter the item.");
    if (await run(() => budgetApi.createLibItem({ ...toInput(draft), is_active: true }), "Item added.")) setDraft({ ...EMPTY, category: draft.category });
  };
  const saveEdit = async () => {
    if (!editing?.name.trim()) return notify.error("Enter the item.");
    if (await run(() => budgetApi.updateLibItem(editing.id, toInput(editing)), "Saved.")) setEditing(null);
  };
  const toggleActive = (i: LibItem) => run(() => budgetApi.updateLibItem(i.id, { is_active: !i.is_active }), i.is_active ? "Deactivated." : "Activated.");
  const remove = async (i: LibItem) => {
    if (!(await notify.confirm(`Delete "${i.name}"? LIBs already encoded keep the name.`))) return;
    run(() => budgetApi.deleteLibItem(i.id), "Deleted.");
  };

  const q = query.trim().toLowerCase();
  const rows = (items ?? []).filter((i) => (!filter || i.category === filter) && (!q || `${i.name} ${i.uacs_code}`.toLowerCase().includes(q)));

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard
        title="LIB Items"
        aside={
          <div className="flex flex-col sm:flex-row gap-2">
            <select aria-label="Filter by class" className={inputCls + " sm:w-28"} style={{ ...inputSt, background: "white" }} value={filter} onChange={(e) => setFilter(e.target.value as LineItemCategory | "")}>
              <option value="">All classes</option>
              {CLASSES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <input className={inputCls + " sm:w-56"} style={{ ...inputSt, background: "white" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items or UACS code" />
          </div>
        }
      >
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row gap-2" style={{ borderColor: "#f1f5f9" }}>
          <DraftInputs draft={draft} onChange={setDraft} onEnter={add} />
          <button onClick={add} disabled={busy || !draft.name.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0 disabled:opacity-60" style={{ background: "#0891b2" }}>
            Add
          </button>
        </div>
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : isError ? (
          <div className="text-center py-10 text-sm" style={{ color: "#dc2626" }}>Could not load the LIB Items.</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "#94a3b8" }}>{q || filter ? "Nothing matches the filter." : "No LIB item yet. Add one above."}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((i) => (
              <div key={i.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                {editing?.id === i.id ? (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2 flex-1">
                      <DraftInputs autoFocus draft={editing} onChange={(d) => setEditing({ id: i.id, ...d })} onEnter={saveEdit} onEscape={() => setEditing(null)} />
                    </div>
                    <button onClick={saveEdit} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Save</button>
                    <button onClick={() => setEditing(null)} className="text-xs font-semibold shrink-0" style={{ color: "#64748b" }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: "#e0f2fe", color: "#0369a1" }}>{classLabel(i.category)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: i.is_active ? "#0d2a5e" : "#94a3b8" }}>
                        {i.name}
                        {!i.is_active && <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "#f1f5f9", color: "#64748b" }}>Inactive</span>}
                      </p>
                      <p className="text-xs font-mono" style={{ color: "#64748b" }}>{i.uacs_code ? `UACS ${i.uacs_code}` : "No UACS code"}</p>
                    </div>
                    <button onClick={() => setEditing({ id: i.id, category: i.category, name: i.name, uacs_code: i.uacs_code })} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#0891b2" }}>Edit</button>
                    <button onClick={() => toggleActive(i)} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#b45309" }}>{i.is_active ? "Deactivate" : "Activate"}</button>
                    <button onClick={() => remove(i)} disabled={busy} className="text-xs font-semibold shrink-0" style={{ color: "#dc2626" }}>Delete</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
          <p className="text-xs" style={{ color: "#64748b" }}>
            These are the only Items a line item can pick under its Object of Expenditure (PS, MOOE or CO) on the Register Approved Project LIB step, Budget Management and Realignment, and in the Excel import. The list follows the official 2027 LIB (PS, MOOE and Capital Outlay with their account codes). An item already used in an LIB can't be deleted; deactivate it instead. Renaming or deactivating never changes LIBs already encoded.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

export default function LibItemsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="LIB Items">
        <LibItemsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
