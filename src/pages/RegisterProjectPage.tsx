import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction, type TextareaHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { outputsApi } from "../lib/outputsApi";
import type { SixPCategory } from "../types/outputs";
import { DOCUMENT_ACCEPT, documentApi } from "../lib/documentApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import type { FundingType, ProjectImportError } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { MultiSelect } from "../components/common/MultiSelect";
import { UserPicker } from "../components/common/UserPicker";
import { MoneyInput } from "../components/common/MoneyInput";
import type { AdminUser, Role } from "../types/auth";
import { authApi } from "../lib/authApi";
import { ProposalPreview, type ProposalData } from "../components/registration/ProposalPreview";
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
  { label: "6Ps, Beneficiaries & Work Plan", icon: "🎯" },
  { label: "Budget (LIB)", icon: "💰" },
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

type TeamRow = { member_role: string; name: string; gender: string; user: number | null };
type BeneficiaryRow = { group: string; description: string; total: string };
type OutputRow = { category: SixPCategory | ""; description: string; target_count: string };
type WorkPlanRow = { title: string; start_date: string; target_date: string };
// Section V uses the form's own 6P wording
const SIX_P_FORM: [SixPCategory, string][] = [
  ["publications", "Publications"],
  ["patents", "Patent"],
  ["products", "Products"],
  ["people_services", "People Services"],
  ["places_partnerships", "Places/Partnerships"],
  ["policies", "Policy Recommendations"],
];
type LibRow = { category: LibCategory; description: string; q1: string; q2: string; q3: string; q4: string };
type LibCategory = "ps" | "mooe" | "co";

const LIB_CATEGORIES: { key: LibCategory; label: string }[] = [
  { key: "ps", label: "Personal Services (PS)" },
  { key: "mooe", label: "Maintenance and Other Operating Expenses (MOOE)" },
  { key: "co", label: "Equipment Outlay / Capital Outlay (CO)" },
];
const QUARTERS = ["q1", "q2", "q3", "q4"] as const;
const libRowTotal = (r: LibRow) => QUARTERS.reduce((sum, q) => sum + (Number(r[q]) || 0), 0);
const peso = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type EndorserRow = { role_code: string; user: number | null; name: string; designation: string; signed_on: string };

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

