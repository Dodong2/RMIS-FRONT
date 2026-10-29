import { describe, expect, it } from "vitest";
import type { LineItem } from "../types/budget";
import type { ExpectedOutput } from "../types/outputs";
import type { Milestone, Project, ProjectEndorser, ProjectTeamMember, Study, TargetBeneficiary } from "../types/research";
import { registrationDraft, type RegistrationPayload } from "./registrationDraft";

const project = {
  id: 7, lead: 3, title: "Bridging Academia", project_code: "LSPU-X1", funding_type: "institutional", lead_gender: "female",
  contact_number: "0917", ntp_number: "NTP-1", ntp_date: null, toe_signed_date: null, is_dry_research: null,
  start_date: "2026-01-01", target_end_date: "2027-12-31", rde_thrust: "", rde_priority: "", sdgs: [4, 11],
  sectors: ["education"], sector_other: "", is_continuing: false, continuing_year: null, research_type: "applied",
  research_priority_area: "", research_typology: [], campus: "Siniloan", implementing_unit: "", college: "CTE",
  total_cost: "10000.00", background: "<p>Why</p>", methodology: "", socio_economic_significance: "", monitoring_evaluation: "",
  references: "", description: "", expected_outcomes: "", expected_impacts: "", proposal_submitted_on: null,
  proposal_reviewed_on: null, proposal_approved_on: null, reviewing_body: "", cooperating_agencies: "DOST, LGU of Siniloan",
  objectives: "1. Train teachers\n2. Map communities",
} as unknown as Project;

const payload: RegistrationPayload = {
  project,
  team: [{ id: 21, member_role: "co_leader", name: "A. Jain", gender: "male", user: null } as ProjectTeamMember],
  studies: [{ id: 32, title: "Study B" } as Study, { id: 31, title: "Study A" } as Study],
  outputs: [{ id: 41, category: "patents", description: "Novel", target_count: 1 } as ExpectedOutput],
  beneficiaries: [{ id: 51, group: "Farmers", description: "Rice", total: 200 } as TargetBeneficiary],
  milestones: [{ id: 61, title: "Logistics", start_date: "2026-01-01", target_date: "2026-03-31", tasks_total: 2 } as Milestone],
  endorsers: [{ id: 71, role_code: "", user: null, name: "A. Roman", designation: "Dean", signed_on: null } as ProjectEndorser],
  line_items: [{
    id: 81, category: "mooe", description: "Training Expenses", unit: "lot", quantity: "1.00", unit_cost: "10000.00", amount: "10000.00",
    fiscal_year: 2026, allocations: [{ period: "Y1Q1", amount: "10000.00" }],
  } as LineItem],
};

describe("registrationDraft (Edit Registration and Excel review, client 2026-10-23)", () => {
  it("maps the registration into the wizard's fields", () => {
    const d = registrationDraft(payload, true);
    // The NTP number is the project code since 2026-10-29; the wizard keeps only the NTP
    expect([d.form.title, d.form.ntp_number, d.form.is_dry_research, d.form.is_continuing, d.form.sdgs, d.form.implementing_unit]).toEqual([
      "Bridging Academia", "NTP-1", "na", "false", ["4", "11"], "CTE",
    ]);
    expect("project_code" in d.form).toBe(false);
    expect(d.agencies).toEqual(["DOST", "LGU of Siniloan"]);
    expect(d.objectives).toEqual(["Train teachers", "Map communities"]);
    expect(d.studyTitles).toEqual(["Study A", "Study B"]);
    expect(d.libRows).toEqual([{ category: "mooe", description: "Training Expenses", unit: "lot", quantity: "1.00", unit_cost: "10000.00", allocations: { Y1Q1: "10000.00" } }]);
    expect(d.libYear).toBe("2026");
  });

  it("keeps the row ids when editing a registered project", () => {
    const d = registrationDraft(payload, true);
    expect([d.team[0].id, d.outputRows[0].id, d.beneficiaryRows[0].id, d.workPlanRows[0].id, d.endorsers[0].id]).toEqual([21, 41, 51, 61, 71]);
    expect(d.workPlanRows[0].tasks).toBe(2);
  });

  it("drops the row ids for a workbook, so registering creates every row", () => {
    const d = registrationDraft(payload, false);
    for (const rows of [d.team, d.outputRows, d.beneficiaryRows, d.workPlanRows, d.endorsers]) {
      expect(rows.every((row) => !("id" in row))).toBe(true);
    }
    expect(d.workPlanRows[0]).toEqual({ title: "Logistics", start_date: "2026-01-01", target_date: "2026-03-31", tasks: 2 });
  });

  it("keeps the values of the fields that left the form, so saving sends them back unchanged (client 2026-10-29)", () => {
    const old = { ...project, research_priority_area: "health", methodology: "<p>How</p>", description: "Summary", expected_impacts: "Jobs" } as Project;
    for (const editing of [true, false]) {
      const d = registrationDraft({ ...payload, project: old }, editing);
      expect([d.form.research_priority_area, d.form.background, d.form.methodology, d.form.description, d.form.expected_impacts]).toEqual([
        "health", "<p>Why</p>", "<p>How</p>", "Summary", "Jobs",
      ]);
    }
  });

  it("starts empty lists with one blank row where the wizard expects one", () => {
    const d = registrationDraft({ ...payload, studies: [], beneficiaries: [], project: { ...project, objectives: "" } }, false);
    expect([d.studyTitles, d.objectives, d.beneficiaryRows]).toEqual([[""], [""], [{ group: "", description: "", total: "" }]]);
  });
});
