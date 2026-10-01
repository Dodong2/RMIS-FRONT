import type { ReactNode } from "react";
import { ProtoModal } from "../common/proto";
import { PRIORITY_AREA_LABELS, RESEARCH_TYPE_LABELS, SDG_LABELS, SECTOR_LABELS, TYPOLOGY_LABELS } from "../../lib/projectOptions";

export type ProposalPerson = { name: string; gender?: string };

export type ProposalData = {
  title: string;
  lead_name: string;
  lead_email?: string;
  lead_gender: string;
  co_leaders: ProposalPerson[];
  team: ProposalPerson[];
  start_date: string;
  target_end_date: string;
  total_cost: string;
  implementing_unit: string;
  campus: string;
  college: string;
  contact_number: string;
  cooperating_agencies: string;
  sectors: string[];
  sector_other: string;
  is_continuing: boolean;
  continuing_year: string;
  research_type: string;
  is_dry_research: boolean;
  study_titles: string[];
  research_priority_area: string;
  research_typology: string[];
  sdgs: number[];
  background: string;
  objectives: string[];
  methodology: string;
  outputs: { category: string; description: string; target_count: number | string }[];
  socio_economic_significance: string;
  beneficiaries: { group: string; description: string; total: number | string }[];
  monitoring_evaluation: string;
  references: string;
  budget: { category: string; description: string; q1: number; q2: number; q3: number; q4: number }[];
  work_plan: { title: string; start_date?: string | null; target_date?: string | null }[];
  endorsers: { name: string; designation: string; signed_on: string | null }[];
  proposal_submitted_on: string;
};

const HEAD = { background: "#e7dfc6", color: "#1e293b" };
const BORDER = "1px solid #94a3b8";
const SIX_P_LABELS: Record<string, string> = {
  publications: "Publications",
  patents: "Patent",
  products: "Products",
  people_services: "People Services",
  places_partnerships: "Places/Partnerships",
  policies: "Policy Recommendations",
};
const BUDGET_GROUPS = [
  { key: "ps", label: "PERSONAL SERVICES (PS)" },
  { key: "mooe", label: "MAINTENANCE AND OTHER OPERATING EXPENSES (MOOE)" },
  { key: "co", label: "EQUIPMENT OUTLAY (CO)" },
];

const peso = (n: number) => (n ? n.toLocaleString("en-PH", { maximumFractionDigits: 2 }) : "-");
const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "";
const withGender = (p: ProposalPerson) => [p.name, p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : ""].filter(Boolean).join(", ");

function Box({ checked, children }: { checked: boolean; children: ReactNode }) {
  return (
    <span className="mr-4 whitespace-nowrap">
      [<span className="inline-block w-3 text-center font-bold">{checked ? "/" : " "}</span>] {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ border: BORDER, borderTop: "none" }}>
      <div className="px-2 py-0.5 font-bold text-xs uppercase" style={{ ...HEAD, borderBottom: BORDER }}>{title}</div>
      <div className="px-2 py-1.5 text-xs leading-relaxed">{children}</div>
    </div>
  );
}

function Text({ value }: { value: string }) {
  return value.trim() ? <p className="whitespace-pre-line">{value}</p> : <p style={{ color: "#94a3b8" }}>Not provided</p>;
}

