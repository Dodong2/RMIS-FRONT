import { useId, useState, type KeyboardEvent } from "react";
import type { LineItem } from "../../types/budget";
import type { ItemTotals } from "../../lib/procurementBalance";

const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));

/** Client Task 48: Link to LIB Item as a searchable list. The highlighted (or chosen) item shows its Specification and
 * its Approved / Committed / Paid / Available from the backend; an item with nothing available can't be chosen. */
export function LibItemPicker({
  items,
  totals,
  failed,
  value,
  onChange,
  invalid,
  emptyLabel,
}: {
  items: LineItem[];
  totals: Map<number, ItemTotals> | null;
  failed: boolean;
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  emptyLabel: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = items.find((li) => String(li.id) === value);
  const q = query.trim().toLowerCase();
  const matches = items.filter((li) => !q || [li.description, li.specification ?? ""].some((v) => v.toLowerCase().includes(q)));
  const shown = open ? matches[Math.min(active, matches.length - 1)] : selected;
  const blocked = (li: LineItem) => !!totals && (totals.get(li.id)?.available ?? 0) <= 0;
  const availableText = (li: LineItem) => {
    if (failed) return "Available unknown";
    if (!totals) return "Loading…";
    const t = totals.get(li.id);
    return t && t.available > 0 ? `Available ${peso(t.available)}` : "No available balance";
  };

  const choose = (li: LineItem | undefined) => {
    if (!li || blocked(li)) return;
    onChange(String(li.id));
    setQuery("");
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (matches.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length : 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]"
        style={{ borderColor: invalid ? "#dc2626" : "#e2e8f0", background: "#f8fafc", color: "#334155" }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-label="Link to LIB Item"
        disabled={items.length === 0}
        placeholder={items.length ? "Search an item or specification" : emptyLabel}
        value={open ? query : selected ? `${selected.description} · ${peso(selected.amount)}` : ""}
        onFocus={() => {
          setOpen(true);
          setActive(Math.max(0, matches.findIndex((li) => String(li.id) === value)));
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKey}
      />
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-xl shadow-lg flex flex-col md:flex-row overflow-hidden"
          style={{ background: "white", border: "1px solid #e2e8f0" }}
        >
          <ul id={listId} role="listbox" className="md:w-1/2 max-h-64 overflow-y-auto">
            {matches.map((li, i) => (
              <li
                key={li.id}
                id={`${listId}-${li.id}`}
                role="option"
                aria-selected={String(li.id) === value}
                aria-disabled={blocked(li)}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(li);
                }}
                className={`px-3 py-2 ${blocked(li) ? "cursor-not-allowed" : "cursor-pointer"}`}
                style={{ background: i === active ? "#f0f9ff" : String(li.id) === value ? "#e0f2fe" : undefined, opacity: blocked(li) ? 0.55 : 1 }}
              >
                <p className="text-sm font-semibold truncate" style={{ color: "#1e293b" }}>{li.description} · {peso(li.amount)}</p>
                <p className="text-xs" style={{ color: blocked(li) ? "#b91c1c" : "#0891b2" }}>{availableText(li)}</p>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-xs" style={{ color: "#94a3b8" }}>No matching item.</li>}
          </ul>
          {shown && (
            <div className="md:w-1/2 border-t md:border-t-0 md:border-l" style={{ borderColor: "#e2e8f0" }}>
              <ItemDetails item={shown} totals={totals?.get(shown.id)} failed={failed} />
            </div>
          )}
        </div>
      )}
      {!open && selected && (
        <div className="mt-1.5 rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
          <ItemDetails item={selected} totals={totals?.get(selected.id)} failed={failed} />
        </div>
      )}
    </div>
  );
}

function ItemDetails({ item, totals, failed }: { item: LineItem; totals?: ItemTotals; failed: boolean }) {
  const spec = item.specification?.trim();
  return (
    <div className="px-3 py-2 space-y-1.5 text-xs" aria-live="polite">
      <p className="font-bold" style={{ color: "#0d2a5e" }}>{item.description}</p>
      <p className="whitespace-pre-line" style={{ color: spec ? "#334155" : "#94a3b8" }}>
        <b>Specification:</b> {spec || "No specification provided"}
      </p>
      {totals ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {([
            ["Approved", totals.approved],
            ["Committed (unpaid)", totals.unpaid],
            ["Paid", totals.paid],
            ["Available to request", totals.available],
          ] as const).map(([label, n]) => (
            <div key={label} className="contents">
              <dt style={{ color: "#64748b" }}>{label}</dt>
              <dd className="text-right font-mono font-bold" style={{ color: label === "Available to request" ? (n > 0 ? "#0891b2" : "#b91c1c") : "#0f172a" }}>{peso(n)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p style={{ color: "#94a3b8" }}>{failed ? "The available amount couldn't be loaded. The year's amount below still applies." : "Loading the amounts…"}</p>
      )}
    </div>
  );
}
