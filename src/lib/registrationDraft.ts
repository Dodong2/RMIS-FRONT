import type { LineItem } from "../types/budget";
import type { ExpectedOutput } from "../types/outputs";
import type { Milestone, Project, ProjectEndorser, ProjectTeamMember, Study, TargetBeneficiary } from "../types/research";
import { dryResearchChoice } from "./projectOptions";

/** A project and its tables in API shapes: a registered project (Edit Registration) or an Excel dry run's `draft`. */
export type RegistrationPayload = {
  project: Project;
  team: ProjectTeamMember[];
  studies: Study[];
  outputs: ExpectedOutput[];
  beneficiaries: TargetBeneficiary[];
  milestones: Milestone[];
  endorsers: ProjectEndorser[];
  line_items: LineItem[];
};

const byId = <T extends { id: number }>(rows: T[]) => [...rows].sort((a, b) => a.id - b.id);

/** The wizard's fields for a registration. `keepIds` for editing a registered project; a workbook (client 2026-10-23)
 * drops them, so registering creates every row. */
export function registrationDraft(src: RegistrationPayload, keepIds: boolean) {
  const p = src.project;
  const id = (row: { id: number }) => (keepIds ? { id: row.id } : {});
  const sortedStudies = byId(src.studies);
  const objectives = p.objectives.split("\n").map((l) => l.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
  return {
    form: {
      title: p.title,
      funding_type: p.funding_type as string,
      lead: String(p.lead),
      lead_gender: p.lead_gender as string,
      contact_number: p.contact_number,
      ntp_number: p.ntp_number,
      ntp_date: p.ntp_date ?? "",
      toe_signed_date: p.toe_signed_date ?? "",
      is_dry_research: dryResearchChoice(p.is_dry_research) as string,
      start_date: p.start_date ?? "",
      target_end_date: p.target_end_date ?? "",
      rde_thrust: p.rde_thrust,
      rde_priority: p.rde_priority,
      sdgs: p.sdgs.map(String),
      sectors: p.sectors as string[],
      sector_other: p.sector_other,
      is_continuing: String(p.is_continuing),
      continuing_year: p.continuing_year ? String(p.continuing_year) : "",
      research_type: p.research_type as string,
      research_priority_area: p.research_priority_area as string,
      research_typology: p.research_typology as string[],
      campus: p.campus,
      implementing_unit: p.implementing_unit || p.college,
      total_cost: p.total_cost ?? "",
      background: p.background,
      methodology: p.methodology,
      socio_economic_significance: p.socio_economic_significance,
      monitoring_evaluation: p.monitoring_evaluation,
      references: p.references,
      description: p.description,
      expected_outcomes: p.expected_outcomes,
      expected_impacts: p.expected_impacts,
      proposal_submitted_on: p.proposal_submitted_on ?? "",
      proposal_reviewed_on: p.proposal_reviewed_on ?? "",
      proposal_approved_on: p.proposal_approved_on ?? "",
      reviewing_body: p.reviewing_body,
    },
    agencies: p.cooperating_agencies ? p.cooperating_agencies.split(", ").filter(Boolean) : [],
    objectives: objectives.length ? objectives : [""],
    studyTitles: sortedStudies.length ? sortedStudies.map((st) => st.title) : [""],
    team: byId(src.team).map((t) => ({ ...id(t), member_role: t.member_role as string, name: t.name, gender: t.gender as string, user: t.user })),
    beneficiaryRows: src.beneficiaries.length
      ? byId(src.beneficiaries).map((b) => ({ ...id(b), group: b.group, description: b.description, total: String(b.total) }))
      : [{ group: "", description: "", total: "" }],
    outputRows: byId(src.outputs).map((o) => ({ ...id(o), category: o.category, description: o.description, target_count: String(o.target_count) })),
    workPlanRows: byId(src.milestones).map((m) => ({ ...id(m), title: m.title, start_date: m.start_date ?? "", target_date: m.target_date, tasks: m.tasks_total })),
    // Older LIB rows have only an amount; shown as 1 x amount so the locked step still adds up
    libRows: src.line_items.map((r) => ({
      category: r.category as string,
      description: r.description,
      specification: r.specification ?? "",
      unit: r.unit,
      quantity: r.quantity ?? "1",
      unit_cost: r.unit_cost ?? r.amount,
      allocations: Object.fromEntries((r.allocations ?? []).map((a) => [a.period, a.amount])),
    })),
    libYear: String(src.line_items.find((r) => r.fiscal_year)?.fiscal_year ?? new Date().getFullYear()),
    endorsers: byId(src.endorsers).map((e) => ({ ...id(e), role_code: e.role_code, user: e.user, name: e.name, designation: e.designation, signed_on: e.signed_on ?? "" })),
  };
}
