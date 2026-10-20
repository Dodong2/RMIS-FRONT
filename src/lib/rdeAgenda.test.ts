import { describe, expect, it } from "vitest";
import type { AdminChoice } from "../types/research";
import { buildRdeAgenda, compareRdeCodes, nextPriorityCode, rdeLabel } from "./rdeAgenda";

const row = (id: number, code: string, title: string, parent: number | null = null): AdminChoice => ({
  id, code, title, name: `${code} - ${title}`, parent, created_at: "",
});

describe("compareRdeCodes", () => {
  it("orders dotted codes numerically", () => {
    expect(["1.10", "1.2", "1.9", "2", "1"].sort(compareRdeCodes)).toEqual(["1", "1.2", "1.9", "1.10", "2"]);
  });
});

describe("buildRdeAgenda", () => {
  it("nests priority areas under their thrust, both in code order", () => {
    const agenda = buildRdeAgenda([
      row(3, "1.10", "Quantum", 1), row(2, "2", "Natural Resources Management"),
      row(1, "1", "Computing and Emerging Technologies"), row(4, "1.2", "Business Intelligence", 1),
    ]);

    expect(agenda.map((t) => t.code)).toEqual(["1", "2"]);
    expect(agenda[0].priorities.map((p) => p.code)).toEqual(["1.2", "1.10"]);
    expect(agenda[1].priorities).toEqual([]);
  });
});

describe("rdeLabel / nextPriorityCode", () => {
  it("labels like the agenda and suggests the next number", () => {
    const [computing] = buildRdeAgenda([row(1, "1", "Computing"), row(2, "1.9", "Cyber", 1)]);

    expect(rdeLabel(computing.priorities[0])).toBe("1.9. Cyber");
    expect(nextPriorityCode(computing)).toBe("1.10");
  });
});
