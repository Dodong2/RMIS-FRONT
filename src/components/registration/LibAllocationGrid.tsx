import type { ReactNode } from "react";
import { MoneyInput } from "../common/MoneyInput";
import { allocatedTotal, periodQuarter, periodYear } from "../../lib/libUnits";

export type AllocationGridRow = { index: number; description: string; total: number; allocations?: Record<string, string> };
export type AllocationGridGroup = { key: string; label: string; subtotal: number; rows: AllocationGridRow[] };
/** The Item, Specification, Unit, Qty and Unit Cost inputs of one LIB row. */
export type ItemCells = [ReactNode, ReactNode, ReactNode, ReactNode, ReactNode];

const peso = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const line = "1px solid #cbd5e1";
const yearLine = "2px solid #1e3a8a";
const cell = { border: line };
const head = { ...cell, background: "#1e3a8a", color: "white" };
const subHead = { ...cell, background: "#dbeafe", color: "#0d2a5e" };
const ITEM_HEADERS: [string, number][] = [["Item", 220], ["Specification", 200], ["Unit", 96], ["Qty", 76], ["Unit Cost (₱)", 130], ["Total (₱)", 120]];

/** Client 2026-10-23: the LIB is entered inside the Allocation per Quarter table, PS / MOOE / CO each with its own items. */
export function LibAllocationGrid({
  groups,
  periods,
  onChange,
  itemCells,
  onAdd,
  onRemove,
}: {
  groups: AllocationGridGroup[];
  periods: string[];
  onChange: (index: number, period: string, value: string) => void;
  itemCells: (index: number) => ItemCells;
  onAdd: (category: string) => void;
  onRemove: (index: number) => void;
}) {
  const multiYear = periods[0][0] === "Y";
  const years = [...new Set(periods.map(periodYear))];
  const columns = ITEM_HEADERS.length + periods.length + 2;
  // Thick line where a new year starts, plus a light tint on every other year, so the columns are easy to follow.
  const startsYear = (p: string, i: number) => multiYear && (i === 0 || periodYear(periods[i - 1]) !== periodYear(p));
  const yearTint = (p: string) => (multiYear && periodYear(p) % 2 === 0 ? "#f1f5f9" : "white");

  return (
    <div className="space-y-1">
      <p className="text-[11px]" style={{ color: "#64748b" }}>
        Scroll sideways to see {years.length > 1 ? `all ${years.length} years` : "every quarter"}. Total = Qty × Unit Cost; split each total over the quarters.
      </p>
      <div className="rounded-xl overflow-x-auto" style={{ border: line }}>
        <table className="text-xs w-full" style={{ borderCollapse: "collapse", minWidth: 900 + periods.length * 130 }}>
          <thead>
            <tr>
              {ITEM_HEADERS.map(([h, width], i) => (
                <th
                  key={h}
                  rowSpan={multiYear ? 2 : 1}
                  className={`px-3 py-2 font-bold ${i === 0 ? "text-left sticky left-0 z-10" : i === 5 ? "text-right" : "text-left"}`}
                  style={{ ...head, minWidth: width }}
                >
                  {h}
                </th>
              ))}
              {multiYear
                ? years.map((y) => (
                    <th key={y} colSpan={periods.filter((p) => periodYear(p) === y).length} className="px-2 py-2 font-bold tracking-wide" style={{ ...head, borderLeft: yearLine }}>
                      YEAR {y}
                    </th>
                  ))
                : periods.map((p, i) => (
                    <th key={p} className="px-2 py-2 font-bold" style={{ ...head, borderLeft: i === 0 ? yearLine : line }}>{p}</th>
                  ))}
              <th rowSpan={multiYear ? 2 : 1} className="px-3 py-2 text-right font-bold whitespace-nowrap" style={{ ...head, borderLeft: yearLine, minWidth: 180 }}>Allocated / Total</th>
              <th rowSpan={multiYear ? 2 : 1} style={{ ...head, minWidth: 36 }} aria-label="Remove" />
            </tr>
            {multiYear && (
              <tr>
                {periods.map((p, i) => (
                  <th key={p} className="px-2 py-1.5 font-bold" style={{ ...subHead, borderLeft: startsYear(p, i) ? yearLine : line }}>{periodQuarter(p)}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {groups.map((g) => [
              <tr key={g.key}>
                <td colSpan={columns} className="px-3 py-1.5" style={{ ...cell, background: "#e2e8f0" }}>
                  <div className="flex items-center gap-4 sticky left-3 w-fit">
                    <span className="font-bold uppercase tracking-wide" style={{ color: "#0d2a5e" }}>{g.label}</span>
                    <button type="button" onClick={() => onAdd(g.key)} className="text-xs font-semibold flex items-center gap-1" style={{ color: "#0891b2" }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Add Item
                    </button>
                  </div>
                </td>
              </tr>,
              ...(g.rows.length === 0
                ? [
                    <tr key={`${g.key}-empty`}>
                      <td colSpan={columns} className="px-3 py-2" style={{ ...cell, color: "#94a3b8" }}>
                        No items.
                      </td>
                    </tr>,
                  ]
                : g.rows.map((r) => {
                    const allocated = allocatedTotal(r.allocations, periods);
                    const ok = allocated === r.total;
                    const [item, specification, unit, qty, unitCost] = itemCells(r.index);
                    const label = r.description || "New item";
                    return (
                      <tr key={r.index}>
                        <td className="p-1 sticky left-0 z-[1] bg-white" style={cell}>{item}</td>
                        <td className="p-1" style={cell}>{specification}</td>
                        <td className="p-1" style={cell}>{unit}</td>
                        <td className="p-1" style={cell}>{qty}</td>
                        <td className="p-1" style={cell}>{unitCost}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold whitespace-nowrap" style={{ ...cell, background: "#f1f5f9", color: "#0d2a5e" }}>
                          {peso(r.total)}
                        </td>
                        {periods.map((p, i) => (
                          <td key={p} className="p-1" style={{ ...cell, background: yearTint(p), borderLeft: startsYear(p, i) || (!multiYear && i === 0) ? yearLine : line }}>
                            <MoneyInput
                              className="w-full px-2 py-1.5 rounded-md border text-xs text-right outline-none focus:border-[#0891b2]"
                              style={{ borderColor: "#94a3b8", background: "white", color: "#0f172a", minWidth: 110 }}
                              value={r.allocations?.[p] ?? ""}
                              onChange={(v) => onChange(r.index, p, v)}
                              placeholder="0.00"
                              aria-label={`${label} ${multiYear ? `Year ${periodYear(p)} ` : ""}${periodQuarter(p)} allocation`}
                            />
                          </td>
                        ))}
                        <td
                          className="px-3 py-1.5 text-right font-mono font-semibold whitespace-nowrap"
                          style={{ ...cell, borderLeft: yearLine, background: ok ? "#f0fdf4" : "#fef2f2", color: ok ? "#15803d" : "#b91c1c" }}
                        >
                          ₱{peso(allocated)} / ₱{peso(r.total)}
                        </td>
                        <td className="px-1 text-center" style={cell}>
                          <button type="button" onClick={() => onRemove(r.index)} className="p-1 rounded" style={{ color: "#94a3b8" }} aria-label={`Remove ${label}`} title="Remove item">
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })),
              <tr key={`${g.key}-subtotal`}>
                <td colSpan={5} className="px-3 py-1.5 text-right font-semibold" style={{ ...cell, color: "#64748b" }}>
                  <span className="sticky left-3">Subtotal</span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold whitespace-nowrap" style={{ ...cell, color: "#0d2a5e" }}>{peso(g.subtotal)}</td>
                <td colSpan={periods.length + 2} style={cell} />
              </tr>,
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
