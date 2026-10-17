import { MoneyInput } from "../common/MoneyInput";
import { allocatedTotal, periodQuarter, periodYear } from "../../lib/libUnits";

export type AllocationGridRow = { index: number; description: string; total: number; allocations?: Record<string, string> };
export type AllocationGridGroup = { label: string; rows: AllocationGridRow[] };

const peso = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cell = { border: "1px solid #e2e8f0" };
const head = { ...cell, background: "#f0f4f8", color: "#0d2a5e" };

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

  return (
    <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
      <table className="text-xs w-full" style={{ borderCollapse: "collapse", minWidth: 220 + periods.length * 120 }}>
        <thead>
          <tr>
            <th rowSpan={multiYear ? 2 : 1} className="px-3 py-2 text-left font-bold sticky left-0 z-10" style={{ ...head, minWidth: 200 }}>LIB</th>
            {multiYear
              ? years.map((y) => (
                  <th key={y} colSpan={periods.filter((p) => periodYear(p) === y).length} className="px-2 py-1.5 font-bold" style={head}>
                    YEAR {y}
                  </th>
                ))
              : periods.map((p) => (
                  <th key={p} className="px-2 py-2 font-bold" style={head}>{p}</th>
                ))}
            <th rowSpan={multiYear ? 2 : 1} className="px-3 py-2 text-right font-bold whitespace-nowrap" style={head}>Allocated / Total</th>
          </tr>
          {multiYear && (
            <tr>
              {periods.map((p) => (
                <th key={p} className="px-2 py-1.5 font-semibold" style={{ ...head, color: "#64748b" }}>{periodQuarter(p)}</th>
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
              <td colSpan={periods.length + 2} className="px-3 py-1.5 font-bold uppercase tracking-wide" style={{ ...cell, background: "#f8fafc", color: "#64748b" }}>
                {g.label}
              </td>
            </tr>,
            ...g.rows.map((r) => {
              const allocated = allocatedTotal(r.allocations, periods);
              const ok = allocated === r.total;
              return (
                <tr key={r.index}>
                  <td className="px-3 py-1.5 font-semibold sticky left-0 bg-white" style={{ ...cell, color: "#334155" }}>{r.description}</td>
                  {periods.map((p) => (
                    <td key={p} className="p-1" style={cell}>
                      <MoneyInput
                        className="w-full px-2 py-1.5 rounded-lg border text-xs text-right outline-none focus:border-[#0891b2]"
                        style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155", minWidth: 100 }}
                        value={r.allocations?.[p] ?? ""}
                        onChange={(v) => onChange(r.index, p, v)}
                        placeholder="0.00"
                        aria-label={`${r.description} ${multiYear ? `Year ${periodYear(p)} ` : ""}${periodQuarter(p)} allocation`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-mono font-semibold whitespace-nowrap" style={{ ...cell, color: ok ? "#15803d" : "#b91c1c" }}>
                    ₱{peso(allocated)} / ₱{peso(r.total)}
                  </td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </div>
  );
}
