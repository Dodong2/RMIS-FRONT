import { useEffect, useState, type ReactNode } from "react";
import { ProtoModal } from "../common/proto";
import { BORDER, BUDGET_GROUPS, HEAD, SIX_P_LABELS } from "./proposalForm";
import { researchApi } from "../../lib/researchApi";
import { outputsApi } from "../../lib/outputsApi";
import { budgetApi } from "../../lib/budgetApi";
import { documentApi } from "../../lib/documentApi";
import { errorMessage } from "../../lib/errorMessage";
import { libUnitLabel } from "../../lib/libUnits";
import { notify } from "../../lib/notify";
import { PRIORITY_AREA_LABELS, RESEARCH_TYPE_LABELS, SDG_LABELS, SECTOR_LABELS, TYPOLOGY_LABELS } from "../../lib/projectOptions";
import type { AdminChoice, Gender, PriorityArea, Project, ResearchType, Sector, Typology } from "../../types/research";
import type { LineItem } from "../../types/budget";
import type { SixPCategory } from "../../types/outputs";

const CAMPUSES = ["San Pablo City", "Siniloan", "Los Baños", "Sta. Cruz"];
const ed = "w-full px-1.5 py-0.5 rounded border text-xs outline-none focus:border-[#0891b2]";
const edSt = { borderColor: "#cbd5e1", background: "#fffbeb", color: "#1e293b", fontFamily: "Arial, sans-serif" };
const lockedSt = { ...edSt, background: "#f1f5f9", color: "#64748b" };

type TeamRow = { id?: number; member_role: "co_leader" | "member"; name: string; gender: Gender | "" };
type StudyRow = { id?: number; title: string };
type OutputRow = { id?: number; category: SixPCategory; description: string; target_count: string };
type BeneficiaryRow = { id?: number; group: string; description: string; total: string };
type WorkRow = { id?: number; title: string; start_date: string; target_date: string; tasks: number };
type EndorserRow = { id?: number; name: string; designation: string; signed_on: string };

const fromProject = (p: Project) => ({
  title: p.title,
  project_code: p.project_code,
  lead_gender: p.lead_gender,
  contact_number: p.contact_number,
  start_date: p.start_date ?? "",
  target_end_date: p.target_end_date ?? "",
  implementing_unit: p.implementing_unit,
  campus: p.campus,
  cooperating_agencies: p.cooperating_agencies ? p.cooperating_agencies.split(", ").filter(Boolean) : [],
  sectors: p.sectors,
  sector_other: p.sector_other,
  is_continuing: p.is_continuing,
  continuing_year: p.continuing_year ? String(p.continuing_year) : "",
  research_type: p.research_type,
  is_dry_research: p.is_dry_research,
  research_priority_area: p.research_priority_area,
  research_typology: p.research_typology,
  sdgs: p.sdgs,
  background: p.background,
  objectives: p.objectives.split("\n").map((l) => l.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean),
  methodology: p.methodology,
  socio_economic_significance: p.socio_economic_significance,
  monitoring_evaluation: p.monitoring_evaluation,
  references: p.references,
  proposal_submitted_on: p.proposal_submitted_on ?? "",
});

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const peso = (n: number) => (n ? n.toLocaleString("en-PH", { maximumFractionDigits: 2 }) : "-");

function Box({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="mr-4 whitespace-nowrap inline-flex items-center gap-1 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[#0d2a5e]" />
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ border: BORDER, borderTop: "none" }}>
      <div className="px-2 py-0.5 font-bold text-xs uppercase" style={{ ...HEAD, borderBottom: BORDER }}>{title}</div>
      <div className="px-2 py-1.5 text-xs leading-relaxed space-y-1">{children}</div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-52 shrink-0 font-bold">{label}:</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Area({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea className={ed} style={edSt} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Remove({ onClick, disabled, title }: { onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title ?? "Remove"} className="text-xs font-bold px-1 disabled:opacity-30" style={{ color: "#dc2626" }}>
      ✕
    </button>
  );
}

