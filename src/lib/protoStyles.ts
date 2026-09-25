export const INPUT_CLS = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2] disabled:opacity-60";
export const INPUT_STYLE = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };
export const invalidStyle = (bad: boolean) => ({ ...INPUT_STYLE, borderColor: bad ? "#dc2626" : "#e2e8f0" });

export const BTN_PRIMARY = "px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60";
export const BTN_PRIMARY_STYLE = { background: "#0d2a5e" };
export const BTN_SOFT = "px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60";
export const BTN_SOFT_STYLE = { background: "#e0f2fe", color: "#0369a1" };
export const BTN_GHOST_STYLE = { background: "#f1f5f9", color: "#64748b" };
