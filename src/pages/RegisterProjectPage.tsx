import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { documentApi } from "../lib/documentApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import type { Program, FundingType, ProjectImportError } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { MultiSelect } from "../components/common/MultiSelect";
import { useAuth } from "../context/AuthContext";
import {
  PRIORITY_AREA_LABELS,
  RESEARCH_TYPE_LABELS,
  SDG_OPTIONS,
  SECTOR_OPTIONS,
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
  { label: "Project Details", icon: "📋" },
  { label: "Proponents & Team", icon: "👥" },
  { label: "Classification", icon: "🌱" },
  { label: "Proposal Content", icon: "📝" },
  { label: "Beneficiaries", icon: "🎯" },
  { label: "Endorsement & Approval", icon: "🔖" },
  { label: "Validate & Register", icon: "✅" },
];

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const MODES = [
  ["manual", "✍️ Manual Entry"],
  ["excel", "📊 Upload via Excel"],
] as const;

type TeamRow = { member_role: string; name: string; gender: string };
type BeneficiaryRow = { group: string; description: string; total: string };

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

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="mt-2 text-red-400 hover:text-red-600 shrink-0" aria-label={label}>
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

function AddRowButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="text-xs font-semibold flex items-center gap-1" style={{ color: "#0891b2" }}>
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {children}
    </button>
  );
}

function ExcelImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<ProjectImportError[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleTemplate = async () => {
    setIsDownloading(true);
    try {
      await researchApi.downloadImportTemplate();
    } catch {
      notify.error("Could not download the template.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      notify.error("Choose the filled .xlsx template first.");
      return;
    }
    setIsUploading(true);
    setErrors([]);
    try {
      const project = await researchApi.importProject(file);
      notify.success(`Project ${project.project_code} registered from Excel.`);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: ProjectImportError[] } } })?.response?.data;
      if (data?.errors?.length) {
        setErrors(data.errors);
        notify.error(`Nothing was saved. Fix the ${data.errors.length} issue${data.errors.length !== 1 ? "s" : ""} below and upload again.`);
      } else {
        notify.error(errorMessage(err, "Could not import the workbook."));
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <StepNote>
        Fill in the RMIS template, which follows the Research Proposal Form (LSPU-RDO-SF-018): project details, team, the 17 SDGs, proposal
        sections, 6Ps expected outputs, target beneficiaries, budget requirements (QTR1–QTR4), work plan, and the Annex A endorsement page. The
        whole workbook registers as one project. If any row has an error, nothing is saved and every error is listed.
      </StepNote>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-5 space-y-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Step 1 · Get the template</p>
          <p className="text-xs" style={{ color: "#475569" }}>
            One sheet per form section. Column C of the Project sheet and the header comments list the allowed values.
          </p>
          <button
            onClick={handleTemplate}
            disabled={isDownloading}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: "#e0eaf7", color: "#0d2a5e" }}
          >
            {isDownloading ? "Downloading…" : "⬇ Download Excel Template"}
          </button>
        </div>
        <div className="rounded-xl p-5 space-y-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Step 2 · Upload the filled workbook</p>
          <label
            className="rounded-xl p-5 border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors hover:border-[#0891b2]"
            style={{ borderColor: "#cbd5e1", background: "white" }}
          >
            <span className="text-2xl">📊</span>
            <p className="text-sm font-semibold text-center" style={{ color: "#475569" }}>{file ? file.name : "Click to choose the .xlsx file"}</p>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                if (picked && picked.size > MAX_UPLOAD_BYTES) {
                  notify.error(`${picked.name} is over 25MB.`);
                  return;
                }
                setFile(picked);
                setErrors([]);
              }}
            />
          </label>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #fecaca" }}>
          <div className="px-4 py-2.5" style={{ background: "#fef2f2" }}>
            <p className="text-xs font-bold" style={{ color: "#b91c1c" }}>
              {errors.length} issue{errors.length !== 1 ? "s" : ""} found · nothing was saved
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Sheet", "Row", "Field", "Problem"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold" style={{ color: "#64748b" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: "#0d2a5e" }}>{e.sheet ?? "—"}</td>
                    <td className="px-3 py-2 font-mono" style={{ color: "#475569" }}>{e.row ?? "—"}</td>
                    <td className="px-3 py-2" style={{ color: "#475569" }}>{e.field === "non_field_errors" ? "—" : e.field}</td>
                    <td className="px-3 py-2" style={{ color: "#b91c1c" }}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button onClick={() => navigate("/projects")} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={isUploading || !file}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: file ? "#0d2a5e" : "#94a3b8" }}
        >
          {isUploading ? "Importing…" : "Upload & Register Project"}
        </button>
      </div>
    </div>
  );
}

