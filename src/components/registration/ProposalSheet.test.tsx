import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalSheet, type ProposalData } from "./ProposalPreview";

const manual: ProposalData = {
  title: "Bridging Academia", lead_name: "A. Reyes", lead_gender: "female", co_leaders: [], team: [],
  start_date: "2027-01-01", target_end_date: "2027-12-31", total_cost: "12250", implementing_unit: "", campus: "Siniloan",
  contact_number: "", cooperating_agencies: "", sectors: ["education"], sector_other: "", is_continuing: false, continuing_year: "",
  research_type: "applied", is_dry_research: true, study_titles: ["Study A", "Study B"], rde_thrust: "Thrust 1", rde_priority: "1.3 AI",
  research_typology: ["quantitative"], sdgs: [4], objectives: ["Map community needs"],
  outputs: [{ category: "publications", description: "Journal article", target_count: 1 }],
  beneficiaries: [{ group: "Faculty", description: "CTE", total: 10 }],
  budget: [{ category: "mooe", description: "Office Supplies Expenses", specification: "PAPER, 80 gsm, A4", unit: "unit", quantity: 10, unit_cost: 225, total: 2250,
             allocations: [{ period: "Q1", amount: 2250 }] }],
  allocation_periods: ["Q1", "Q2", "Q3", "Q4"],
  work_plan: [{ title: "Logistic preparations", start_date: "2027-01-01", target_date: "2027-03-31" }],
};
// Upload via Excel previews the backend's proposal_preview, which still carries the fields that left the registration
const excel = {
  ...manual,
  research_priority_area: "health", background: "Old background", methodology: "Old method", socio_economic_significance: "Old significance",
  monitoring_evaluation: "Old M&E", references: "Old references", college: "CTE", proposal_submitted_on: "2026-01-01",
  endorsers: [{ name: "Dean A", designation: "Dean/Associate Dean", signed_on: "2026-01-02" }],
} as unknown as ProposalData;
const html = (data: ProposalData) => renderToStaticMarkup(<ProposalSheet data={data} />);
const sections = (markup: string) => [...markup.matchAll(/uppercase"[^>]*>([^<]+)</g)].map((m) => m[1]);

describe("Register Approved Project Preview (Task 14)", () => {
  it("keeps X. Budget Requirements with the Specification and XI. Work Plan", () => {
    const out = html(manual);
    for (const text of ["X. Budget Requirements", "Office Supplies Expenses", "PAPER, 80 gsm, A4", "XI. Work Plan", "Logistic preparations", "Map community needs"]) {
      expect(out).toContain(text);
    }
  });

  it("shows none of the fields that left the registration, even when the Excel preview still sends them", () => {
    const out = html(excel);
    for (const text of ["Annex A", "ENDORSEMENT PAGE", "Research Priority Area", "II. Background", "IV. Project Descriptions", "VI. Socio-Economic",
                        "VIII. Monitoring", "IX. List of References", "Old background", "Old references", "Dean A", "College Unit"]) {
      expect(out).not.toContain(text);
    }
  });

  it("gives Manual Entry and Upload via Excel the same sections", () => {
    expect(sections(html(excel))).toEqual(sections(html(manual)));
    expect(sections(html(manual))).toEqual([
      "I. Project/Study Details", "Sector", "Research Proposal Classification", "Study Component Titles", "RDE Agenda", "Research Typology",
      "Sustainable Development Goals (SDGs)", "III. Objectives of the Study", "V. Quantifiable Expected Outputs: 6Ps", "VII. Target Beneficiaries",
      "X. Budget Requirements", "XI. Work Plan",
    ]);
  });

  it("leaves out blank optional lines and shows them once filled", () => {
    const blank = html(manual);
    for (const label of ["CONTACT NO/S.", "COOPERATING AGENCY/IES", "CO-PROJECT LEADER", "PROJECT TEAM/GENDER", "IMPLEMENTING UNIT"]) {
      expect(blank).not.toContain(label);
    }
    const filled = html({ ...manual, contact_number: "0917", cooperating_agencies: "DOST", implementing_unit: "CTE", co_leaders: [{ name: "B. Cruz", gender: "male" }] });
    for (const text of ["CONTACT NO/S.: 0917", "COOPERATING AGENCY/IES: DOST", "IMPLEMENTING UNIT: CTE", "CO-PROJECT LEADER/GENDER: B. Cruz, Male"]) {
      expect(filled).toContain(text);
    }
  });
});
