import { describe, expect, it } from "vitest";
import { DRY_RESEARCH_OPTIONS, RESEARCH_TYPE_LABELS, dryResearchChoice, dryResearchLabel, dryResearchValue } from "./projectOptions";

describe("Wet or Dry Research (client 2026-10-23: Not Applicable)", () => {
  it("offers Dry, Wet and Not Applicable", () => {
    expect(DRY_RESEARCH_OPTIONS.map(([value]) => value)).toEqual(["true", "false", "na"]);
    expect(DRY_RESEARCH_OPTIONS[2][1]).toBe("Not Applicable");
  });

  it("turns the select value into what the API stores", () => {
    expect([dryResearchValue("true"), dryResearchValue("false"), dryResearchValue("na")]).toEqual([true, false, null]);
  });

  it("loads a saved project back into the select", () => {
    expect([dryResearchChoice(true), dryResearchChoice(false), dryResearchChoice(null)]).toEqual(["true", "false", "na"]);
  });

  it("labels a project for the detail page", () => {
    expect([dryResearchLabel(true), dryResearchLabel(false), dryResearchLabel(null)]).toEqual(["Dry research", "Wet research", "Not applicable"]);
  });
});

describe("Basic or Applied Research", () => {
  it("keeps Basic and Applied and adds Not Applicable", () => {
    expect(RESEARCH_TYPE_LABELS).toEqual({ basic: "Basic Research", applied: "Applied Research", not_applicable: "Not Applicable" });
  });
});
