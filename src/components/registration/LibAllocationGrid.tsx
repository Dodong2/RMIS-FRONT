import { MoneyInput } from "../common/MoneyInput";
import { allocatedTotal, periodQuarter, periodYear } from "../../lib/libUnits";

export type AllocationGridRow = { index: number; description: string; total: number; allocations?: Record<string, string> };
export type AllocationGridGroup = { label: string; rows: AllocationGridRow[] };

const peso = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const line = "1px solid #cbd5e1";
const yearLine = "2px solid #1e3a8a";
const cell = { border: line };
const head = { ...cell, background: "#1e3a8a", color: "white" };
const subHead = { ...cell, background: "#dbeafe", color: "#0d2a5e" };

export function LibAllocationGrid({
  groups,
  periods,
  onChange,
}: {
  groups: AllocationGridGroup[];
  periods: string[];
  onChange: (index: number, period: string, value: string) => void;
}) {
  const multiYear = periods[0][0] === "Y";
  const years = [...new Set(periods.map(periodYear))];
  const filled = groups.filter((g) => g.rows.length > 0);
  // Thick line where a new year starts, plus a light tint on every other year, so the columns are easy to follow.
  const startsYear = (p: string, i: number) => multiYear && (i === 0 || periodYear(periods[i - 1]) !== periodYear(p));
  const yearTint = (p: string) => (multiYear && periodYear(p) % 2 === 0 ? "#f1f5f9" : "white");

  return (
    <div className="space-y-1">
      {years.length > 1 && <p className="text-[11px]" style={{ color: "#64748b" }}>Scroll sideways to see all {years.length} years.</p>}
      <div className="rounded-xl overflow-x-auto" style={{ border: line }}>
      <table className="text-xs w-full" style={{ borderCollapse: "collapse", minWidth: 380 + periods.length * 130 }}>
        <thead>
          <tr>
            <th rowSpan={multiYear ? 2 : 1} className="px-3 py-2 text-left font-bold sticky left-0 z-10" style={{ ...head, minWidth: 200 }}>LIB</th>
            {multiYear
              ? years.map((y) => (
                  <th key={y} colSpan={periods.filter((p) => periodYear(p) === y).length} className="px-2 py-2 font-bold tracking-wide" style={{ ...head, borderLeft: yearLine }}>
                    YEAR {y}
                  </th>
                ))
              : periods.map((p) => (
                  <th key={p} className="px-2 py-2 font-bold" style={head}>{p}</th>
                ))}
            <th rowSpan={multiYear ? 2 : 1} className="px-3 py-2 text-right font-bold whitespace-nowrap sticky right-0 z-10" style={{ ...head, borderLeft: yearLine, minWidth: 180 }}>Allocated / Total</th>
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
          {filled.length === 0 && (
            <tr>
              <td colSpan={periods.length + 2} className="px-3 py-3 text-center" style={{ ...cell, color: "#94a3b8" }}>
                Items show up here once they have a description and a total.
              </td>
            </tr>
          )}
          {filled.map((g) => [
            <tr key={g.label}>
              <td colSpan={periods.length + 2} className="px-3 py-1.5 font-bold uppercase tracking-wide" style={{ ...cell, background: "#e2e8f0", color: "#0d2a5e" }}>
                {g.label}
              </td>
            </tr>,
            ...g.rows.map((r) => {
              const allocated = allocatedTotal(r.allocations, periods);
              const ok = allocated === r.total;
              return (
                <tr key={r.index}>
                  <td className="px-3 py-1.5 font-semibold sticky left-0 z-[1] bg-white" style={{ ...cell, color: "#334155" }}>{r.description}</td>
                  {periods.map((p, i) => (
                    <td key={p} className="p-1" style={{ ...cell, background: yearTint(p), borderLeft: startsYear(p, i) ? yearLine : line }}>
                      <MoneyInput
                        className="w-full px-2 py-1.5 rounded-md border text-xs text-right outline-none focus:border-[#0891b2]"
                        style={{ borderColor: "#94a3b8", background: "white", color: "#0f172a", minWidth: 110 }}
                        value={r.allocations?.[p] ?? ""}
                        onChange={(v) => onChange(r.index, p, v)}
                        placeholder="0.00"
                        aria-label={`${r.description} ${multiYear ? `Year ${periodYear(p)} ` : ""}${periodQuarter(p)} allocation`}
                      />
                    </td>
                  ))}
                  <td
                    className="px-3 py-1.5 text-right font-mono font-semibold whitespace-nowrap sticky right-0 z-[1]"
                    style={{ ...cell, borderLeft: yearLine, background: ok ? "#f0fdf4" : "#fef2f2", color: ok ? "#15803d" : "#b91c1c" }}
                  >
                    ₱{peso(allocated)} / ₱{peso(r.total)}
                  </td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
      </div>
    </div>
  );
}
