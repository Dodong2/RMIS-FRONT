import type { AdminChoice } from "../types/research";

/** LSPU 2024-2028 RDE Agenda (client 2026-10-20): thrusts (no parent) and their priority areas, from Admin > RDE Thrusts. */
export type RdeThrust = AdminChoice & { priorities: AdminChoice[] };

export function compareRdeCodes(a = "", b = ""): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return Number.isNaN(d) ? a.localeCompare(b) : d;
  }
  return 0;
}

export function buildRdeAgenda(choices: AdminChoice[]): RdeThrust[] {
  const byCode = (x: AdminChoice, y: AdminChoice) => compareRdeCodes(x.code, y.code);
  return choices
    .filter((c) => !c.parent)
    .sort(byCode)
    .map((t) => ({ ...t, priorities: choices.filter((c) => c.parent === t.id).sort(byCode) }));
}

export function rdeLabel(c: AdminChoice): string {
  return c.code && c.title ? `${c.code}. ${c.title}` : c.name;
}

export function nextPriorityCode(thrust: RdeThrust): string {
  const last = thrust.priorities.reduce((n, p) => Math.max(n, Number(p.code?.split(".")[1]) || 0), 0);
  return `${thrust.code}.${last + 1}`;
}