export function ProposalPreview({ data, onClose }: { data: ProposalData; onClose: () => void }) {
  const budgetTotal = data.budget.reduce((s, r) => s + r.q1 + r.q2 + r.q3 + r.q4, 0);

  return (
    <ProtoModal
      title="Research Proposal Form Preview"
      subtitle="LSPU-RDO-SF-018 · built from what was entered; check it against the signed form before registering"
      onClose={onClose}
      width="max-w-4xl"
    >
      <div className="mx-auto max-w-3xl p-6 shadow-sm" style={{ background: "white", border: "1px solid #e2e8f0", color: "#1e293b", fontFamily: "'Times New Roman', Georgia, serif" }}>
        <div className="text-center mb-3">
          <p className="text-xs">Republic of the Philippines</p>
          <p className="text-sm font-bold">Laguna State Polytechnic University</p>
          <p className="text-xs">Province of Laguna</p>
          <p className="text-sm font-bold mt-2" style={{ fontFamily: "Arial, sans-serif" }}>RESEARCH PROPOSAL FORM (LSPU-FUNDED RESEARCH)</p>
        </div>

        <div style={{ borderTop: BORDER }}>
          <Section title="I. Project/Study Details">
            <p><b>TITLE:</b> {data.title || "—"}</p>
          </Section>
          <div className="text-xs" style={{ border: BORDER, borderTop: "none" }}>
            <p className="px-2 py-0.5 font-bold" style={{ ...HEAD, borderBottom: BORDER }}>PROJECT LEADER/GENDER: {withGender({ name: data.lead_name, gender: data.lead_gender }) || "—"}</p>
            <p className="px-2 py-0.5 font-bold" style={{ ...HEAD, borderBottom: BORDER }}>CO-PROJECT LEADER/GENDER: {data.co_leaders.map(withGender).join("; ") || "—"}</p>
            <p className="px-2 py-0.5 font-bold" style={{ ...HEAD, borderBottom: BORDER }}>PROJECT TEAM/GENDER:</p>
            {data.team.length === 0 ? (
              <p className="px-2 py-0.5" style={{ color: "#94a3b8", borderBottom: BORDER }}>None listed</p>
            ) : (
              data.team.map((m, i) => (
                <div key={i} className="flex" style={{ borderBottom: BORDER }}>
                  <span className="w-36 px-2 py-0.5 italic font-bold shrink-0" style={{ borderRight: BORDER }}>Team Member {i + 1}</span>
                  <span className="px-2 py-0.5">{withGender(m)}</span>
                </div>
              ))
            )}
            <div className="px-2 py-1 space-y-0.5 font-bold">
              <p>DURATION: {[fmtDate(data.start_date), fmtDate(data.target_end_date)].filter(Boolean).join(" – ") || "—"}</p>
              <p>START DATE: {fmtDate(data.start_date) || "—"}</p>
              <p>END DATE: {fmtDate(data.target_end_date) || "—"}</p>
              <p>TOTAL PROJECT/STUDY COST: PhP {data.total_cost ? Number(data.total_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}</p>
              <p>IMPLEMENTING UNIT: {data.implementing_unit || "—"}</p>
              <p>CAMPUS: {data.campus ? `${data.campus} Campus` : "—"}</p>
              <p>CONTACT NO/S.: {data.contact_number || "—"}</p>
              <p>E-MAIL ADDRESS: {data.lead_email || "—"}</p>
              <p>COOPERATING AGENCY/IES: {data.cooperating_agencies || ""}</p>
            </div>
          </div>
          <Section title="Sector">
            {Object.entries(SECTOR_LABELS).map(([k, label]) => (
              <Box key={k} checked={data.sectors.includes(k)}>
                {label}
                {k === "others" && data.sector_other ? `: ${data.sector_other}` : ""}
              </Box>
            ))}
          </Section>
          <Section title="Research Proposal Classification">
            <p>
              <Box checked={!data.is_continuing}>New Proposal</Box>
              <Box checked={data.is_continuing}>Continuing{data.is_continuing && data.continuing_year ? ` (Year ${data.continuing_year})` : " (i.e., Year 2, Year 3, and so on…)"}</Box>
            </p>
            <p>
              <Box checked={false}>Program*</Box>
              <Box checked>Project**</Box>
              <Box checked={false}>Study</Box>
            </p>
            <p>
              {Object.entries(RESEARCH_TYPE_LABELS).map(([k, label]) => (
                <Box key={k} checked={data.research_type === k}>{label}</Box>
              ))}
            </p>
            <p>
              <Box checked={!data.is_dry_research}>Wet Research (i.e., with laboratory)</Box>
              <Box checked={data.is_dry_research}>Dry Research</Box>
            </p>
          </Section>
          <Section title="Study Component Titles">
            {(data.study_titles.length ? data.study_titles : ["", ""]).map((t, i) => (
              <p key={i}>
                <b>Study {i + 1}:</b> {t}
              </p>
            ))}
          </Section>
          <Section title="Research Priority Area">
            <div className="grid grid-cols-2">
              {Object.entries(PRIORITY_AREA_LABELS).map(([k, label]) => (
                <Box key={k} checked={data.research_priority_area === k}>{label}</Box>
              ))}
            </div>
          </Section>
          <Section title="Research Typology">
            <div className="grid grid-cols-2">
              {Object.entries(TYPOLOGY_LABELS).map(([k, label]) => (
                <Box key={k} checked={data.research_typology.includes(k)}>{label}</Box>
              ))}
            </div>
          </Section>
          <Section title="Sustainable Development Goals (SDGs)">
            {data.sdgs.length ? data.sdgs.map((n) => `SDG ${n} — ${SDG_LABELS[n]}`).join("; ") : <span style={{ color: "#94a3b8" }}>None selected</span>}
          </Section>
          <Section title="II. Background of the Study">
            <Text value={data.background} />
          </Section>
          <Section title="III. Objectives of the Study">
            {data.objectives.length ? (
              <ol className="list-decimal pl-6">
                {data.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            ) : (
              <Text value="" />
            )}
          </Section>
          <Section title="IV. Project Descriptions/Methodology">
            <Text value={data.methodology} />
          </Section>
          <Section title="V. Quantifiable Expected Outputs: 6Ps">
            {data.outputs.length ? (
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["ITEM", "PARTICULARS", "QUANTITY"].map((h) => (
                      <th key={h} className="px-1 text-left" style={{ border: BORDER }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.outputs.map((o, i) => (
                    <tr key={i}>
                      <td className="px-1 align-top" style={{ border: BORDER }}>{SIX_P_LABELS[o.category] ?? o.category}</td>
                      <td className="px-1" style={{ border: BORDER }}>{o.description}</td>
                      <td className="px-1 text-center" style={{ border: BORDER }}>{o.target_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: "#94a3b8" }}>Set under Research Outputs after registration, or through the Excel upload.</p>
            )}
          </Section>
          <Section title="VI. Socio-Economic Significance">
            <Text value={data.socio_economic_significance} />
          </Section>
          <Section title="VII. Target Beneficiaries">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="px-1 text-left" style={{ border: BORDER }}>Target Beneficiaries</th>
                  <th className="px-1 w-16" style={{ border: BORDER }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.beneficiaries.map((b, i) => (
                  <tr key={i}>
                    <td className="px-1" style={{ border: BORDER }}>
                      <b>{b.group}</b>
                      {b.description ? ` – ${b.description}` : ""}
                    </td>
                    <td className="px-1 text-center align-top" style={{ border: BORDER }}>{b.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="VIII. Monitoring/Evaluation">
            <Text value={data.monitoring_evaluation} />
          </Section>
          <Section title="IX. List of References">
            <Text value={data.references} />
          </Section>
          <Section title="X. Budget Requirements">
            {data.budget.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>No LIB entered.</p>
            ) : (
              <table className="w-full" style={{ borderCollapse: "collapse", fontFamily: "Arial, sans-serif" }}>
                <thead>
                  <tr style={HEAD}>
                    {["PARTICULARS", "QTR1", "QTR2", "QTR3", "QTR4", "TOTAL"].map((h) => (
                      <th key={h} className="px-1" style={{ border: BORDER }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BUDGET_GROUPS.map((g) => {
                    const rows = data.budget.filter((r) => r.category === g.key);
                    if (!rows.length) return null;
                    const subtotal = rows.reduce((s, r) => s + r.q1 + r.q2 + r.q3 + r.q4, 0);
                    return [
                      <tr key={g.key} style={HEAD}>
                        <td colSpan={6} className="px-1 font-bold" style={{ border: BORDER }}>{g.label}</td>
                      </tr>,
                      ...rows.map((r, i) => (
                        <tr key={`${g.key}${i}`}>
                          <td className="px-1 pl-4" style={{ border: BORDER }}>{r.description}</td>
                          {[r.q1, r.q2, r.q3, r.q4].map((q, qi) => (
                            <td key={qi} className="px-1 text-right" style={{ border: BORDER }}>{peso(q)}</td>
                          ))}
                          <td className="px-1 text-right font-bold" style={{ border: BORDER }}>{peso(r.q1 + r.q2 + r.q3 + r.q4)}</td>
                        </tr>
                      )),
                      <tr key={`${g.key}-sub`} style={{ background: "#e2e8f0" }}>
                        <td colSpan={5} className="px-1 text-right font-bold" style={{ border: BORDER }}>SUBTOTAL</td>
                        <td className="px-1 text-right font-bold" style={{ border: BORDER }}>{peso(subtotal)}</td>
                      </tr>,
                    ];
                  })}
                  <tr style={{ background: "#fecaca" }}>
                    <td colSpan={5} className="px-1 text-right font-bold" style={{ border: BORDER }}>GRAND TOTAL</td>
                    <td className="px-1 text-right font-bold" style={{ border: BORDER }}>{peso(budgetTotal)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Section>
          <Section title="XI. Work Plan">
            {data.work_plan.length ? (
              <ol className="list-decimal pl-6">
                {data.work_plan.map((w, i) => (
                  <li key={i}>
                    {w.title}
                    {w.start_date || w.target_date ? ` (${[fmtDate(w.start_date), fmtDate(w.target_date)].filter(Boolean).join(" – ")})` : ""}
                  </li>
                ))}
              </ol>
            ) : (
              <p style={{ color: "#94a3b8" }}>Set under Work Plan after registration, or through the Excel upload.</p>
            )}
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
                  {(data.lead_name || "—").toUpperCase()} <span className="font-normal">· Project Leader{data.proposal_submitted_on ? ` · ${fmtDate(data.proposal_submitted_on)}` : ""}</span>
                </td>
              </tr>
              {data.endorsers.length > 0 && (
                <tr style={HEAD}>
                  <td colSpan={2} className="px-2 font-bold" style={{ border: BORDER }}>ENDORSED, NOTED, RECOMMENDED AND APPROVED BY (in order):</td>
                </tr>
              )}
              {data.endorsers.map((e, i) => [
                <tr key={`n${i}`}>
                  <td className="px-2" style={{ border: BORDER }}>Name</td>
                  <td className="px-2 font-bold" style={{ border: BORDER }}>{e.name.toUpperCase()}</td>
                </tr>,
                <tr key={`d${i}`}>
                  <td className="px-2" style={{ border: BORDER }}>Designation</td>
                  <td className="px-2" style={{ border: BORDER }}>
                    {e.designation || "—"}
                    {e.signed_on ? ` · Date Signed: ${fmtDate(e.signed_on)}` : ""}
                  </td>
                </tr>,
              ])}
              {data.endorsers.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-2 py-1" style={{ border: BORDER, color: "#94a3b8" }}>No endorsers entered.</td>
                </tr>
              )}
            </tbody>
          </table>
          {data.college && <p className="text-xs mt-1">College Unit: {data.college}</p>}
        </div>
      </div>
    </ProtoModal>
  );
}
