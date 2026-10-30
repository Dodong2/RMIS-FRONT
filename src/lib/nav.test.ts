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
