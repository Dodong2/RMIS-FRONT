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