function RegisterProjectContent() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const { user } = useAuth();
  const [projectLeaders, setProjectLeaders] = useState<{ id: number; email: string }[]>([]);
  const [leadersBlocked, setLeadersBlocked] = useState(false);
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [certified, setCertified] = useState(false);
  const [objectives, setObjectives] = useState([""]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [beneficiaryRows, setBeneficiaryRows] = useState<BeneficiaryRow[]>([{ group: "", description: "", total: "" }]);
  const [approvalDoc, setApprovalDoc] = useState<File[]>([]);
  const [supportingDocs, setSupportingDocs] = useState<File[]>([]);

  const [form, setForm] = useState({
    title: "",
    project_code: "",
    funding_type: "",
    program: "",
    lead: "",
    lead_gender: "",
    contact_number: "",
    ntp_number: "",
    ntp_date: "",
    toe_signed_date: "",
    is_dry_research: "true",
    start_date: "",
    target_end_date: "",
    rei_thrust: "",
    sdgs: [] as string[],
    sectors: [] as string[],
    sector_other: "",
    is_continuing: "false",
    continuing_year: "",
    research_type: "",
    research_priority_area: "",
    research_typology: [] as string[],
    campus: "",
    college: "",
    implementing_unit: "",
    cooperating_agencies: "",
    total_cost: "",
    background: "",
    methodology: "",
    socio_economic_significance: "",
    monitoring_evaluation: "",
    references: "",
    description: "",
    expected_outcomes: "",
    expected_impacts: "",
    proposal_submitted_on: "",
    proposal_reviewed_on: "",
    proposal_approved_on: "",
    reviewing_body: "",
    endorsed_by_dean: "",
    endorsed_by_dean_on: "",
    noted_by_rds_director: "",
    noted_by_rds_director_on: "",
    recommended_by_campus_director: "",
    recommended_by_campus_director_on: "",
    recommended_by_vprde: "",
    recommended_by_vprde_on: "",
    approved_by_president: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    let active = true;
    researchApi
      .getPrograms()
      .then((programList) => active && setPrograms(programList))
      .catch(() => active && notify.error("Could not load programs. Check your connection and refresh."));
    researchApi
      .getUsersByRole("project_leader")
      .then((leaders) => active && setProjectLeaders(leaders))
      .catch(() => {
        if (!active || !user) return;
        if (user.role?.code === "project_leader") {
          setProjectLeaders([{ id: user.pk, email: user.email }]);
          setForm((p) => ({ ...p, lead: String(user.pk) }));
        } else {
          setLeadersBlocked(true);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const filledObjectives = objectives.map((o) => o.trim()).filter(Boolean);
  const filledTeam = team.filter((t) => t.name.trim());
  const filledBeneficiaries = beneficiaryRows.filter((b) => b.group.trim());
  const isContinuing = form.is_continuing === "true";
  const checks: { label: string; done: boolean; required?: boolean; step: number }[] = [
    { label: "Project title entered", done: !!form.title.trim(), required: true, step: 0 },
    { label: "Project code (LSPU Faculty Research Number) entered", done: !!form.project_code.trim(), required: true, step: 0 },
    { label: "Funding type selected", done: !!form.funding_type, required: true, step: 0 },
    ...(isContinuing ? [{ label: "Continuing year (2 or later) entered", done: Number(form.continuing_year) >= 2, required: true, step: 0 }] : []),
    { label: "Start and end dates provided", done: !!form.start_date && !!form.target_end_date, step: 0 },
    { label: "Project Leader identified", done: !!form.lead, required: true, step: 1 },
    { label: "Campus, college, and implementing unit specified", done: !!form.campus.trim() && !!form.college.trim() && !!form.implementing_unit.trim(), step: 1 },
    { label: "At least 1 sector selected", done: form.sectors.length > 0 && (!form.sectors.includes("others") || !!form.sector_other.trim()), required: true, step: 2 },
    { label: "At least 1 SDG selected", done: form.sdgs.length > 0, required: true, step: 2 },
    { label: "Background of the study written", done: !!form.background.trim(), step: 3 },
    { label: "At least 1 objective defined", done: filledObjectives.length > 0, step: 3 },
    { label: "Methodology written", done: !!form.methodology.trim(), step: 3 },
    { label: "Target beneficiaries identified", done: filledBeneficiaries.length > 0, step: 4 },
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
        sectors: form.sectors,
        sector_other: form.sectors.includes("others") ? form.sector_other : undefined,
        is_continuing: isContinuing,
        continuing_year: isContinuing ? Number(form.continuing_year) : undefined,
        research_type: opt(form.research_type),
        research_priority_area: opt(form.research_priority_area),
        research_typology: form.research_typology,
        campus: opt(form.campus),
        college: opt(form.college),
        implementing_unit: opt(form.implementing_unit),
        cooperating_agencies: opt(form.cooperating_agencies),
        total_cost: opt(form.total_cost),
        lead_gender: opt(form.lead_gender),
        contact_number: opt(form.contact_number),
        background: opt(form.background),
        objectives: filledObjectives.length ? filledObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n") : undefined,
        methodology: opt(form.methodology),
        socio_economic_significance: opt(form.socio_economic_significance),
        monitoring_evaluation: opt(form.monitoring_evaluation),
        references: opt(form.references),
        description: opt(form.description),
        expected_outcomes: opt(form.expected_outcomes),
        expected_impacts: opt(form.expected_impacts),
        proposal_submitted_on: opt(form.proposal_submitted_on),
        proposal_reviewed_on: opt(form.proposal_reviewed_on),
        proposal_approved_on: opt(form.proposal_approved_on),
        reviewing_body: opt(form.reviewing_body),
        endorsed_by_dean: opt(form.endorsed_by_dean),
        endorsed_by_dean_on: opt(form.endorsed_by_dean_on),
        noted_by_rds_director: opt(form.noted_by_rds_director),
        noted_by_rds_director_on: opt(form.noted_by_rds_director_on),
        recommended_by_campus_director: opt(form.recommended_by_campus_director),
        recommended_by_campus_director_on: opt(form.recommended_by_campus_director_on),
        recommended_by_vprde: opt(form.recommended_by_vprde),
        recommended_by_vprde_on: opt(form.recommended_by_vprde_on),
        approved_by_president: opt(form.approved_by_president),
      });
      const results = await Promise.allSettled([
        ...filledTeam.map((t) =>
          researchApi.createTeamMember({ project: project.id, member_role: t.member_role, name: t.name.trim(), gender: t.gender || undefined }),
        ),
        ...filledBeneficiaries.map((b) =>
          researchApi.createBeneficiary({ project: project.id, group: b.group.trim(), description: b.description.trim(), total: Number(b.total) || 0 }),
        ),
        ...[...approvalDoc, ...supportingDocs].map((file) =>
          documentApi.uploadDocument({ project: project.id, document_type: "other", stage: "inception", file }),
        ),
      ]);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) notify.error(`Project registered, but ${failed} team/beneficiary/document row(s) failed to save. Add them from the project page.`);
      else notify.success("Project registered.");
      navigate(`/projects/${project.id}`);
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
            Research Proposal Form (LSPU-RDO-SF-018) ·{" "}
            {mode === "manual" ? `Step ${step + 1}/${WIZARD_STEPS.length} — ${WIZARD_STEPS[step].label}` : "Upload via Excel"}
          </p>
        </div>

        <div className="px-5 pt-4 flex flex-wrap gap-2">
          {MODES.map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={mode === m ? { background: "#0d2a5e", color: "white" } : { background: "#f1f5f9", color: "#64748b" }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "excel" && <ExcelImport />}

        {mode === "manual" && (
          <>
            <div className="px-5 py-3 mt-4 border-y shrink-0 overflow-x-auto" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
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
                  <StepNote>Section I of the Research Proposal Form. The internal ID is assigned automatically; the official code is the LSPU Faculty Research Number.</StepNote>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Title" required invalid={bad("title")} span>
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
                    <Field label="Basic or Applied Research">
                      <select className={inputCls} style={inputSt} value={form.research_type} onChange={set("research_type")}>
                        <option value="">Basic or applied...</option>
                        {Object.entries(RESEARCH_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Wet or Dry Research">
                      <select className={inputCls} style={inputSt} value={form.is_dry_research} onChange={set("is_dry_research")}>
                        <option value="true">Dry Research</option>
                        <option value="false">Wet Research (i.e., with laboratory)</option>
                      </select>
                    </Field>
                    <Field label="New or Continuing">
                      <select className={inputCls} style={inputSt} value={form.is_continuing} onChange={set("is_continuing")}>
                        <option value="false">New Proposal</option>
                        <option value="true">Continuing</option>
                      </select>
                    </Field>
                    {isContinuing && (
                      <Field label="Continuing Year" required invalid={attempted && Number(form.continuing_year) < 2}>
                        <input type="number" min="2" className={inputCls} style={inputSt} value={form.continuing_year} onChange={set("continuing_year")} placeholder="e.g. 2 for Year 2" />
                      </Field>
                    )}
                    <Field label="Start Date">
                      <input type="date" className={inputCls} style={inputSt} value={form.start_date} onChange={set("start_date")} />
                    </Field>
                    <Field label="End Date">
                      <input type="date" className={inputCls} style={inputSt} value={form.target_end_date} onChange={set("target_end_date")} />
                    </Field>
                    <Field label="Total Project/Study Cost (PHP ₱)">
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
                  <StepNote>Project Leader, Co-Project Leader, and Project Team as listed on the form, plus the implementing campus and college. Team names are free text since members may not have RMIS accounts.</StepNote>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Project Leader" required invalid={bad("lead")} span>
                      <select className={inputCls} style={inputSt} value={form.lead} onChange={set("lead")}>
                        <option value="">
                          {projectLeaders.length
                            ? "Select project leader..."
                            : leadersBlocked
                              ? "Leader list isn't available for your role, use Upload via Excel"
                              : "No active project leaders yet"}
                        </option>
                        {projectLeaders.map((u) => (
                          <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Project Leader Gender">
                      <select className={inputCls} style={inputSt} value={form.lead_gender} onChange={set("lead_gender")}>
                        <option value="">Select...</option>
                        {GENDERS.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Contact No./s.">
                      <input className={inputCls} style={inputSt} value={form.contact_number} onChange={set("contact_number")} placeholder="e.g. 0998 164 9081" />
                    </Field>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-field mb-0">Co-Project Leader / Project Team</label>
                      <AddRowButton onClick={() => setTeam([...team, { member_role: team.length ? "member" : "co_leader", name: "", gender: "" }])}>Add Member</AddRowButton>
                    </div>
                    {team.length === 0 ? (
                      <p className="text-xs" style={{ color: "#94a3b8" }}>No co-leader or team members added.</p>
                    ) : (
                      <div className="space-y-2">
                        {team.map((t, i) => {
                          const update = (patch: Partial<TeamRow>) => setTeam(team.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
                          return (
                            <div key={i} className="flex gap-2 items-start">
                              <select className={inputCls + " max-w-44"} style={inputSt} value={t.member_role} onChange={(e) => update({ member_role: e.target.value })}>
                                <option value="co_leader">Co-Project Leader</option>
                                <option value="member">Team Member</option>
                              </select>
                              <input className={inputCls + " flex-1"} style={inputSt} value={t.name} onChange={(e) => update({ name: e.target.value })} placeholder="Name (or group, e.g. EIU Coordinators)" />
                              <select className={inputCls + " max-w-32"} style={inputSt} value={t.gender} onChange={(e) => update({ gender: e.target.value })}>
                                <option value="">Gender</option>
                                {GENDERS.map((g) => (
                                  <option key={g.value} value={g.value}>{g.label}</option>
                                ))}
                              </select>
                              <RemoveButton onClick={() => setTeam(team.filter((_, idx) => idx !== i))} label="Remove member" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label-field">Campus</label>
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
                    <Field label="College Unit">
                      <input className={inputCls} style={inputSt} value={form.college} onChange={set("college")} placeholder="e.g. CTE" />
                    </Field>
                    <Field label="Implementing Unit">
                      <input className={inputCls} style={inputSt} value={form.implementing_unit} onChange={set("implementing_unit")} placeholder="e.g. Extension and Training Services" />
                    </Field>
                    <Field label="Cooperating Agency/ies" span>
                      <input className={inputCls} style={inputSt} value={form.cooperating_agencies} onChange={set("cooperating_agencies")} placeholder="e.g. DOST-PCAARRD, LGU of Siniloan" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <StepNote>Sector, research priority area, typology, and the 17 Sustainable Development Goals. Sector and SDGs allow more than one.</StepNote>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Sector" required invalid={bad("sectors")}>
                      <MultiSelect invalid={bad("sectors")} options={SECTOR_OPTIONS} value={form.sectors} onChange={(next) => setForm((p) => ({ ...p, sectors: next }))} placeholder="Select sector" />
                    </Field>
                    {form.sectors.includes("others") && (
                      <Field label="Specify Sector (Others)" required invalid={bad("sector_other")}>
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
                    <Field label="Sustainable Development Goals (SDGs)" required invalid={bad("sdgs")} span>
                      <MultiSelect invalid={bad("sdgs")} options={SDG_OPTIONS} value={form.sdgs} onChange={(next) => setForm((p) => ({ ...p, sdgs: next }))} placeholder="Select SDGs (1–17)" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <StepNote>Sections II–IV, VI, VIII, and IX of the form. Section V (6Ps expected outputs) is set under Research Outputs, and Section X (budget) under Budget, or all at once through the Excel upload.</StepNote>
                  <Field label="II. Background of the Study">
                    <textarea rows={6} className={inputCls + " resize-y"} style={inputSt} value={form.background} onChange={set("background")} placeholder="Background and rationale as stated in the approved proposal" />
                  </Field>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="label-field mb-0">III. Objectives of the Study</label>
                      <AddRowButton onClick={() => setObjectives([...objectives, ""])}>Add Objective</AddRowButton>
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
                          {objectives.length > 1 && <RemoveButton onClick={() => setObjectives(objectives.filter((_, idx) => idx !== i))} label="Remove objective" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Field label="IV. Project Descriptions / Methodology">
                    <textarea rows={5} className={inputCls + " resize-y"} style={inputSt} value={form.methodology} onChange={set("methodology")} />
                  </Field>
                  <Field label="VI. Socio-Economic Significance">
                    <textarea rows={4} className={inputCls + " resize-y"} style={inputSt} value={form.socio_economic_significance} onChange={set("socio_economic_significance")} />
                  </Field>
                  <Field label="VIII. Monitoring / Evaluation">
                    <textarea rows={4} className={inputCls + " resize-y"} style={inputSt} value={form.monitoring_evaluation} onChange={set("monitoring_evaluation")} />
                  </Field>
                  <Field label="IX. List of References (APA format)">
                    <textarea rows={4} className={inputCls + " resize-y"} style={inputSt} value={form.references} onChange={set("references")} />
                  </Field>
                  <Field label="Executive Summary (optional)">
                    <textarea rows={3} className={inputCls + " resize-y"} style={inputSt} value={form.description} onChange={set("description")} placeholder="Short overview shown on the project page" />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Anticipated Outcomes (optional)">
                      <textarea rows={3} className={inputCls + " resize-none"} style={inputSt} value={form.expected_outcomes} onChange={set("expected_outcomes")} placeholder="One per line" />
                    </Field>
                    <Field label="Long-term Potential Impacts (optional)">
                      <textarea rows={3} className={inputCls + " resize-none"} style={inputSt} value={form.expected_impacts} onChange={set("expected_impacts")} placeholder="One per line" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <StepNote>Section VII: one row per beneficiary group with its total.</StepNote>
                  <div className="flex items-center justify-between">
                    <label className="label-field mb-0">VII. Target Beneficiaries</label>
                    <AddRowButton onClick={() => setBeneficiaryRows([...beneficiaryRows, { group: "", description: "", total: "" }])}>Add Group</AddRowButton>
                  </div>
                  <div className="space-y-2">
                    {beneficiaryRows.map((b, i) => {
                      const update = (patch: Partial<BeneficiaryRow>) =>
                        setBeneficiaryRows(beneficiaryRows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
                      return (
                        <div key={i} className="flex gap-2 items-start">
                          <input className={inputCls + " max-w-56"} style={inputSt} value={b.group} onChange={(e) => update({ group: e.target.value })} placeholder="Group, e.g. Faculty" />
                          <input className={inputCls + " flex-1"} style={inputSt} value={b.description} onChange={(e) => update({ description: e.target.value })} placeholder="Description" />
                          <input type="number" min="0" className={inputCls + " max-w-24"} style={inputSt} value={b.total} onChange={(e) => update({ total: e.target.value })} placeholder="Total" />
                          {beneficiaryRows.length > 1 && <RemoveButton onClick={() => setBeneficiaryRows(beneficiaryRows.filter((_, idx) => idx !== i))} label="Remove group" />}
                        </div>
                      );
                    })}
                  </div>
                  {filledBeneficiaries.length > 0 && (
                    <p className="text-xs font-semibold" style={{ color: "#64748b" }}>
                      Total beneficiaries: {filledBeneficiaries.reduce((sum, b) => sum + (Number(b.total) || 0), 0).toLocaleString("en-PH")}
                    </p>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <StepNote>
                    Approval references and the Annex A endorsement page. Review, endorsement, and approval happen outside RMIS; these are recorded as read-only references.
                  </StepNote>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Approval Reference Number (NTP No.)">
                      <input className={inputCls} style={inputSt} value={form.ntp_number} onChange={set("ntp_number")} placeholder="e.g. RES-2026-041" />
                    </Field>
                    <Field label="Notice to Proceed Date">
                      <input type="date" className={inputCls} style={inputSt} value={form.ntp_date} onChange={set("ntp_date")} />
                    </Field>
                    <Field label="TOE Signed Date">
                      <input type="date" className={inputCls} style={inputSt} value={form.toe_signed_date} onChange={set("toe_signed_date")} />
                    </Field>
                    <Field label="Reviewing Body">
                      <input className={inputCls} style={inputSt} value={form.reviewing_body} onChange={set("reviewing_body")} placeholder="e.g. ITRC, ETRC, CRC" />
                    </Field>
                    <Field label="Proposal Reviewed On">
                      <input type="date" className={inputCls} style={inputSt} value={form.proposal_reviewed_on} onChange={set("proposal_reviewed_on")} />
                    </Field>
                    <Field label="Date Submitted (Project Leader)">
                      <input type="date" className={inputCls} style={inputSt} value={form.proposal_submitted_on} onChange={set("proposal_submitted_on")} />
                    </Field>
                  </div>

                  <p className="text-xs font-bold uppercase tracking-wide pt-2" style={{ color: "#64748b" }}>Annex A · Endorsement Page</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Endorsed By (Dean/Associate Dean)">
                      <input className={inputCls} style={inputSt} value={form.endorsed_by_dean} onChange={set("endorsed_by_dean")} />
                    </Field>
                    <Field label="Date Endorsed">
                      <input type="date" className={inputCls} style={inputSt} value={form.endorsed_by_dean_on} onChange={set("endorsed_by_dean_on")} />
                    </Field>
                    <Field label="Noted By (RDS Director/Chairperson)">
                      <input className={inputCls} style={inputSt} value={form.noted_by_rds_director} onChange={set("noted_by_rds_director")} />
                    </Field>
                    <Field label="Date Noted">
                      <input type="date" className={inputCls} style={inputSt} value={form.noted_by_rds_director_on} onChange={set("noted_by_rds_director_on")} />
                    </Field>
                    <Field label="Recommending Approval (Campus Director)">
                      <input className={inputCls} style={inputSt} value={form.recommended_by_campus_director} onChange={set("recommended_by_campus_director")} />
                    </Field>
                    <Field label="Date Recommended (Campus Director)">
                      <input type="date" className={inputCls} style={inputSt} value={form.recommended_by_campus_director_on} onChange={set("recommended_by_campus_director_on")} />
                    </Field>
                    <Field label="Recommending Approval (VPRDE)">
                      <input className={inputCls} style={inputSt} value={form.recommended_by_vprde} onChange={set("recommended_by_vprde")} />
                    </Field>
                    <Field label="Date Recommended (VPRDE)">
                      <input type="date" className={inputCls} style={inputSt} value={form.recommended_by_vprde_on} onChange={set("recommended_by_vprde_on")} />
                    </Field>
                    <Field label="Approved By (University President)">
                      <input className={inputCls} style={inputSt} value={form.approved_by_president} onChange={set("approved_by_president")} />
                    </Field>
                    <Field label="Date Approved">
                      <input type="date" className={inputCls} style={inputSt} value={form.proposal_approved_on} onChange={set("proposal_approved_on")} />
                    </Field>
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
          </>
        )}
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
