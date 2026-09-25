import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { documentApi } from "../lib/documentApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import type { Program, FundingType } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { MultiSelect } from "../components/common/MultiSelect";
import {
  PRIORITY_AREA_LABELS,
  RESEARCH_TYPE_LABELS,
  SDG_OPTIONS,
  SECTOR_LABELS,
  TYPOLOGY_OPTIONS,
} from "../lib/projectOptions";

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const CAMPUSES = [
  { name: "San Pablo City", color: "#0d2a5e", bg: "#e0eaf7" },
  { name: "Siniloan", color: "#0891b2", bg: "#e0f2fe" },
  { name: "Los Baños", color: "#059669", bg: "#d1fae5" },
  { name: "Sta. Cruz", color: "#7c3aed", bg: "#f5f3ff" },
];

const WIZARD_STEPS = [
  { label: "Basic Info", icon: "📋" },
  { label: "Description", icon: "📝" },
  { label: "Objectives & Impact", icon: "🎯" },
  { label: "Beneficiaries & Classification", icon: "🌱" },
  { label: "Org. Scope & Proponent", icon: "🏛️" },
  { label: "Approval Info", icon: "🔖" },
  { label: "Validate & Register", icon: "✅" },
];

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[#0891b2]";
const inputSt = { borderColor: "#e2e8f0", background: "#f8fafc", color: "#334155" };

function Field({ label, required, invalid, children, span }: { label: string; required?: boolean; invalid?: boolean; children: ReactNode; span?: boolean }) {
  return (
    <div className={span ? "md:col-span-2" : undefined}>
      <label className="label-field">
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {children}
      {invalid && <p className="mt-1 text-xs font-semibold" style={{ color: "#dc2626" }}>Required</p>}
    </div>
  );
}

function StepNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl p-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="text-sm font-semibold mt-1 leading-snug" style={{ color: "#1e293b" }}>{value || "—"}</p>
    </div>
  );
}

function FilePick({ label, files, multiple, onChange }: { label: string; files: File[]; multiple?: boolean; onChange: (f: File[]) => void }) {
  return (
    <label
      className="rounded-xl p-6 border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors hover:border-[#0891b2]"
      style={{ borderColor: "#cbd5e1", background: "white" }}
    >
      <span className="text-2xl">📄</span>
      <p className="text-sm font-semibold text-center" style={{ color: "#475569" }}>
        {files.length ? files.map((f) => f.name).join(", ") : label}
      </p>
      <p className="text-xs" style={{ color: "#94a3b8" }}>PDF, Word, or image up to 25MB each · uploaded right after registration</p>
      <input
        type="file"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const tooBig = picked.find((f) => f.size > MAX_UPLOAD_BYTES);
          if (tooBig) {
            notify.error(`${tooBig.name} is over 25MB.`);
            return;
          }
          onChange(picked);
        }}
      />
    </label>
  );
}