function Add({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-semibold mt-1" style={{ color: "#0891b2" }}>
      + {children}
    </button>
  );
}

/**
 * Edit Registered Project (client request 2026-10-09): the Research Proposal Form Preview of the registration wizard,
 * with every field editable except Section X (the LIB, changed only through Realignment) and the approved Total
 * Project/Study Cost. Save Changes patches the project, adds/updates/removes the form rows, then saves a new version
 * of the Research Proposal Form document.
 */
export function ProposalEditor({ project, canEditCode, onClose, onSaved }: { project: Project; canEditCode: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(() => fromProject(project));
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>([]);
  const [workPlan, setWorkPlan] = useState<WorkRow[]>([]);
  const [endorsers, setEndorsers] = useState<EndorserRow[]>([]);
  const [original, setOriginal] = useState<Record<string, number[]>>({});
  const [lib, setLib] = useState<LineItem[]>([]);
  const [units, setUnits] = useState<AdminChoice[]>([]);
  const [agencyChoices, setAgencyChoices] = useState<AdminChoice[]>([]);
  const [endorserChoices, setEndorserChoices] = useState<AdminChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ReturnType<typeof fromProject>>(k: K, v: ReturnType<typeof fromProject>[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let active = true;
    const id = project.id;
    Promise.all([
      researchApi.getTeamMembers(id),
      researchApi.getStudies(id),
      outputsApi.getExpectedOutputs({ project: id }),
      researchApi.getBeneficiaries(id),
      researchApi.getMilestones(id),
      researchApi.getEndorsers(id),
      budgetApi.getBudgets(id),
    ])
      .then(([t, s, o, b, m, e, budgets]) => {
        if (!active) return;
        setTeam(t.map((r) => ({ id: r.id, member_role: r.member_role === "co_leader" ? "co_leader" : "member", name: r.name, gender: r.gender })));
        setStudies(s.map((r) => ({ id: r.id, title: r.title })));
        setOutputs(o.map((r) => ({ id: r.id, category: r.category, description: r.description, target_count: String(r.target_count) })));
        setBeneficiaries(b.map((r) => ({ id: r.id, group: r.group, description: r.description, total: String(r.total) })));
        setWorkPlan(m.map((r) => ({ id: r.id, title: r.title, start_date: r.start_date ?? "", target_date: r.target_date, tasks: r.tasks_total })));
        setEndorsers(e.map((r) => ({ id: r.id, name: r.name, designation: r.designation, signed_on: r.signed_on ?? "" })));
        setOriginal({ team: t.map((r) => r.id), outputs: o.map((r) => r.id), beneficiaries: b.map((r) => r.id), workPlan: m.map((r) => r.id), endorsers: e.map((r) => r.id) });
        setLib(budgets.find((x) => x.is_current)?.line_items ?? []);
      })
      .catch(() => active && notify.error("Could not load the registration form. Close it and try again."))
      .finally(() => active && setLoading(false));
    researchApi.getChoices("college-units").then((l) => active && setUnits(l)).catch(() => undefined);
    researchApi.getChoices("cooperating-agencies").then((l) => active && setAgencyChoices(l)).catch(() => undefined);
    researchApi.getChoices("endorsers").then((l) => active && setEndorserChoices(l)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  const update = <T,>(setter: (fn: (rows: T[]) => T[]) => void) => (i: number, patch: Partial<T>) => setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updTeam = update<TeamRow>(setTeam);
  const updOutput = update<OutputRow>(setOutputs);
  const updBen = update<BeneficiaryRow>(setBeneficiaries);
  const updWork = update<WorkRow>(setWorkPlan);
  const updEnd = update<EndorserRow>(setEndorsers);

  const save = async () => {
    if (!f.title.trim() || !f.project_code.trim()) {
      notify.error("The title and the project code are required.");
      return;
    }
    if (f.sectors.length === 0 || (f.sectors.includes("others") && !f.sector_other.trim())) {
      notify.error("Select at least one sector, and describe it when Others is ticked.");
      return;
    }
    if (f.sdgs.length === 0) {
      notify.error("Select at least one Sustainable Development Goal.");
      return;
    }
    if (f.is_continuing && Number(f.continuing_year) < 2) {
      notify.error("A continuing proposal needs its year (2 or later).");
      return;
    }
    const keptWork = workPlan.filter((w) => w.title.trim());
    if (keptWork.some((w) => !w.target_date)) {
      notify.error("Every work plan activity needs an end date.");
      return;
    }
    setSaving(true);
    try {
      const id = project.id;
      await researchApi.updateProject(id, {
        title: f.title.trim(),
        ...(canEditCode ? { project_code: f.project_code.trim() } : {}),
        lead_gender: f.lead_gender,
        contact_number: f.contact_number,
        start_date: f.start_date || null,
        target_end_date: f.target_end_date || null,
        implementing_unit: f.implementing_unit,
        college: f.implementing_unit,
        campus: f.campus,
        cooperating_agencies: f.cooperating_agencies.join(", "),
        sectors: f.sectors,
        sector_other: f.sectors.includes("others") ? f.sector_other.trim() : "",
        is_continuing: f.is_continuing,
        continuing_year: f.is_continuing ? Number(f.continuing_year) : null,
        research_type: f.research_type,
        is_dry_research: f.is_dry_research,
        research_priority_area: f.research_priority_area,
        research_typology: f.research_typology,
        sdgs: f.sdgs,
        background: f.background,
        objectives: f.objectives.filter((o) => o.trim()).map((o, i) => `${i + 1}. ${o.trim()}`).join("\n"),
        methodology: f.methodology,
        socio_economic_significance: f.socio_economic_significance,
        monitoring_evaluation: f.monitoring_evaluation,
        references: f.references,
        proposal_submitted_on: f.proposal_submitted_on || null,
      });

      const removed = (key: string, rows: { id?: number }[]) => (original[key] ?? []).filter((oid) => !rows.some((r) => r.id === oid));
      const keptTeam = team.filter((t) => t.name.trim());
      const keptOutputs = outputs.filter((o) => o.description.trim());
      const keptBen = beneficiaries.filter((b) => b.group.trim());
      const keptEnd = endorsers.filter((e) => e.name.trim());
      const results = await Promise.allSettled([
        ...removed("team", keptTeam).map((x) => researchApi.deleteTeamMember(x)),
        ...keptTeam.map((t) =>
          t.id
            ? researchApi.updateTeamMember(t.id, { member_role: t.member_role, name: t.name.trim(), gender: t.gender })
            : researchApi.createTeamMember({ project: id, member_role: t.member_role, name: t.name.trim(), gender: t.gender }),
        ),
        ...studies.filter((s) => s.title.trim()).map((s) => (s.id ? researchApi.updateStudy(s.id, { title: s.title.trim() }) : researchApi.createStudy({ project: id, title: s.title.trim() }))),
        ...removed("outputs", keptOutputs).map((x) => outputsApi.deleteExpectedOutput(x)),
        ...keptOutputs.map((o) =>
          o.id
            ? outputsApi.updateExpectedOutput(o.id, { category: o.category, description: o.description.trim(), target_count: Number(o.target_count) || 1 })
            : outputsApi.createExpectedOutput({ project: id, category: o.category, description: o.description.trim(), target_count: Number(o.target_count) || 1 }),
        ),
        ...removed("beneficiaries", keptBen).map((x) => researchApi.deleteBeneficiary(x)),
        ...keptBen.map((b) =>
          b.id
            ? researchApi.updateBeneficiary(b.id, { group: b.group.trim(), description: b.description.trim(), total: Number(b.total) || 0 })
            : researchApi.createBeneficiary({ project: id, group: b.group.trim(), description: b.description.trim(), total: Number(b.total) || 0 }),
        ),
        ...removed("workPlan", keptWork).map((x) => researchApi.deleteMilestone(x)),
        ...keptWork.map((w) =>
          w.id
            ? researchApi.updateMilestone(w.id, { title: w.title.trim(), start_date: w.start_date || null, target_date: w.target_date })
            : researchApi.createMilestone({ project: id, title: w.title.trim(), start_date: w.start_date || undefined, target_date: w.target_date }),
        ),
        ...removed("endorsers", keptEnd).map((x) => researchApi.deleteEndorser(x)),
        // Annex A keeps its order (listed by id), so new endorsers are added one after another
        keptEnd.reduce(
          (chain, e) =>
            chain.then(() =>
              e.id
                ? researchApi.updateEndorser(e.id, { name: e.name, designation: e.designation.trim(), signed_on: e.signed_on || null })
                : researchApi.createEndorser({ project: id, role_code: "", user: null, name: e.name, designation: e.designation.trim(), signed_on: e.signed_on || null }),
            ),
          Promise.resolve() as Promise<unknown>,
        ),
      ]);
      const failed = results.filter((r) => r.status === "rejected");
      const formSaved = await documentApi.saveProposalForm(id).then(() => true, () => false);
      if (failed.length) notify.error(`Project saved, but ${failed.length} row(s) could not be saved: ${errorMessage((failed[0] as PromiseRejectedResult).reason, "")}`);
      else notify.success("Changes saved. A new version of the Research Proposal Form is under Document Management.");
      if (!formSaved) notify.error("The Research Proposal Form could not be saved to Document Management.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not save the changes."));
    } finally {
      setSaving(false);
    }
  };

  const libTotal = lib.reduce((s, r) => s + Number(r.amount), 0);
  const unitOptions = units.some((u) => u.name === f.implementing_unit) || !f.implementing_unit ? units.map((u) => u.name) : [f.implementing_unit, ...units.map((u) => u.name)];
  const agencyOptions = [...new Set([...agencyChoices.map((a) => a.name), ...f.cooperating_agencies])];

  return (
    <ProtoModal
      title="Edit Research Proposal Form"
      subtitle={`${project.project_code} · LSPU-RDO-SF-018 · the Line-Item Budget (Section X) and the approved Total Project/Study Cost can't be changed here`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving || loading} className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm p-6" style={{ color: "#94a3b8" }}>Loading the form…</p>
      ) : (
        <div className="mx-auto max-w-4xl p-6 shadow-sm" style={{ background: "white", border: "1px solid #e2e8f0", color: "#1e293b", fontFamily: "'Times New Roman', Georgia, serif" }}>
          <div className="text-center mb-3">
            <p className="text-xs">Republic of the Philippines</p>
            <p className="text-sm font-bold">Laguna State Polytechnic University</p>
            <p className="text-xs">Province of Laguna</p>
            <p className="text-sm font-bold mt-2" style={{ fontFamily: "Arial, sans-serif" }}>RESEARCH PROPOSAL FORM (LSPU-FUNDED RESEARCH)</p>
          </div>

          <div style={{ borderTop: BORDER }}>
            <Section title="I. Project/Study Details">
              <Line label="TITLE">
                <input className={ed} style={edSt} value={f.title} onChange={(e) => set("title", e.target.value)} />
              </Line>
              <Line label="PROJECT CODE">
                <input className={ed} style={canEditCode ? edSt : lockedSt} readOnly={!canEditCode} value={f.project_code} onChange={(e) => set("project_code", e.target.value)} title={canEditCode ? "" : "Only the CRC Chair, DRD, RIUH or System Admin can change the code"} />
              </Line>
              <Line label="PROJECT LEADER/GENDER">
                <div className="flex gap-2">
                  <input className={ed} style={lockedSt} readOnly value={project.lead_detail?.full_name || project.lead_detail?.email || ""} />
                  <select className={ed + " w-28"} style={edSt} value={f.lead_gender} onChange={(e) => set("lead_gender", e.target.value as Gender | "")}>
                    <option value="">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </Line>
              <div>
                <p className="font-bold">CO-PROJECT LEADER / PROJECT TEAM/GENDER:</p>
                {team.map((t, i) => (
                  <div key={i} className="flex gap-2 mt-1 items-center">
                    <select className={ed + " w-44"} style={edSt} value={t.member_role} onChange={(e) => updTeam(i, { member_role: e.target.value as TeamRow["member_role"] })}>
                      <option value="co_leader">Co-Project Leader</option>
                      <option value="member">Team Member</option>
                    </select>
                    <input className={ed} style={edSt} value={t.name} onChange={(e) => updTeam(i, { name: e.target.value })} placeholder="Name" />
                    <select className={ed + " w-28"} style={edSt} value={t.gender} onChange={(e) => updTeam(i, { gender: e.target.value as Gender | "" })}>
                      <option value="">Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <Remove onClick={() => setTeam(team.filter((_, idx) => idx !== i))} />
                  </div>
                ))}
                <Add onClick={() => setTeam([...team, { member_role: "member", name: "", gender: "" }])}>Add team member</Add>
              </div>
              <Line label="START DATE">
                <input type="date" className={ed} style={edSt} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </Line>
              <Line label="END DATE">
                <input type="date" className={ed} style={edSt} value={f.target_end_date} onChange={(e) => set("target_end_date", e.target.value)} />
              </Line>
              <Line label="TOTAL PROJECT/STUDY COST">
                <input className={ed} style={lockedSt} readOnly value={project.total_cost ? `PhP ${Number(project.total_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"} title="Approved budget; changes go through Realignment" />
              </Line>
              <Line label="IMPLEMENTING UNIT">
                <select className={ed} style={edSt} value={f.implementing_unit} onChange={(e) => set("implementing_unit", e.target.value)}>
                  <option value="">Select a unit</option>
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Line>
              <Line label="CAMPUS">
                <select className={ed} style={edSt} value={f.campus} onChange={(e) => set("campus", e.target.value)}>
                  <option value="">Select a campus</option>
                  {[...new Set([...CAMPUSES, ...(f.campus ? [f.campus] : [])])].map((c) => (
                    <option key={c} value={c}>{c} Campus</option>
                  ))}
                </select>
              </Line>
              <Line label="CONTACT NO/S.">
                <input className={ed} style={edSt} value={f.contact_number} onChange={(e) => set("contact_number", e.target.value)} />
              </Line>
              <Line label="E-MAIL ADDRESS">
                <input className={ed} style={lockedSt} readOnly value={project.lead_detail?.email ?? ""} />
              </Line>
              <Line label="COOPERATING AGENCY/IES">
                <div>
                  {agencyOptions.map((a) => (
                    <Box key={a} checked={f.cooperating_agencies.includes(a)} onChange={() => set("cooperating_agencies", toggle(f.cooperating_agencies, a))}>{a}</Box>
                  ))}
                  {agencyOptions.length === 0 && <span style={{ color: "#94a3b8" }}>No agencies yet, ask the System Admin to add them</span>}
                </div>
              </Line>
            </Section>
            <Section title="Sector">
              <div>
                {(Object.entries(SECTOR_LABELS) as [Sector, string][]).map(([k, label]) => (
                  <Box key={k} checked={f.sectors.includes(k)} onChange={() => set("sectors", toggle(f.sectors, k))}>{label}</Box>
                ))}
              </div>
              {f.sectors.includes("others") && <input className={ed} style={edSt} value={f.sector_other} onChange={(e) => set("sector_other", e.target.value)} placeholder="Others, please specify" />}
            </Section>
            <Section title="Research Proposal Classification">
              <div className="flex flex-wrap items-center">
                <Box checked={!f.is_continuing} onChange={() => set("is_continuing", false)}>New Proposal</Box>
                <Box checked={f.is_continuing} onChange={() => set("is_continuing", true)}>Continuing</Box>
                {f.is_continuing && (
                  <span className="inline-flex items-center gap-1">
                    Year <input type="number" min="2" className={ed + " w-16"} style={edSt} value={f.continuing_year} onChange={(e) => set("continuing_year", e.target.value)} />
                  </span>
                )}
              </div>
              <div>
                {(Object.entries(RESEARCH_TYPE_LABELS) as [ResearchType, string][]).map(([k, label]) => (
                  <Box key={k} checked={f.research_type === k} onChange={() => set("research_type", f.research_type === k ? "" : k)}>{label}</Box>
                ))}
              </div>
              <div>
                <Box checked={!f.is_dry_research} onChange={() => set("is_dry_research", false)}>Wet Research (i.e., with laboratory)</Box>
                <Box checked={f.is_dry_research} onChange={() => set("is_dry_research", true)}>Dry Research</Box>
              </div>
            </Section>
            <Section title="Study Component Titles">
              {studies.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <b className="shrink-0">Study {i + 1}:</b>
                  <input className={ed} style={edSt} value={s.title} onChange={(e) => setStudies(studies.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))} />
                  {!s.id && <Remove onClick={() => setStudies(studies.filter((_, idx) => idx !== i))} />}
                </div>
              ))}
              <Add onClick={() => setStudies([...studies, { title: "" }])}>Add study</Add>
            </Section>
            <Section title="Research Priority Area">
              <div className="grid grid-cols-2">
                {(Object.entries(PRIORITY_AREA_LABELS) as [PriorityArea, string][]).map(([k, label]) => (
                  <Box key={k} checked={f.research_priority_area === k} onChange={() => set("research_priority_area", f.research_priority_area === k ? "" : k)}>{label}</Box>
                ))}
              </div>
            </Section>
            <Section title="Research Typology">
              <div className="grid grid-cols-2">
                {(Object.entries(TYPOLOGY_LABELS) as [Typology, string][]).map(([k, label]) => (
                  <Box key={k} checked={f.research_typology.includes(k)} onChange={() => set("research_typology", toggle(f.research_typology, k))}>{label}</Box>
                ))}
              </div>
            </Section>
            <Section title="Sustainable Development Goals (SDGs)">
              <div className="grid grid-cols-2">
                {Object.entries(SDG_LABELS).map(([n, label]) => (
                  <Box key={n} checked={f.sdgs.includes(Number(n))} onChange={() => set("sdgs", toggle(f.sdgs, Number(n)).sort((a, b) => a - b))}>{`SDG ${n} — ${label}`}</Box>
                ))}
              </div>
            </Section>
            <Section title="II. Background of the Study">
              <Area value={f.background} onChange={(v) => set("background", v)} rows={6} />
            </Section>
            <Section title="III. Objectives of the Study">
              {f.objectives.map((o, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="w-5 shrink-0">{i + 1}.</span>
                  <input className={ed} style={edSt} value={o} onChange={(e) => set("objectives", f.objectives.map((x, idx) => (idx === i ? e.target.value : x)))} />
                  <Remove onClick={() => set("objectives", f.objectives.filter((_, idx) => idx !== i))} />
                </div>
              ))}
              <Add onClick={() => set("objectives", [...f.objectives, ""])}>Add objective</Add>
            </Section>
            <Section title="IV. Project Descriptions/Methodology">
              <Area value={f.methodology} onChange={(v) => set("methodology", v)} rows={6} />
            </Section>
            <Section title="V. Quantifiable Expected Outputs: 6Ps">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["ITEM", "PARTICULARS", "QUANTITY", ""].map((h) => (
                      <th key={h} className="px-1 text-left" style={{ border: BORDER }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outputs.map((o, i) => (
                    <tr key={i}>
                      <td className="px-1 align-top w-40" style={{ border: BORDER }}>
                        <select className={ed} style={edSt} value={o.category} onChange={(e) => updOutput(i, { category: e.target.value as SixPCategory })}>
                          {Object.entries(SIX_P_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1" style={{ border: BORDER }}>
                        <textarea className={ed} style={edSt} rows={2} value={o.description} onChange={(e) => updOutput(i, { description: e.target.value })} />
                      </td>
                      <td className="px-1 w-20" style={{ border: BORDER }}>
                        <input type="number" min="1" className={ed} style={edSt} value={o.target_count} onChange={(e) => updOutput(i, { target_count: e.target.value })} />
                      </td>
                      <td className="w-6 text-center" style={{ border: BORDER }}>
                        <Remove onClick={() => setOutputs(outputs.filter((_, idx) => idx !== i))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Add onClick={() => setOutputs([...outputs, { category: "publications", description: "", target_count: "1" }])}>Add output</Add>
            </Section>
            <Section title="VI. Socio-Economic Significance">
              <Area value={f.socio_economic_significance} onChange={(v) => set("socio_economic_significance", v)} />
            </Section>
            <Section title="VII. Target Beneficiaries">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th className="px-1 text-left" style={{ border: BORDER }}>Target Beneficiaries</th>
                    <th className="px-1 text-left" style={{ border: BORDER }}>Description</th>
                    <th className="px-1 w-20" style={{ border: BORDER }}>Total</th>
                    <th className="w-6" style={{ border: BORDER }} />
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.map((b, i) => (
                    <tr key={i}>
                      <td className="px-1" style={{ border: BORDER }}>
                        <input className={ed} style={edSt} value={b.group} onChange={(e) => updBen(i, { group: e.target.value })} />
                      </td>
                      <td className="px-1" style={{ border: BORDER }}>
                        <input className={ed} style={edSt} value={b.description} onChange={(e) => updBen(i, { description: e.target.value })} />
                      </td>
                      <td className="px-1" style={{ border: BORDER }}>
                        <input type="number" min="0" className={ed} style={edSt} value={b.total} onChange={(e) => updBen(i, { total: e.target.value })} />
                      </td>
                      <td className="text-center" style={{ border: BORDER }}>
                        <Remove onClick={() => setBeneficiaries(beneficiaries.filter((_, idx) => idx !== i))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Add onClick={() => setBeneficiaries([...beneficiaries, { group: "", description: "", total: "" }])}>Add beneficiary</Add>
            </Section>
            <Section title="VIII. Monitoring/Evaluation">
              <Area value={f.monitoring_evaluation} onChange={(v) => set("monitoring_evaluation", v)} />
            </Section>
            <Section title="IX. List of References">
              <Area value={f.references} onChange={(v) => set("references", v)} />
            </Section>
            <Section title="X. Budget Requirements (locked)">
              {lib.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No LIB entered.</p>
              ) : (
                <table className="w-full" style={{ borderCollapse: "collapse", fontFamily: "Arial, sans-serif", color: "#475569" }}>
                  <thead>
                    <tr style={HEAD}>
                      {["DESCRIPTION", "UNIT", "QTY", "UNIT COST", "TOTAL"].map((h) => (
                        <th key={h} className="px-1" style={{ border: BORDER }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BUDGET_GROUPS.map((g) => {
                      const rows = lib.filter((r) => r.category === g.key);
                      if (!rows.length) return null;
                      return [
                        <tr key={g.key} style={HEAD}>
                          <td colSpan={5} className="px-1 font-bold" style={{ border: BORDER }}>{g.label}</td>
                        </tr>,
                        ...rows.map((r) => (
                          <tr key={r.id}>
                            <td className="px-1 pl-4" style={{ border: BORDER }}>{r.description}</td>
                            <td className="px-1 text-center" style={{ border: BORDER }}>{libUnitLabel(r.unit)}</td>
                            <td className="px-1 text-right" style={{ border: BORDER }}>{r.quantity != null ? Number(r.quantity) : ""}</td>
                            <td className="px-1 text-right" style={{ border: BORDER }}>{r.unit_cost != null ? peso(Number(r.unit_cost)) : ""}</td>
                            <td className="px-1 text-right font-bold" style={{ border: BORDER }}>{peso(Number(r.amount))}</td>
                          </tr>
                        )),
                      ];
                    })}
                    <tr style={{ background: "#fecaca" }}>
                      <td colSpan={4} className="px-1 text-right font-bold" style={{ border: BORDER }}>GRAND TOTAL</td>
                      <td className="px-1 text-right font-bold" style={{ border: BORDER }}>{peso(libTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <p style={{ color: "#94a3b8" }}>The LIB is changed through a Realignment under Budget Management, not here.</p>
            </Section>
            <Section title="XI. Work Plan">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th className="px-1 text-left" style={{ border: BORDER }}>Activity</th>
                    <th className="px-1 w-32" style={{ border: BORDER }}>Start</th>
                    <th className="px-1 w-32" style={{ border: BORDER }}>End</th>
                    <th className="w-6" style={{ border: BORDER }} />
                  </tr>
                </thead>
                <tbody>
                  {workPlan.map((w, i) => (
                    <tr key={i}>
                      <td className="px-1" style={{ border: BORDER }}>
                        <input className={ed} style={edSt} value={w.title} onChange={(e) => updWork(i, { title: e.target.value })} />
                      </td>
                      <td className="px-1" style={{ border: BORDER }}>
                        <input type="date" className={ed} style={edSt} value={w.start_date} onChange={(e) => updWork(i, { start_date: e.target.value })} />
                      </td>
                      <td className="px-1" style={{ border: BORDER }}>
                        <input type="date" className={ed} style={edSt} value={w.target_date} onChange={(e) => updWork(i, { target_date: e.target.value })} />
                      </td>
                      <td className="text-center" style={{ border: BORDER }}>
                        <Remove
                          disabled={w.tasks > 0}
                          title={w.tasks > 0 ? `Has ${w.tasks} task(s); move or delete them on the Tasks page first` : "Remove"}
                          onClick={() => setWorkPlan(workPlan.filter((_, idx) => idx !== i))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Add onClick={() => setWorkPlan([...workPlan, { title: "", start_date: "", target_date: "", tasks: 0 }])}>Add activity</Add>
            </Section>
          </div>

          <div className="mt-8">
            <p className="text-center text-sm">Annex A</p>
            <p className="text-center text-sm font-bold mb-2">ENDORSEMENT PAGE</p>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr style={HEAD}>
                  <td colSpan={2} className="px-2 font-bold" style={{ border: BORDER }}>SUBMITTED BY:</td>
                </tr>
                <tr>
                  <td className="px-2 w-36" style={{ border: BORDER }}>Name</td>
                  <td className="px-2 font-bold" style={{ border: BORDER }}>
                    {(project.lead_detail?.full_name || "—").toUpperCase()} <span className="font-normal">· Project Leader · Date submitted</span>{" "}
                    <input type="date" className={ed + " inline-block w-40"} style={edSt} value={f.proposal_submitted_on} onChange={(e) => set("proposal_submitted_on", e.target.value)} />
                  </td>
                </tr>
                <tr style={HEAD}>
                  <td colSpan={2} className="px-2 font-bold" style={{ border: BORDER }}>ENDORSED, NOTED, RECOMMENDED AND APPROVED BY (in order):</td>
                </tr>
                {endorsers.map((e, i) => {
                  const listed = endorserChoices.some((c) => c.name === e.name);
                  return (
                    <tr key={i}>
                      <td colSpan={2} className="px-2 py-1" style={{ border: BORDER }}>
                        <div className="flex gap-2 items-center">
                          <select
                            className={ed}
                            style={edSt}
                            value={e.name}
                            onChange={(ev) => updEnd(i, { name: ev.target.value, designation: endorserChoices.find((c) => c.name === ev.target.value)?.designation ?? e.designation })}
                          >
                            <option value="">Select the endorser...</option>
                            {e.name && !listed && <option value={e.name}>{e.name}</option>}
                            {endorserChoices.map((c) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          <input className={ed} style={edSt} value={e.designation} onChange={(ev) => updEnd(i, { designation: ev.target.value })} placeholder="Designation" />
                          <input type="date" className={ed + " w-40"} style={edSt} value={e.signed_on} onChange={(ev) => updEnd(i, { signed_on: ev.target.value })} aria-label="Date signed" />
                          <Remove onClick={() => setEndorsers(endorsers.filter((_, idx) => idx !== i))} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Add onClick={() => setEndorsers([...endorsers, { name: "", designation: "", signed_on: "" }])}>Add endorser</Add>
          </div>
        </div>
      )}
    </ProtoModal>
  );
}
