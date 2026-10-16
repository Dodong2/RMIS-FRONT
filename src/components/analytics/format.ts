const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;

export const monthLabel = (yyyyMm: string) => `${MONTHS[Number(yyyyMm.slice(5)) - 1]} ${yyyyMm.slice(2, 4)}`;


export const STATUS_LABELS: Record<string, string> = { active: "Active", completed: "Completed", archived: "Archived" };

// Keeps a fixed-position tooltip inside the viewport so the card never clips it.
export function tipPosition(clientX: number, clientY: number, width = 238, height = 132) {
  return {
    x: Math.max(12, Math.min(clientX + 14, window.innerWidth - width)),
    y: Math.max(12, Math.min(clientY + 14, window.innerHeight - height)),
  };
}

// Integer axis for count charts: a 1/2/5×10ⁿ step and a max one step above the largest value (headroom).
export function countAxis(maxValue: number) {
  const rough = Math.max(1, maxValue / 4);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const max = (Math.floor(maxValue / step) + 1) * step;
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) };
}
