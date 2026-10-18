import { describe, expect, it } from "vitest";
import { needsTeamConfirm, teamMissing } from "./teamRows";

const row = (member_role: string, name: string, user: number | null = null) => ({ member_role, name, gender: "", user });

describe("teamMissing", () => {
  it("needs the Project Leader", () => {
    expect(teamMissing("", [])).toEqual(["Project Leader"]);
    expect(teamMissing("7", [])).toEqual([]);
  });

  it("allows no team rows at all", () => {
    expect(teamMissing("7", [])).toEqual([]);
  });

  it("flags every added row without a member, by its number and role", () => {
    expect(teamMissing("7", [row("co_leader", "Ana"), row("member", "  "), row("co_leader", "")])).toEqual([
      "the member of Team row 2 (Team Member)",
      "the member of Team row 3 (Co-Project Leader)",
    ]);
  });

  it("accepts typed names without an account and ignores gender", () => {
    expect(teamMissing("7", [row("member", "EIU Coordinators"), row("co_leader", "Ana", 3)])).toEqual([]);
  });
});

describe("needsTeamConfirm", () => {
  it("asks once, when leaving Step 2 (index 1) or jumping past it", () => {
    expect(needsTeamConfirm(1, 2, false)).toBe(true);
    expect(needsTeamConfirm(0, 4, false)).toBe(true);
    expect(needsTeamConfirm(1, 2, true)).toBe(false);
  });

  it("does not ask when moving back or within the first steps", () => {
    expect(needsTeamConfirm(3, 1, false)).toBe(false);
    expect(needsTeamConfirm(0, 1, false)).toBe(false);
    expect(needsTeamConfirm(3, 5, false)).toBe(false);
  });
});
