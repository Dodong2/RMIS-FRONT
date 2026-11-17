import { describe, expect, it } from "vitest";
import { visibleTargets } from "./nav";
import { resolveTier } from "./roles";

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

describe("Budget Forecasting in the sidebar (Task 27; roles from client Task 66, 2026-11-16)", () => {
  it("shows for Project Leader, RIUH, CRC/CRD, Finance and System Admin", () => {
    expect(visibleTargets("project_management", "project_leader")).toContain("/budget/forecast");
    expect(visibleTargets("college_oversight", "riuh")).toContain("/budget/forecast");
    expect(visibleTargets("campus_coordination", "crc_chair")).toContain("/budget/forecast");
    expect(visibleTargets("finance", "finance_budget")).toContain("/budget/forecast");
    expect(visibleTargets("system_admin", "system_admin")).toContain("/budget/forecast");
  });

  it("is hidden from VP for REI, University Administration, Procurement and Project Staff", () => {
    expect(visibleTargets("institution_oversight", "vprei")).not.toContain("/budget/forecast");
    expect(visibleTargets("institution_oversight", "university_admin")).not.toContain("/budget/forecast");
    expect(visibleTargets("procurement", "procurement_officer_lib")).not.toContain("/budget/forecast");
    expect(visibleTargets("execution", "project_staff")).not.toContain("/budget/forecast");
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

describe("Decision Support System in the sidebar (client Task 76, 2026-11-18)", () => {
  it("shows for System Admin, VP for REI, University Administration and CRC/CRD", () => {
    for (const code of ["system_admin", "vprei", "university_admin", "crc_chair"]) {
      expect(visibleTargets(resolveTier({ code }), code)).toContain("/decision-support");
    }
  });

  it("is hidden from every other role", () => {
    for (const code of ["riuh", "finance_budget", "procurement_officer_lib", "project_leader", "project_staff"]) {
      expect(visibleTargets(resolveTier({ code }), code)).not.toContain("/decision-support");
    }
  });
});
