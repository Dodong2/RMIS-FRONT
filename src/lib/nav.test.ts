import { describe, expect, it } from "vitest";
import { visibleTargets } from "./nav";

describe("Project Management in the sidebar (client 2026-10-20)", () => {
  it("is hidden from Project Staff, who keep Personnel & Tasks", () => {
    const targets = visibleTargets("execution", "project_staff");
    expect(targets).not.toContain("/projects");
    expect(targets).toContain("/tasks");
  });

  it("stays for Project Leaders and System Admins", () => {
    expect(visibleTargets("project_management", "project_leader")).toContain("/projects");
    expect(visibleTargets("system_admin", "system_admin")).toContain("/projects");
  });
});

describe("Budget Forecasting in the sidebar (Task 27, 2026-10-30)", () => {
  it("shows for Project Leaders and keeps the existing roles", () => {
    expect(visibleTargets("project_management", "project_leader")).toContain("/budget/forecast");
    expect(visibleTargets("system_admin", "system_admin")).toContain("/budget/forecast");
    expect(visibleTargets("finance", "finance_budget")).toContain("/budget/forecast");
  });

  it("stays hidden from Project Staff, Procurement and CRC/CRD", () => {
    expect(visibleTargets("execution", "project_staff")).not.toContain("/budget/forecast");
    expect(visibleTargets("procurement", "procurement_officer_lib")).not.toContain("/budget/forecast");
    expect(visibleTargets("campus_coordination", "crc_chair")).not.toContain("/budget/forecast");
  });
});

describe("Personnel Coordination group (client Task 54, 2026-11-10)", () => {
  const OVERSIGHT_ROLES = [
    ["system_admin", "system_admin"],
    ["institution_oversight", "vprei"],
    ["institution_oversight", "university_admin"],
    ["campus_coordination", "crc_chair"],
    ["college_oversight", "riuh"],
  ] as const;

  it("shows all three pages to the five oversight roles", () => {
    for (const [tier, code] of OVERSIGHT_ROLES) {
      const targets = visibleTargets(tier, code);
      expect(targets, code).toEqual(expect.arrayContaining(["/staff", "/leader-load", "/personnel-changes"]));
    }
  });

  it("shows only Leader Load to the Project Leader", () => {
    const targets = visibleTargets("project_management", "project_leader");
    expect(targets).toContain("/leader-load");
    expect(targets).not.toContain("/staff");
    expect(targets).not.toContain("/personnel-changes");
  });

  it("hides all three from the other roles", () => {
    for (const [tier, code] of [
      ["finance", "finance_budget"],
      ["procurement", "procurement_officer_lib"],
      ["execution", "project_staff"],
    ] as const) {
      const targets = visibleTargets(tier, code);
      for (const path of ["/staff", "/leader-load", "/personnel-changes"]) expect(targets, `${code} ${path}`).not.toContain(path);
    }
  });
});

describe("Budget Office Sync in the sidebar (Task 64-B, 2026-11-16)", () => {
  it("is hidden from Finance/Accounting/Budget", () => {
    expect(visibleTargets("finance", "finance_budget")).not.toContain("/budget-sync");
  });

  it("stays for System Admin and institution oversight", () => {
    expect(visibleTargets("system_admin", "system_admin")).toContain("/budget-sync");
    expect(visibleTargets("institution_oversight", "vprei")).toContain("/budget-sync");
  });
});