function RegisterProjectContent() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [projectLeaders, setProjectLeaders] = useState<AdminUser[]>([]);
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [certified, setCertified] = useState(false);
  const [objectives, setObjectives] = useState([""]);
  const [approvalDoc, setApprovalDoc] = useState<File[]>([]);
  const [supportingDocs, setSupportingDocs] = useState<File[]>([]);

  const [form, setForm] = useState({
    title: "",
    project_code: "",
    funding_type: "",
    program: "",
    lead: "",
    ntp_number: "",
    ntp_date: "",
    toe_signed_date: "",
    is_dry_research: "true",
    start_date: "",
    target_end_date: "",
    rei_thrust: "",
    sdgs: [] as string[],
    sector: "",
    sector_other: "",
    is_continuing: "false",
    research_type: "",
    research_priority_area: "",
    research_typology: [] as string[],
    campus: "",
    implementing_unit: "",
    cooperating_agencies: "",
    total_cost: "",
    description: "",
    beneficiaries: "",
    expected_outcomes: "",
    expected_impacts: "",
    proposal_submitted_on: "",
    proposal_reviewed_on: "",
    proposal_approved_on: "",
    reviewing_body: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    let active = true;
    Promise.all([researchApi.getPrograms(), researchApi.getUsersByRole("project_leader")])
      .then(([programList, leaders]) => {
        if (!active) return;
        setPrograms(programList);
        setProjectLeaders(leaders);
      })
      .catch(() => active && notify.error("Could not load form data. Check your connection and refresh."));
    return () => {
      active = false;
    };
  }, []);

  const filledObjectives = objectives.map((o) => o.trim()).filter(Boolean);
  const checks: { label: string; done: boolean; required?: boolean; step: number }[] = [
    { label: "Project title entered", done: !!form.title.trim(), required: true, step: 0 },
    { label: "Project code (LSPU Faculty Research Number) entered", done: !!form.project_code.trim(), required: true, step: 0 },
    { label: "Funding type selected", done: !!form.funding_type, required: true, step: 0 },
    { label: "Start and target end dates provided", done: !!form.start_date && !!form.target_end_date, step: 0 },
    { label: "Project description written", done: !!form.description.trim(), step: 1 },
    { label: "At least 1 objective defined", done: filledObjectives.length > 0, step: 2 },
    { label: "Anticipated outcomes / impacts entered", done: !!form.expected_outcomes.trim() || !!form.expected_impacts.trim(), step: 2 },
    { label: "Target beneficiaries identified", done: !!form.beneficiaries.trim(), step: 3 },
    { label: "Sector selected", done: !!form.sector && (form.sector !== "others" || !!form.sector_other.trim()), required: true, step: 3 },
    { label: "At least 1 SDG selected", done: form.sdgs.length > 0, required: true, step: 3 },
    { label: "Campus and implementing unit specified", done: !!form.campus.trim() && !!form.implementing_unit.trim(), step: 4 },
    { label: "Project Leader / PI identified", done: !!form.lead, required: true, step: 4 },
    { label: "Approval reference number provided", done: !!form.ntp_number.trim(), step: 5 },
    { label: "Approval document attached", done: approvalDoc.length > 0, step: 5 },
    { label: "Registration certification checked", done: certified, required: true, step: 6 },
  ];
  const completed = checks.filter((c) => c.done).length;
  const missingRequired = checks.filter((c) => c.required && !c.done);
  const completenessOk = completed === checks.length;
  const bad = (k: keyof typeof form) => attempted && (Array.isArray(form[k]) ? form[k].length === 0 : !String(form[k]).trim());

  const handleCreate = async () => {
    setAttempted(true);
    if (missingRequired.length) {
      notify.error(`Complete the required items first: ${missingRequired.map((c) => c.label.toLowerCase()).join("; ")}.`);
      setStep(missingRequired[0].step);
      return;
    }
    setIsCreating(true);
    const opt = (v: string) => v.trim() || undefined;
    try {
      const project = await researchApi.createProject({
        program: form.program ? Number(form.program) : null,
        title: form.title,
        project_code: form.project_code,
        funding_type: form.funding_type,
        lead: Number(form.lead),
        ntp_number: opt(form.ntp_number),
        ntp_date: opt(form.ntp_date),
        toe_signed_date: opt(form.toe_signed_date),
        is_dry_research: form.is_dry_research === "true",
        start_date: opt(form.start_date),
        target_end_date: opt(form.target_end_date),
        rei_thrust: opt(form.rei_thrust),
        sdgs: form.sdgs.map(Number),
        sector: form.sector,
        sector_other: form.sector === "others" ? form.sector_other : undefined,
        is_continuing: form.is_continuing === "true",
        research_type: opt(form.research_type),
        research_priority_area: opt(form.research_priority_area),
        research_typology: form.research_typology,
        campus: opt(form.campus),
        implementing_unit: opt(form.implementing_unit),
        cooperating_agencies: opt(form.cooperating_agencies),
        total_cost: opt(form.total_cost),
        description: opt(form.description),
        objectives: filledObjectives.length ? filledObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n") : undefined,
        beneficiaries: opt(form.beneficiaries),
        expected_outcomes: opt(form.expected_outcomes),
        expected_impacts: opt(form.expected_impacts),
        proposal_submitted_on: opt(form.proposal_submitted_on),
        proposal_reviewed_on: opt(form.proposal_reviewed_on),
        proposal_approved_on: opt(form.proposal_approved_on),
        reviewing_body: opt(form.reviewing_body),
      });
      const uploads = [...approvalDoc, ...supportingDocs];
      const results = await Promise.allSettled(
        uploads.map((file) => documentApi.uploadDocument({ project: project.id, document_type: "other", stage: "inception", file })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) notify.error(`Project registered, but ${failed} document(s) failed to upload. Add them from Documents.`);
      else notify.success("Project registered.");
      navigate("/projects");
    } catch (err) {
      notify.error(errorMessage(err, "Could not register the project."));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Project List
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-semibold" style={{ color: "#64748b" }}>Register Approved Project</span>
      </div>

      <div className="w-full max-w-4xl rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-6 py-4 shrink-0" style={{ background: "#0d2a5e" }}>
          <p className="text-white font-bold text-base">Register Approved Project</p>
          <p className="text-white/50 text-xs mt-0.5">
            Starts at the Notice to Proceed · Step {step + 1}/{WIZARD_STEPS.length} — {WIZARD_STEPS[step].label}
          </p>
        </div>

        <div className="px-5 py-3 border-b shrink-0 overflow-x-auto" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <div className="flex items-center gap-1 min-w-max">
            {WIZARD_STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1">
                <button onClick={() => setStep(i)} className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: i < step ? "#059669" : i === step ? "#0d2a5e" : "#e2e8f0", color: i <= step ? "white" : "#94a3b8" }}
                  >
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: i <= step ? "#0d2a5e" : "#94a3b8", fontSize: "9px" }}>
                    {s.label}
                  </span>
                </button>
                {i < WIZARD_STEPS.length - 1 && <div className="w-5 h-px mb-4" style={{ background: i < step ? "#059669" : "#e2e8f0" }} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <StepNote>Capture the project title, official code, funding, and period. The internal ID is assigned automatically; the official code comes from the University.</StepNote>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Project Title" required invalid={bad("title")} span>
                  <input className={inputCls} style={inputSt} value={form.title} onChange={set("title")} placeholder="Full official title of the research project" />
                </Field>
                <Field label="Project Code (LSPU Faculty Research Number)" required invalid={bad("project_code")}>
                  <input className={inputCls} style={inputSt} value={form.project_code} onChange={set("project_code")} placeholder="e.g. FRN-2026-001" />
                </Field>
                <Field label="Parent Research Program">
                  <select className={inputCls} style={inputSt} value={form.program} onChange={set("program")}>
                    <option value="">Stand-alone (no parent program)</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Funding Type" required invalid={bad("funding_type")}>
                  <select className={inputCls} style={inputSt} value={form.funding_type} onChange={set("funding_type")}>
                    <option value="">Select funding type...</option>
                    {Object.entries(FUNDING_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Research Category">
                  <select className={inputCls} style={inputSt} value={form.research_type} onChange={set("research_type")}>
                    <option value="">Basic or applied...</option>
                    {Object.entries(RESEARCH_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Dry / Wet Research">
                  <select className={inputCls} style={inputSt} value={form.is_dry_research} onChange={set("is_dry_research")}>
                    <option value="true">Dry Research</option>
                    <option value="false">Wet / Laboratory Research</option>
                  </select>
                </Field>
                <Field label="Proposal Type">
                  <select className={inputCls} style={inputSt} value={form.is_continuing} onChange={set("is_continuing")}>
                    <option value="false">New Proposal</option>
                    <option value="true">Continuing</option>
                  </select>
                </Field>
                <Field label="Start Date">
                  <input type="date" className={inputCls} style={inputSt} value={form.start_date} onChange={set("start_date")} />
                </Field>
                <Field label="Target End Date">
                  <input type="date" className={inputCls} style={inputSt} value={form.target_end_date} onChange={set("target_end_date")} />
                </Field>
                <Field label="Total Project Cost (PHP ₱)">
                  <input type="number" min="0" step="0.01" className={inputCls} style={inputSt} value={form.total_cost} onChange={set("total_cost")} placeholder="0.00" />
                </Field>
                <Field label="REI Thrust">
                  <input className={inputCls} style={inputSt} value={form.rei_thrust} onChange={set("rei_thrust")} placeholder="e.g. Sustainable Agriculture" />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <StepNote>A concise overview of the approved project: what it is about, why it matters, how it will be done, and what results are expected.</StepNote>
              <Field label="Project Description / Executive Summary">
                <textarea
                  rows={10}
                  className={inputCls + " resize-none"}
                  style={inputSt}
                  value={form.description}
                  onChange={set("description")}
                  placeholder="Summary, background, rationale, and scope as stated in the approved proposal."
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <StepNote>Capture specific objectives, anticipated outcomes, and long-term impacts. 6Ps expected outputs are set per category under Research Outputs.</StepNote>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label-field mb-0">Specific Objectives</label>
                  <button onClick={() => setObjectives([...objectives, ""])} className="text-xs font-semibold flex items-center gap-1" style={{ color: "#0891b2" }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add Objective
                  </button>
                </div>
                <div className="space-y-2">
                  {objectives.map((obj, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="mt-2.5 text-sm font-bold shrink-0" style={{ color: "#0891b2", width: "20px" }}>{i + 1}.</span>
                      <input
                        value={obj}
                        onChange={(e) => {
                          const n = [...objectives];
                          n[i] = e.target.value;
                          setObjectives(n);
                        }}
                        className={inputCls + " flex-1"}
                        style={inputSt}
                        placeholder={`Objective ${i + 1}...`}
                      />
                      {objectives.length > 1 && (
                        <button onClick={() => setObjectives(objectives.filter((_, idx) => idx !== i))} className="mt-2 text-red-400 hover:text-red-600" aria-label="Remove objective">
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Anticipated Outcomes">
                <textarea rows={3} className={inputCls + " resize-none"} style={inputSt} value={form.expected_outcomes} onChange={set("expected_outcomes")} placeholder="Medium-term changes resulting from outputs (one per line)" />
              </Field>
              <Field label="Long-term Potential Impacts">
                <textarea rows={3} className={inputCls + " resize-none"} style={inputSt} value={form.expected_impacts} onChange={set("expected_impacts")} placeholder="Broad, lasting social, economic, environmental, or policy benefits (one per line)" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <StepNote>Identify beneficiaries and classify the project for institutional reporting.</StepNote>
              <Field label="Target Beneficiaries">
                <textarea rows={3} className={inputCls + " resize-none"} style={inputSt} value={form.beneficiaries} onChange={set("beneficiaries")} placeholder="Primary and secondary beneficiaries: who, estimated number, location (one per line)" />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Sector" required invalid={bad("sector")}>
                  <select className={inputCls} style={inputSt} value={form.sector} onChange={set("sector")}>
                    <option value="">Select sector...</option>
                    {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                {form.sector === "others" && (
                  <Field label="Specify Sector" required invalid={bad("sector_other")}>
                    <input className={inputCls} style={inputSt} value={form.sector_other} onChange={set("sector_other")} placeholder="Other sector" />
                  </Field>
                )}
                <Field label="Research Priority Area">
                  <select className={inputCls} style={inputSt} value={form.research_priority_area} onChange={set("research_priority_area")}>
                    <option value="">Select priority area...</option>
                    {Object.entries(PRIORITY_AREA_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Research Typology">
                  <MultiSelect options={TYPOLOGY_OPTIONS} value={form.research_typology} onChange={(next) => setForm((p) => ({ ...p, research_typology: next }))} placeholder="Select typology" />
                </Field>
                <Field label="Sustainable Development Goals" required invalid={bad("sdgs")}>
                  <MultiSelect invalid={bad("sdgs")} options={SDG_OPTIONS} value={form.sdgs} onChange={(next) => setForm((p) => ({ ...p, sdgs: next }))} placeholder="Select SDGs" />
                </Field>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <StepNote>Identify the implementing campus and unit, and the Project Leader / PI.</StepNote>
              <div>
                <label className="label-field">Implementing Campus</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {CAMPUSES.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, campus: c.name }))}
                      className="p-3 rounded-xl border-2 text-left transition-all"
                      style={{ borderColor: form.campus === c.name ? c.color : "#e2e8f0", background: form.campus === c.name ? c.bg : "white" }}
                    >
                      <p className="text-sm font-black" style={{ color: c.color }}>{c.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{c.name} Campus</p>
                    </button>
                  ))}
                </div>
                <input className={inputCls + " mt-2"} style={inputSt} value={form.campus} onChange={set("campus")} placeholder="Or type the campus name" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Implementing Unit / College / Department">
                  <input className={inputCls} style={inputSt} value={form.implementing_unit} onChange={set("implementing_unit")} placeholder="e.g. College of Teacher Education" />
                </Field>
                <Field label="Cooperating Agencies">
                  <input className={inputCls} style={inputSt} value={form.cooperating_agencies} onChange={set("cooperating_agencies")} placeholder="e.g. DOST-PCAARRD, LGU of Siniloan" />
                </Field>
                <Field label="Project Leader / PI" required invalid={bad("lead")} span>
                  <select className={inputCls} style={inputSt} value={form.lead} onChange={set("lead")}>
                    <option value="">{projectLeaders.length ? "Select project leader..." : "No active project leaders yet"}</option>
                    {projectLeaders.map((u) => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="text-xs" style={{ color: "#94a3b8" }}>Co-investigators and staff are assigned under Personnel Coordination after registration.</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <StepNote>
                Enter the existing approval details. Proposal review and approval happen outside RMIS; these are read-only references for the record.
              </StepNote>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Approval Reference Number (NTP No.)">
                  <input className={inputCls} style={inputSt} value={form.ntp_number} onChange={set("ntp_number")} placeholder="e.g. RES-2026-041" />
                </Field>
                <Field label="Notice to Proceed Date">
                  <input type="date" className={inputCls} style={inputSt} value={form.ntp_date} onChange={set("ntp_date")} />
                </Field>
                <Field label="Approval Date">
                  <input type="date" className={inputCls} style={inputSt} value={form.proposal_approved_on} onChange={set("proposal_approved_on")} />
                </Field>
                <Field label="Approving Office / Authority">
                  <input className={inputCls} style={inputSt} value={form.reviewing_body} onChange={set("reviewing_body")} placeholder="e.g. RDE Council, Board of Regents" />
                </Field>
                <Field label="Proposal Submitted On">
                  <input type="date" className={inputCls} style={inputSt} value={form.proposal_submitted_on} onChange={set("proposal_submitted_on")} />
                </Field>
                <Field label="Proposal Reviewed On">
                  <input type="date" className={inputCls} style={inputSt} value={form.proposal_reviewed_on} onChange={set("proposal_reviewed_on")} />
                </Field>
                <Field label="TOE Signed Date">
                  <input type="date" className={inputCls} style={inputSt} value={form.toe_signed_date} onChange={set("toe_signed_date")} />
                </Field>
                <div>
                  <label className="label-field">Approval Status</label>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#d1fae5", color: "#065f46" }}>Approved</span>
                  </div>
                </div>
                <Field label="Approval Document (Notice of Approval / NTP / MOA)" span>
                  <FilePick label="Click to upload the approval document" files={approvalDoc} onChange={setApprovalDoc} />
                </Field>
                <Field label="Supporting Documents (optional)" span>
                  <FilePick label="Click to upload supporting documents" files={supportingDocs} multiple onChange={setSupportingDocs} />
                </Field>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${completenessOk ? "#22c55e" : "#f59e0b"}` }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: completenessOk ? "#f0fdf4" : "#fffbeb" }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: completenessOk ? "#166534" : "#92400e" }}>Registration Completeness Check</p>
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ background: completenessOk ? "#d1fae5" : "#fde68a", color: completenessOk ? "#166534" : "#92400e" }}
                  >
                    {completed}/{checks.length} complete
                  </span>
                </div>
                <div className="p-4 space-y-1.5" style={{ background: "white" }}>
                  <div className="mb-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(completed / checks.length) * 100}%`, background: completenessOk ? "#22c55e" : "#f59e0b" }} />
                  </div>
                  {checks.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setStep(c.step)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left"
                      style={{ background: c.done ? "#f0fdf4" : "#fff7f0" }}
                    >
                      <span className="text-xs font-black w-4" style={{ color: c.done ? "#16a34a" : "#f59e0b" }}>{c.done ? "✓" : "•"}</span>
                      <span className="text-xs flex-1" style={{ color: c.done ? "#166534" : "#92400e" }}>{c.label}</span>
                      <span className="text-xs font-mono shrink-0" style={{ color: c.required ? "#dc2626" : "#94a3b8" }}>{c.required ? "required" : "recommended"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Project Code" value={form.project_code} />
                <InfoCard label="Initial Status" value="Ongoing (Approved / Registered)" />
                <InfoCard label="Documents to Upload" value={String(approvalDoc.length + supportingDocs.length)} />
                <InfoCard label="Registration Date" value={new Date().toLocaleDateString("en-PH")} />
              </div>

              <div className="rounded-xl p-4 space-y-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Registration Certification</p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={certified} onChange={(e) => setCertified(e.target.checked)} />
                  <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>
                    I certify that the information in this registration is true and correct to the best of my knowledge, and that the project
                    has been approved through the University's research approval process.
                  </p>
                </label>
              </div>

              {missingRequired.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                  <p className="text-xs font-bold" style={{ color: "#c2410c" }}>
                    ⚠ {missingRequired.length} required item{missingRequired.length !== 1 ? "s" : ""} still missing. Click an item above to jump to its step.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
          <button
            onClick={() => (step > 0 ? setStep(step - 1) : navigate("/projects"))}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "#f1f5f9", color: "#64748b" }}
          >
            {step === 0 ? "Cancel" : "← Previous"}
          </button>
          <div className="hidden sm:flex items-center gap-1">
            {WIZARD_STEPS.map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? "24px" : "6px", background: i <= step ? "#0891b2" : "#e2e8f0" }} />
            ))}
          </div>
          {step < WIZARD_STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#0891b2" }}>
              Next →
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5 disabled:opacity-60"
              style={{ background: missingRequired.length === 0 ? "#0d2a5e" : "#94a3b8" }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {isCreating ? "Registering…" : "Register Project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterProjectPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Register Approved Project">
        <RegisterProjectContent />
      </AppShell>
    </ProtectedRoute>
  );
}