/** Grows with its content so pasted proposal text (line breaks, indents, blank lines) shows exactly as copied. */
function AutoTextarea({ minRows = 1, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={minRows} className={`${className} resize-none overflow-hidden whitespace-pre-wrap`} {...props} />;
}

type StagedFile = { key: string; file: File; progress: number; status: "uploading" | "done" | "error"; token?: string; error?: string };

function FilePick({ label, files, multiple, onChange }: { label: string; files: StagedFile[]; multiple?: boolean; onChange: Dispatch<SetStateAction<StagedFile[]>> }) {
  const patch = (key: string, p: Partial<StagedFile>) => onChange((list) => list.map((f) => (f.key === key ? { ...f, ...p } : f)));
  const upload = (entry: StagedFile) => {
    patch(entry.key, { status: "uploading", progress: 0, error: undefined });
    documentApi
      .stageDocument(entry.file, (progress) => patch(entry.key, { progress }))
      .then((r) => patch(entry.key, { status: "done", progress: 100, token: r.staged_token }))
      .catch((err) => patch(entry.key, { status: "error", error: errorMessage(err, "Upload failed.") }));
  };

  return (
    <div className="space-y-2">
      <label
        className="rounded-xl p-6 border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors hover:border-[#0891b2]"
        style={{ borderColor: "#cbd5e1", background: "white" }}
      >
        <span className="text-2xl">📄</span>
        <p className="text-sm font-semibold text-center" style={{ color: "#475569" }}>{label}</p>
        <p className="text-xs" style={{ color: "#94a3b8" }}>PDF, Word, or Excel up to 25MB each</p>
        <input
          type="file"
          accept={DOCUMENT_ACCEPT}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            const tooBig = picked.find((f) => f.size > MAX_UPLOAD_BYTES);
            if (tooBig) {
              notify.error(`${tooBig.name} is over 25MB.`);
              return;
            }
            const entries = picked.map((file): StagedFile => ({ key: `${file.name}-${Date.now()}-${Math.random()}`, file, progress: 0, status: "uploading" }));
            onChange((list) => (multiple ? [...list, ...entries] : entries));
            entries.forEach(upload);
          }}
        />
      </label>
      {files.map((f) => {
        const color = f.status === "error" ? "#dc2626" : f.status === "done" ? "#16a34a" : "#0891b2";
        return (
          <div key={f.key} className="rounded-lg px-3 py-2" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold flex-1 truncate" style={{ color: "#334155" }}>{f.file.name}</p>
              <span className="text-xs font-semibold shrink-0" style={{ color }}>
                {f.status === "done" ? "✓ Uploaded" : f.status === "error" ? "Failed" : f.progress >= 100 ? "Saving…" : `${f.progress}%`}
              </span>
              {f.status === "error" && (
                <button type="button" onClick={() => upload(f)} className="text-xs font-semibold" style={{ color: "#0891b2" }}>
                  Retry
                </button>
              )}
              <button type="button" onClick={() => onChange((list) => list.filter((x) => x.key !== f.key))} className="text-red-400 hover:text-red-600" aria-label={`Remove ${f.file.name}`}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${f.status === "error" ? 100 : f.progress}%`, background: color }} />
            </div>
            {f.error && <p className="mt-1 text-xs" style={{ color: "#dc2626" }}>{f.error}</p>}
          </div>
        );
      })}
    </div>
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
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<ProposalData | null>(null);

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

  const showImportErrors = (err: unknown, fallback: string) => {
    const data = (err as { response?: { data?: { errors?: ProjectImportError[] } } })?.response?.data;
    if (data?.errors?.length) {
      setErrors(data.errors);
      notify.error(`Nothing was saved. Fix the ${data.errors.length} issue${data.errors.length !== 1 ? "s" : ""} below and upload again.`);
    } else {
      notify.error(errorMessage(err, fallback));
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsPreviewing(true);
    setErrors([]);
    try {
      setPreview(await researchApi.previewImport(file));
    } catch (err) {
      showImportErrors(err, "Could not read the workbook.");
    } finally {
      setIsPreviewing(false);
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
      showImportErrors(err, "Could not import the workbook.");
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
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={isPreviewing || isUploading || !file}
            className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-[#c7d8ef] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#e0eaf7", color: "#0d2a5e" }}
          >
            {isPreviewing ? "Reading…" : "👁 View as SF-018"}
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
      {preview && <ProposalPreview data={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function RegisterProjectContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProjectLeader = user?.role?.code === "project_leader";
  const selfName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.email || "";
  const [projectLeaders, setProjectLeaders] = useState<{ id: number; email: string; full_name?: string }[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [leadersBlocked, setLeadersBlocked] = useState(false);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [endorsers, setEndorsers] = useState<EndorserRow[]>([]);
  const [libRows, setLibRows] = useState<LibRow[]>([]);
  const [libYear, setLibYear] = useState(String(new Date().getFullYear()));
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [triedSteps, setTriedSteps] = useState<number[]>([]);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [certified, setCertified] = useState(false);
  const [objectives, setObjectives] = useState([""]);
  const [studyTitles, setStudyTitles] = useState(["", ""]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [beneficiaryRows, setBeneficiaryRows] = useState<BeneficiaryRow[]>([{ group: "", description: "", total: "" }]);
  const [outputRows, setOutputRows] = useState<OutputRow[]>([]);
  const [workPlanRows, setWorkPlanRows] = useState<WorkPlanRow[]>([]);
  const [approvalDoc, setApprovalDoc] = useState<StagedFile[]>([]);
  const [supportingDocs, setSupportingDocs] = useState<StagedFile[]>([]);

  const [form, setForm] = useState({
    title: "",
    project_code: "",
    funding_type: "",
    lead: isProjectLeader && user ? String(user.pk) : "",
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
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    let active = true;
    authApi
      .getRoles()
      .then((list) => active && setRoles(list))
      .catch(() => undefined);
    researchApi
      .getActiveUsers()
      .then((list) => active && setAccounts(list))
      .catch(() => undefined);
    if (!user || user.role?.code === "project_leader") return;
    researchApi
      .getUsersByRole("project_leader")
      .then((leaders) => active && setProjectLeaders(leaders))
      .catch(() => active && setLeadersBlocked(true));
    return () => {
      active = false;
    };
  }, [user]);

  // Objectives are stored one per line, so a PDF-wrapped objective is joined back into a single line.
  const filledObjectives = objectives.map((o) => o.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const filledStudies = studyTitles.map((t) => t.trim()).filter(Boolean);
  const filledTeam = team.filter((t) => t.name.trim());
  const filledBeneficiaries = beneficiaryRows.filter((b) => b.group.trim());
  const filledOutputs = outputRows.filter((o) => o.category && o.description.trim());
  const filledWorkPlan = workPlanRows.filter((w) => w.title.trim() && w.target_date);
  const filledEndorsers = endorsers.filter((e) => e.name.trim());
  const filledLib = libRows.filter((r) => r.description.trim() && libRowTotal(r) > 0);
  const updateLib = (i: number, patch: Partial<LibRow>) => setLibRows((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const roleName = (code: string) => roles.find((r) => r.code === code)?.name ?? "";
  const peopleWithRole = (code: string) => accounts.filter((a) => a.role?.code === code);
  const updateEndorser = (i: number, patch: Partial<EndorserRow>) => setEndorsers((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const pickEndorserRole = (i: number, code: string) => {
    const people = code ? peopleWithRole(code) : [];
    const only = people.length === 1 ? people[0] : null;
    updateEndorser(i, {
      role_code: code,
      user: only?.id ?? null,
      name: only?.full_name ?? "",
      designation: only?.position || roleName(code),
    });
  };
  const pickEndorserUser = (i: number, id: string) => {
    const person = accounts.find((a) => String(a.id) === id);
    updateEndorser(i, { user: person?.id ?? null, name: person?.full_name ?? "", designation: person?.position || roleName(endorsers[i].role_code) });
  };
  const isContinuing = form.is_continuing === "true";
  const uploadsPending = [...approvalDoc, ...supportingDocs].some((f) => f.status !== "done");
  const stepMissing = (i: number): string[] => {
    const missing: Record<number, string[]> = {
      0: form.project_code.trim() ? [] : ["Project Code"],
      1: form.campus ? [] : ["Campus"],
      2: form.sectors.length === 0 ? ["Sector"] : form.sectors.includes("others") && !form.sector_other.trim() ? ["Sector (Others)"] : [],
      3: filledObjectives.length ? [] : ["III. Objectives of the Study"],
      4: beneficiaryRows.every((b) => b.group.trim() && b.description.trim() && b.total.trim()) ? [] : ["every Target Beneficiaries row"],
      6: [...(form.ntp_number.trim() ? [] : ["Approval Reference Number (NTP No.)"]), ...(uploadsPending ? ["the document uploads"] : [])],
    };
    return missing[i] ?? [];
  };
  const checks: { label: string; done: boolean; required?: boolean; step: number }[] = [
    { label: "Project title entered", done: !!form.title.trim(), required: true, step: 0 },
    { label: "Project code (LSPU Faculty Research Number) entered", done: !!form.project_code.trim(), required: true, step: 0 },
    { label: "Funding type selected", done: !!form.funding_type, required: true, step: 0 },
    ...(isContinuing ? [{ label: "Continuing year (2 or later) entered", done: Number(form.continuing_year) >= 2, required: true, step: 0 }] : []),
    { label: "Start and end dates provided", done: !!form.start_date && !!form.target_end_date, step: 0 },
    { label: "Project Leader identified", done: !!form.lead, required: true, step: 1 },
    { label: "Campus selected", done: !!form.campus, required: true, step: 1 },
    { label: "College and implementing unit specified", done: !!form.college.trim() && !!form.implementing_unit.trim(), step: 1 },
    { label: "At least 1 sector selected", done: form.sectors.length > 0 && (!form.sectors.includes("others") || !!form.sector_other.trim()), required: true, step: 2 },
    { label: "At least 1 SDG selected", done: form.sdgs.length > 0, required: true, step: 2 },
    { label: "Background of the study written", done: !!form.background.trim(), step: 3 },
    { label: "At least 1 objective defined", done: filledObjectives.length > 0, required: true, step: 3 },
    { label: "Methodology written", done: !!form.methodology.trim(), step: 3 },
    { label: "Every target beneficiary row complete", done: stepMissing(4).length === 0, required: true, step: 4 },
    { label: "LIB line items entered", done: filledLib.length > 0, step: 5 },
    { label: "Approval reference number provided", done: !!form.ntp_number.trim(), required: true, step: 6 },
    { label: "Approval document attached", done: approvalDoc.length > 0, step: 6 },
    { label: "All document uploads finished", done: !uploadsPending, required: true, step: 6 },
    { label: "Registration certification checked", done: certified, required: true, step: 7 },
  ];
  const canReach = (i: number) => i <= step || Array.from({ length: i }, (_, j) => j).every((j) => stepMissing(j).length === 0);
  const showErrors = attempted || triedSteps.includes(step);
  const completed = checks.filter((c) => c.done).length;
  const missingRequired = checks.filter((c) => c.required && !c.done);
  const completenessOk = completed === checks.length;
  const bad = (k: keyof typeof form) => showErrors && (Array.isArray(form[k]) ? form[k].length === 0 : !String(form[k]).trim());

  const handleNext = async () => {
    if (step === 6 && uploadsPending) {
      notify.error("Wait for the document uploads to finish, or retry/remove the failed ones.");
      return;
    }
    const missing = stepMissing(step);
    if (missing.length) {
      setTriedSteps((t) => (t.includes(step) ? t : [...t, step]));
      notify.error(`Fill in ${missing.join(", ")} before going to the next step.`);
      return;
    }
    if (step === 0) {
      setIsCheckingCode(true);
      try {
        if (!(await researchApi.isProjectCodeAvailable(form.project_code.trim()))) {
          notify.error(`Project code ${form.project_code.trim()} already exists. Use a different code.`);
          return;
        }
      } catch {
        // The backend still rejects a duplicate on Register, so a failed check doesn't block the wizard.
      } finally {
        setIsCheckingCode(false);
      }
    }
    setStep(step + 1);
  };

  const previewData = (): ProposalData => {
    const lead = isProjectLeader ? { full_name: selfName, email: user?.email ?? "" } : projectLeaders.find((u) => String(u.id) === form.lead);
    const named = filledTeam.map((t) => ({ name: t.name.trim(), gender: t.gender, role: t.member_role }));
    return {
      ...form,
      lead_name: lead?.full_name || lead?.email || "",
      lead_email: lead?.email,
      co_leaders: named.filter((t) => t.role === "co_leader"),
      team: named.filter((t) => t.role !== "co_leader"),
      is_continuing: isContinuing,
      is_dry_research: form.is_dry_research === "true",
      study_titles: filledStudies,
      sdgs: form.sdgs.map(Number),
      objectives: filledObjectives,
      outputs: filledOutputs.map((o) => ({ category: o.category, description: o.description.trim(), target_count: o.target_count || 1 })),
      beneficiaries: filledBeneficiaries,
      budget: filledLib.map((r) => ({ category: r.category, description: r.description, q1: Number(r.q1) || 0, q2: Number(r.q2) || 0, q3: Number(r.q3) || 0, q4: Number(r.q4) || 0 })),
      work_plan: filledWorkPlan.map((w) => ({ title: w.title.trim(), start_date: w.start_date || null, target_date: w.target_date })),
      endorsers: filledEndorsers.map((e) => ({ name: e.name, designation: e.designation, signed_on: e.signed_on || null })),
    };
  };

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
        program: null,
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
      });
      const results = await Promise.allSettled([
        ...filledTeam.map((t) =>
          researchApi.createTeamMember({ project: project.id, member_role: t.member_role, name: t.name.trim(), gender: t.gender || undefined, user: t.user }),
        ),
        ...filledStudies.map((title) => researchApi.createStudy({ project: project.id, title })),
        ...(filledLib.length
          ? [
              researchApi.createProjectLib(
                project.id,
                filledLib.map((r) => ({
                  category: r.category,
                  description: r.description.trim(),
                  fiscal_year: Number(libYear) || null,
                  q1_amount: r.q1 || null,
                  q2_amount: r.q2 || null,
                  q3_amount: r.q3 || null,
                  q4_amount: r.q4 || null,
                })),
              ),
            ]
          : []),
        filledEndorsers.reduce(
          (chain, e) =>
            chain.then(() =>
              researchApi.createEndorser({
                project: project.id,
                role_code: e.role_code,
                user: e.user,
                name: e.name.trim(),
                designation: e.designation.trim(),
                signed_on: e.signed_on || null,
              }),
            ),
          Promise.resolve() as Promise<unknown>,
        ),
        ...filledBeneficiaries.map((b) =>
          researchApi.createBeneficiary({ project: project.id, group: b.group.trim(), description: b.description.trim(), total: Number(b.total) || 0 }),
        ),
        ...filledOutputs.map((o) =>
          outputsApi.createExpectedOutput({ project: project.id, category: o.category as SixPCategory, description: o.description.trim(), target_count: Number(o.target_count) || 1 }),
        ),
        ...filledWorkPlan.map((w) =>
          researchApi.createMilestone({ project: project.id, title: w.title.trim(), start_date: w.start_date || undefined, target_date: w.target_date }),
        ),
        ...[...approvalDoc, ...supportingDocs].map((f) =>
          documentApi.registerStagedDocument({ project: project.id, document_type: "other", stage: "inception", staged_token: f.token! }),
        ),
      ]);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) notify.error(`Project registered, but ${failed} team/study/LIB/endorser/beneficiary/6P/work plan/document row(s) failed to save. Add them from the project page.`);
      else notify.success("Project registered.");
      navigate(`/projects/${project.id}`);
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      if (data?.project_code) {
        notify.error(`Project code ${form.project_code.trim()} already exists. Use a different code.`);
        setStep(0);
      } else {
        notify.error(errorMessage(err, "Could not register the project."));
      }
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

      <div className="w-full rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ background: "white", border: "1px solid #e2e8f0" }}>
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
                    <button
                      onClick={() => (canReach(i) ? setStep(i) : notify.error("Finish the required fields of the earlier steps first."))}
                      className="flex flex-col items-center gap-0.5"
                    >
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
                      <AutoTextarea className={inputCls} style={inputSt} value={form.title} onChange={set("title")} placeholder="Full official title of the research project" />
                    </Field>
                    <Field label="Project Code (LSPU Faculty Research Number)" required invalid={bad("project_code")}>
                      <input className={inputCls} style={inputSt} value={form.project_code} onChange={set("project_code")} placeholder="e.g. FRN-2026-001" />
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
                      <MoneyInput className={inputCls} style={inputSt} value={form.total_cost} onChange={(v) => setForm((p) => ({ ...p, total_cost: v }))} />
                    </Field>
                    <Field label="REI Thrust">
                      <input className={inputCls} style={inputSt} value={form.rei_thrust} onChange={set("rei_thrust")} placeholder="e.g. Sustainable Agriculture" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <StepNote>
                    Project Leader, Co-Project Leader, and Project Team as listed on the form, plus the implementing campus and college. Pick a registered account for each member, or type a name for people or groups without an account.
                    {isProjectLeader && " You are registering this project as its Project Leader."}
                  </StepNote>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Project Leader" required invalid={bad("lead")} span>
                      <select className={inputCls + " disabled:opacity-80"} style={inputSt} value={form.lead} onChange={set("lead")} disabled={isProjectLeader}>
                        <option value="">
                          {projectLeaders.length || isProjectLeader
                            ? "Select project leader..."
                            : leadersBlocked
                              ? "Leader list isn't available for your role, use Upload via Excel"
                              : "No active project leaders yet"}
                        </option>
                        {(isProjectLeader && user ? [{ id: user.pk, email: user.email, full_name: selfName }] : projectLeaders).map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name && u.full_name !== u.email ? `${u.full_name} (${u.email})` : u.email}</option>
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
                      <AddRowButton onClick={() => setTeam([...team, { member_role: team.length ? "member" : "co_leader", name: "", gender: "", user: null }])}>Add Member</AddRowButton>
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
                              <UserPicker
                                className="flex-1"
                                users={accounts.filter((a) => String(a.id) !== form.lead)}
                                value={{ user: t.user, name: t.name }}
                                onChange={(picked) => update(picked)}
                                placeholder="Search an account, or type a name/group (e.g. EIU Coordinators)"
                              />
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
                    <label className="label-field">
                      Campus<span style={{ color: "#dc2626" }}> *</span>
                    </label>
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
                    {showErrors && !form.campus && <p className="mt-1 text-xs font-semibold" style={{ color: "#dc2626" }}>Required</p>}
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
                  <StepNote>
                    Sector, research priority area, typology, the 17 Sustainable Development Goals, and the study component titles. Sector and SDGs allow
                    more than one. A project is composed of two or more studies.
                  </StepNote>
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
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-field mb-0">Study Component Titles</label>
                      <AddRowButton onClick={() => setStudyTitles([...studyTitles, ""])}>Add Study</AddRowButton>
                    </div>
                    <div className="space-y-2">
                      {studyTitles.map((title, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="mt-2.5 text-xs font-bold shrink-0" style={{ color: "#0891b2", width: "52px" }}>Study {i + 1}</span>
                          <AutoTextarea
                            value={title}
                            onChange={(e) => setStudyTitles(studyTitles.map((t, idx) => (idx === i ? e.target.value : t)))}
                            className={inputCls + " flex-1"}
                            style={inputSt}
                            placeholder={`Title of Study ${i + 1}`}
                          />
                          {studyTitles.length > 1 && <RemoveButton onClick={() => setStudyTitles(studyTitles.filter((_, idx) => idx !== i))} label="Remove study" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <StepNote>Sections II–IV, VI, VIII, and IX of the form. Section V (6Ps), VII (beneficiaries) and XI (work plan) are on the next step; Section X (budget) has its own step.</StepNote>
                  <Field label="II. Background of the Study">
                    <AutoTextarea minRows={6} className={inputCls} style={inputSt} value={form.background} onChange={set("background")} placeholder="Background and rationale as stated in the approved proposal" />
                  </Field>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="label-field mb-0">
                        III. Objectives of the Study<span style={{ color: "#dc2626" }}> *</span>
                      </label>
                      <AddRowButton onClick={() => setObjectives([...objectives, ""])}>Add Objective</AddRowButton>
                    </div>
                    {showErrors && filledObjectives.length === 0 && <p className="mb-2 text-xs font-semibold" style={{ color: "#dc2626" }}>Add at least one objective</p>}
                    <div className="space-y-2">
                      {objectives.map((obj, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="mt-2.5 text-sm font-bold shrink-0" style={{ color: "#0891b2", width: "20px" }}>{i + 1}.</span>
                          <AutoTextarea
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
                    <AutoTextarea minRows={5} className={inputCls} style={inputSt} value={form.methodology} onChange={set("methodology")} />
                  </Field>
                  <Field label="VI. Socio-Economic Significance">
                    <AutoTextarea minRows={4} className={inputCls} style={inputSt} value={form.socio_economic_significance} onChange={set("socio_economic_significance")} />
                  </Field>
                  <Field label="VIII. Monitoring / Evaluation">
                    <AutoTextarea minRows={4} className={inputCls} style={inputSt} value={form.monitoring_evaluation} onChange={set("monitoring_evaluation")} />
                  </Field>
                  <Field label="IX. List of References (APA format)">
                    <AutoTextarea minRows={4} className={inputCls} style={inputSt} value={form.references} onChange={set("references")} />
                  </Field>
                  <Field label="Executive Summary (optional)">
                    <AutoTextarea minRows={3} className={inputCls} style={inputSt} value={form.description} onChange={set("description")} placeholder="Short overview shown on the project page" />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Anticipated Outcomes (optional)">
                      <AutoTextarea minRows={3} className={inputCls} style={inputSt} value={form.expected_outcomes} onChange={set("expected_outcomes")} placeholder="One per line" />
                    </Field>
                    <Field label="Long-term Potential Impacts (optional)">
                      <AutoTextarea minRows={3} className={inputCls} style={inputSt} value={form.expected_impacts} onChange={set("expected_impacts")} placeholder="One per line" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <StepNote>Section V (6Ps expected outputs) and XI (work plan) are optional here and can be added later. Section VII needs one row per beneficiary group with its total.</StepNote>
                  <div className="flex items-center justify-between">
                    <label className="label-field mb-0">V. Quantifiable Expected Outputs (6Ps)</label>
                    <AddRowButton onClick={() => setOutputRows([...outputRows, { category: "", description: "", target_count: "1" }])}>Add Output</AddRowButton>
                  </div>
                  {outputRows.length === 0 ? (
                    <p className="text-xs" style={{ color: "#94a3b8" }}>No 6Ps yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {outputRows.map((o, i) => {
                        const update = (patch: Partial<OutputRow>) => setOutputRows(outputRows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
                        return (
                          <div key={i} className="flex gap-2 items-start">
                            <select className={inputCls + " max-w-52"} style={inputSt} value={o.category} onChange={(e) => update({ category: e.target.value as SixPCategory })}>
                              <option value="">Item…</option>
                              {SIX_P_FORM.map(([code, label]) => (
                                <option key={code} value={code}>{label}</option>
                              ))}
                            </select>
                            <textarea rows={2} className={inputCls + " flex-1 resize-y"} style={inputSt} value={o.description} onChange={(e) => update({ description: e.target.value })} placeholder="Particulars" />
                            <input type="number" min="1" className={inputCls + " max-w-24"} style={inputSt} value={o.target_count} onChange={(e) => update({ target_count: e.target.value })} placeholder="Qty" aria-label="Quantity" />
                            <RemoveButton onClick={() => setOutputRows(outputRows.filter((_, idx) => idx !== i))} label="Remove output" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="label-field mb-0">
                      VII. Target Beneficiaries<span style={{ color: "#dc2626" }}> *</span>
                    </label>
                    <AddRowButton onClick={() => setBeneficiaryRows([...beneficiaryRows, { group: "", description: "", total: "" }])}>Add Group</AddRowButton>
                  </div>
                  <div className="space-y-2">
                    {beneficiaryRows.map((b, i) => {
                      const rowSt = (v: string) => ({ ...inputSt, borderColor: showErrors && !v.trim() ? "#dc2626" : inputSt.borderColor });
                      const update = (patch: Partial<BeneficiaryRow>) =>
                        setBeneficiaryRows(beneficiaryRows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
                      return (
                        <div key={i} className="flex gap-2 items-start">
                          <input className={inputCls + " max-w-56"} style={rowSt(b.group)} value={b.group} onChange={(e) => update({ group: e.target.value })} placeholder="Group, e.g. Faculty" />
                          <input className={inputCls + " flex-1"} style={rowSt(b.description)} value={b.description} onChange={(e) => update({ description: e.target.value })} placeholder="Description" />
                          <input type="number" min="0" className={inputCls + " max-w-24"} style={rowSt(b.total)} value={b.total} onChange={(e) => update({ total: e.target.value })} placeholder="Total" />
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
                  <div className="flex items-center justify-between pt-2">
                    <label className="label-field mb-0">XI. Work Plan (activities / milestones)</label>
                    <AddRowButton onClick={() => setWorkPlanRows([...workPlanRows, { title: "", start_date: "", target_date: "" }])}>Add Activity</AddRowButton>
                  </div>
                  {workPlanRows.length === 0 ? (
                    <p className="text-xs" style={{ color: "#94a3b8" }}>No activities yet. They can also be added later under Work Plan.</p>
                  ) : (
                    <div className="space-y-2">
                      {workPlanRows.map((w, i) => {
                        const update = (patch: Partial<WorkPlanRow>) => setWorkPlanRows(workPlanRows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
                        return (
                          <div key={i} className="flex flex-wrap md:flex-nowrap gap-2 items-start">
                            <input className={inputCls + " md:flex-1 min-w-48"} style={inputSt} value={w.title} onChange={(e) => update({ title: e.target.value })} placeholder="Activity, e.g. Logistic preparations" />
                            <input type="date" className={inputCls + " max-w-40"} style={inputSt} value={w.start_date} onChange={(e) => update({ start_date: e.target.value })} aria-label="Start date" />
                            <input type="date" className={inputCls + " max-w-40"} style={inputSt} value={w.target_date} onChange={(e) => update({ target_date: e.target.value })} aria-label="Target date" />
                            <RemoveButton onClick={() => setWorkPlanRows(workPlanRows.filter((_, idx) => idx !== i))} label="Remove activity" />
                          </div>
                        );
                      })}
                      {workPlanRows.some((w) => w.title.trim() && !w.target_date) && (
                        <p className="text-xs" style={{ color: "#b45309" }}>Activities without a target date are not saved.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <StepNote>
                    Section X, Budget Requirements: the approved Line-Item Budget per quarter. It is saved as the project's draft LIB (version 1) for the
                    Budget Officer to certify under Budget Management. Optional here; leave it empty to encode the LIB later.
                  </StepNote>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Fiscal Year">
                      <input type="number" min="2000" className={inputCls} style={inputSt} value={libYear} onChange={(e) => setLibYear(e.target.value)} />
                    </Field>
                  </div>
                  {LIB_CATEGORIES.map((cat) => {
                    const rows = libRows.map((r, i) => ({ r, i })).filter(({ r }) => r.category === cat.key);
                    const subtotal = rows.reduce((sum, { r }) => sum + libRowTotal(r), 0);
                    return (
                      <div key={cat.key} className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                        <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#f8fafc" }}>
                          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0d2a5e" }}>{cat.label}</p>
                          <AddRowButton onClick={() => setLibRows([...libRows, { category: cat.key, description: "", q1: "", q2: "", q3: "", q4: "" }])}>Add Item</AddRowButton>
                        </div>
                        {rows.length === 0 ? (
                          <p className="px-3 py-2 text-xs" style={{ color: "#94a3b8" }}>No items.</p>
                        ) : (
                          <div className="p-2 space-y-2">
                            {rows.map(({ r, i }) => (
                              <div key={i} className="flex flex-wrap md:flex-nowrap gap-2 items-start">
                                <input className={inputCls + " md:flex-1 min-w-48"} style={inputSt} value={r.description} onChange={(e) => updateLib(i, { description: e.target.value })} placeholder="Particulars, e.g. Travel Expenses" />
                                {QUARTERS.map((q, qi) => (
                                  <MoneyInput
                                    key={q}
                                    className={inputCls + " max-w-28"}
                                    style={inputSt}
                                    value={r[q]}
                                    onChange={(v) => updateLib(i, { [q]: v })}
                                    placeholder={`QTR${qi + 1}`}
                                    aria-label={`QTR${qi + 1}`}
                                  />
                                ))}
                                <span className="mt-2.5 text-xs font-mono font-bold w-24 text-right shrink-0" style={{ color: "#0d2a5e" }}>₱{peso(libRowTotal(r))}</span>
                                <RemoveButton onClick={() => setLibRows(libRows.filter((_, idx) => idx !== i))} label="Remove item" />
                              </div>
                            ))}
                            <p className="text-xs font-semibold text-right pr-8" style={{ color: "#64748b" }}>Subtotal: ₱{peso(subtotal)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#991b1b" }}>Grand Total</p>
                    <p className="text-sm font-mono font-black" style={{ color: "#991b1b" }}>₱{peso(libRows.reduce((sum, r) => sum + libRowTotal(r), 0))}</p>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <StepNote>
                    Approval references and the Annex A endorsement page. Review, endorsement, and approval happen outside RMIS; these are recorded as read-only references.
                  </StepNote>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Approval Reference Number (NTP No.)" required invalid={bad("ntp_number")}>
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
                    <Field label="Date Approved (University President)">
                      <input type="date" className={inputCls} style={inputSt} value={form.proposal_approved_on} onChange={set("proposal_approved_on")} />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Annex A · Endorsement Page</p>
                    <AddRowButton onClick={() => setEndorsers([...endorsers, { role_code: "", user: null, name: "", designation: "", signed_on: "" }])}>Add Endorser</AddRowButton>
                  </div>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    Pick the endorser's role, then the person. With one account in that role the name fills in by itself. Signatories without an
                    account (e.g. the Dean) use "Not a system role" and a typed name.
                  </p>
                  {endorsers.length === 0 && <p className="text-xs" style={{ color: "#94a3b8" }}>No endorsers added.</p>}
                  <div className="space-y-2">
                    {endorsers.map((e, i) => {
                      const people = e.role_code ? peopleWithRole(e.role_code) : [];
                      return (
                        <div key={i} className="rounded-xl p-3 grid grid-cols-1 md:grid-cols-2 gap-2 relative" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <select className={inputCls} style={inputSt} value={e.role_code} onChange={(ev) => pickEndorserRole(i, ev.target.value)}>
                            <option value="">Not a system role (type the name)</option>
                            {roles.map((r) => (
                              <option key={r.code} value={r.code}>{r.name}</option>
                            ))}
                          </select>
                          {people.length > 1 ? (
                            <select className={inputCls} style={inputSt} value={e.user ?? ""} onChange={(ev) => pickEndorserUser(i, ev.target.value)}>
                              <option value="">Select who signed ({people.length} with this role)...</option>
                              {people.map((u) => (
                                <option key={u.id} value={u.id}>{u.full_name}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className={inputCls}
                              style={inputSt}
                              value={e.name}
                              readOnly={!!e.user}
                              onChange={(ev) => updateEndorser(i, { name: ev.target.value })}
                              placeholder={e.role_code ? "No account with this role yet, type the name" : "Full name, e.g. Adriel G. Roman"}
                            />
                          )}
                          <input className={inputCls} style={inputSt} value={e.designation} onChange={(ev) => updateEndorser(i, { designation: ev.target.value })} placeholder="Designation, e.g. Dean/Associate Dean" />
                          <div className="flex gap-2 items-start">
                            <input type="date" className={inputCls} style={inputSt} value={e.signed_on} onChange={(ev) => updateEndorser(i, { signed_on: ev.target.value })} aria-label="Date signed" />
                            <RemoveButton onClick={() => setEndorsers(endorsers.filter((_, idx) => idx !== i))} label="Remove endorser" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Approval Document (Notice of Approval / NTP / MOA)" span>
                      <FilePick label="Click to upload the approval document" files={approvalDoc} onChange={setApprovalDoc} />
                    </Field>
                    <Field label="Supporting Documents (optional)" span>
                      <FilePick label="Click to upload supporting documents" files={supportingDocs} multiple onChange={setSupportingDocs} />
                    </Field>
                  </div>
                </div>
              )}

              {step === 7 && (
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
                    <InfoCard label="Documents Uploaded" value={String(approvalDoc.length + supportingDocs.length)} />
                    <InfoCard label="Registration Date" value={new Date().toLocaleDateString("en-PH")} />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors hover:bg-[#c7d8ef]"
                    style={{ background: "#e0eaf7", color: "#0d2a5e" }}
                  >
                    👁 View as Research Proposal Form (SF-018)
                  </button>

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
                <button
                  onClick={handleNext}
                  disabled={isCheckingCode || (step === 6 && uploadsPending)}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "#0891b2" }}
                >
                  {isCheckingCode ? "Checking code…" : step === 6 && uploadsPending ? "Waiting for uploads…" : "Next →"}
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
      {showPreview && <ProposalPreview data={previewData()} onClose={() => setShowPreview(false)} />}
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
