import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction, type TextareaHTMLAttributes } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { researchApi } from "../lib/researchApi";
import { outputsApi } from "../lib/outputsApi";
import type { SixPCategory } from "../types/outputs";
import { DOCUMENT_ACCEPT, documentApi } from "../lib/documentApi";
import { errorMessage } from "../lib/errorMessage";
import { LIB_UNITS, allocationPeriods, groupLibRows, libLineTotal, libUnitLabel, periodYear, allocatedTotal } from "../lib/libUnits";
import { notify } from "../lib/notify";
import { registrationOpen, workAllowed } from "../lib/projectReview";
import { clearDraft, loadDraft, saveDraft } from "../lib/formDraft";
import type { AdminChoice, AdminChoiceKind, FundingType, Project, ProjectImportError, WorkPlanImportRow } from "../types/research";
import { budgetApi } from "../lib/budgetApi";
import { NoActualData } from "../components/common/NoActualData";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { MultiSelect } from "../components/common/MultiSelect";
import { UserPicker } from "../components/common/UserPicker";
import { needsTeamConfirm, takenUserIds, teamMissing, type TeamRow } from "../lib/teamRows";
import { ProtoModal } from "../components/common/proto";
import { MoneyInput } from "../components/common/MoneyInput";
import type { AdminUser } from "../types/auth";
import { LibItemSelect } from "../components/common/LibItemSelect";
import { RdeAgendaPicker } from "../components/registration/RdeAgendaPicker";
import { ProposalPreview, type ProposalData } from "../components/registration/ProposalPreview";
import { LibAllocationGrid } from "../components/registration/LibAllocationGrid";
import { RichTextEditor } from "../components/common/RichTextEditor";
import { registrationDraft, type RegistrationPayload } from "../lib/registrationDraft";
import { useAuth } from "../context/AuthContext";
import { useFundingTypes } from "../lib/fundingTypes";
import {
  DRY_RESEARCH_OPTIONS,
  PRIORITY_AREA_LABELS,
  RESEARCH_TYPE_LABELS,
  SDG_OPTIONS,
  SECTOR_OPTIONS,
  TYPOLOGY_OPTIONS,
  dryResearchValue,
} from "../lib/projectOptions";


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

// Add Member lists the registered accounts that fit the row (client 2026-10-09); a typed name still works for people or groups without one
const TEAM_ROLE_CODES: Record<string, string[]> = {
  co_leader: ["project_leader"],
  member: ["project_staff"],
};

const MODES = [
  ["manual", "✍️ Manual Entry"],
  ["excel", "📊 Upload via Excel"],
] as const;

// `id` is set on rows loaded from a registered project (Edit Registered Project)
type BeneficiaryRow = { id?: number; group: string; description: string; total: string };
type OutputRow = { id?: number; category: SixPCategory | ""; description: string; target_count: string };
type WorkPlanRow = { id?: number; title: string; start_date: string; target_date: string; tasks?: number };
// Section V uses the form's own 6P wording
const SIX_P_FORM: [SixPCategory, string][] = [
  ["publications", "Publications"],
  ["patents", "Patent"],
  ["products", "Products"],
  ["people_services", "People Services"],
  ["places_partnerships", "Places/Partnerships"],
  ["policies", "Policy Recommendations"],
];
// `allocations` = period (Y1Q1..YnQ4 or Q1..Q4) -> amount; drafts saved before 2026-10-16 don't have it
type LibRow = { category: LibCategory; description: string; unit: string; quantity: string; unit_cost: string; allocations?: Record<string, string> };
type LibCategory = "ps" | "mooe" | "co";

const LIB_CATEGORIES: { key: LibCategory; label: string }[] = [
  { key: "ps", label: "Personal Services (PS)" },
  { key: "mooe", label: "Maintenance and Other Operating Expenses (MOOE)" },
  { key: "co", label: "Equipment Outlay / Capital Outlay (CO)" },
];
// Client feedback 2026-10-06: LIB rows are Unit / Qty / Unit Cost instead of per quarter; Total = Qty x Unit Cost.
const libRowTotal = (r: LibRow) => libLineTotal(r.quantity, r.unit_cost);
const peso = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type EndorserRow = { id?: number; role_code: string; user: number | null; name: string; designation: string; signed_on: string };

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

/** Dropdown of System Admin-managed choices (Admin > College Units). */
function ChoiceSelect({ choices, value, onChange, placeholder }: { choices: AdminChoice[]; value: string; onChange: (e: { target: { value: string } }) => void; placeholder: string }) {
  return (
    <select className={inputCls} style={inputSt} value={value} onChange={onChange}>
      <option value="">{choices.length ? placeholder : "No choices yet, ask the System Admin to add them"}</option>
      {choices.map((c) => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
    </select>
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

// Client 2026-10-24: Step 7's three required attachments, each saved as its own document type
type ApprovalDocType = "notice_of_approval" | "ntp" | "moa";
const APPROVAL_DOCS: { type: ApprovalDocType; label: string }[] = [
  { type: "notice_of_approval", label: "Notice of Approval" },
  { type: "ntp", label: "Notice to Proceed (NTP)" },
  { type: "moa", label: "Memorandum of Agreement (MOA)" },
];

// Client 2026-10-24 (register_error.png): name each registration part that failed and why, e.g. "LIB (reason)",
// "2× Work plan activity (reason)". A request that never got an answer shows the browser's error (e.g. Network Error).
function failedParts(labels: string[], results: PromiseSettledResult<unknown>[]): string[] {
  const counts = new Map<string, number>();
  results.forEach((r, i) => {
    if (r.status === "fulfilled") return;
    const key = `${labels[i]} (${errorMessage(r.reason, (r.reason as Error)?.message || "no answer from the server")})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts].map(([key, n]) => (n > 1 ? `${n}× ${key}` : key));
}

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

function ImportErrorTable({ errors, outcome }: { errors: ProjectImportError[]; outcome: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #fecaca" }}>
      <div className="px-4 py-2.5" style={{ background: "#fef2f2" }}>
        <p className="text-xs font-bold" style={{ color: "#b91c1c" }}>
          {errors.length} issue{errors.length !== 1 ? "s" : ""} found · {outcome}
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
  );
}

// Client 2026-10-23: fill XI. Work Plan from the template's Work Plan sheet instead of encoding each activity
function WorkPlanExcelButton({ onRows, onErrors }: { onRows: (rows: WorkPlanImportRow[]) => void; onErrors: (errors: ProjectImportError[]) => void }) {
  const [isReading, setIsReading] = useState(false);
  const read = async (file: File) => {
    setIsReading(true);
    onErrors([]);
    try {
      onRows(await researchApi.parseWorkPlan(file));
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: ProjectImportError[] } } })?.response?.data;
      if (data?.errors?.length) {
        onErrors(data.errors);
        notify.error("No activities were added. Fix the rows listed below and import again.");
      } else {
        notify.error(errorMessage(err, "Could not read the workbook."));
      }
    } finally {
      setIsReading(false);
    }
  };
  return (
    <label className="text-xs font-semibold flex items-center gap-1 cursor-pointer" style={{ color: "#0891b2", opacity: isReading ? 0.6 : 1 }}>
      📊 {isReading ? "Reading…" : "Import from Excel"}
      <input
        type="file"
        className="hidden"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={isReading}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) read(picked);
        }}
      />
    </label>
  );
}

function ExcelImport({ onReview }: { onReview: (excel: ExcelDraft) => void }) {
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
      setPreview((await researchApi.previewImport(file)).preview);
    } catch (err) {
      showImportErrors(err, "Could not read the workbook.");
    } finally {
      setIsPreviewing(false);
    }
  };

  // Nothing is registered: the dry run rolls back, and Manual Entry's Register saves it after the review.
  const handleReview = async () => {
    if (!file) return;
    setIsPreviewing(true);
    setErrors([]);
    try {
      const { draft } = await researchApi.previewImport(file);
      onReview({ draft: toRegisterDraft(draft, false), fileName: file.name });
    } catch (err) {
      showImportErrors(err, "Could not read the workbook.");
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
      const formSaved = await documentApi.saveProposalForm(project.id).then(() => true, () => false);
      notify.success(`Project ${project.project_code} registered from Excel as a Draft. Attach its Notice of Approval, NTP and MOA in Edit Registration before submitting it.`);
      if (!formSaved) notify.error("The Research Proposal Form could not be saved to Document Management.");
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

      {errors.length > 0 && <ImportErrorTable errors={errors} outcome="nothing was saved" />}

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
            onClick={handleReview}
            disabled={isPreviewing || isUploading || !file}
            className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-[#c7d8ef] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#e0eaf7", color: "#0d2a5e" }}
            title="Open the workbook in Manual Entry to check and edit it, then Register"
          >
            ✏️ Review &amp; edit before registering
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

const DRAFT_VERSION = 1;

const blankForm = (lead: string) => ({
  title: "",
  project_code: "",
  funding_type: "",
  lead,
  lead_gender: "",
  contact_number: "",
  ntp_number: "",
  ntp_date: "",
  toe_signed_date: "",
  is_dry_research: "true",
  start_date: "",
  target_end_date: "",
  rde_thrust: "",
  rde_priority: "",
  sdgs: [] as string[],
  sectors: [] as string[],
  sector_other: "",
  is_continuing: "false",
  continuing_year: "",
  research_type: "",
  research_priority_area: "",
  research_typology: [] as string[],
  campus: "",
  implementing_unit: "",
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

type RegisterDraft = {
  form: ReturnType<typeof blankForm>;
  agencies: string[];
  objectives: string[];
  studyTitles: string[];
  team: TeamRow[];
  beneficiaryRows: BeneficiaryRow[];
  outputRows: OutputRow[];
  workPlanRows: WorkPlanRow[];
  libRows: LibRow[];
  libYear: string;
  endorsers: EndorserRow[];
  step: number;
};

const blankDraft = (lead: string): RegisterDraft => ({
  form: blankForm(lead),
  agencies: [],
  objectives: [""],
  studyTitles: ["", ""],
  team: [],
  beneficiaryRows: [{ group: "", description: "", total: "" }],
  outputRows: [],
  workPlanRows: [],
  libRows: [],
  libYear: String(new Date().getFullYear()),
  endorsers: [],
  step: 0,
});

/** Wizard state for a registration: a registered project (Edit Registration, with row ids) or a workbook loaded for review. */
const toRegisterDraft = (src: RegistrationPayload, keepIds: boolean): RegisterDraft => {
  const d = registrationDraft(src, keepIds);
  return {
    ...d,
    form: { ...blankForm(d.form.lead), ...d.form },
    libRows: d.libRows.map((r) => ({ ...r, category: r.category as LibCategory })),
    step: 0,
  };
};

/** An uploaded workbook opened in Manual Entry to check and edit before registering (client 2026-10-23). */
type ExcelDraft = { draft: RegisterDraft; fileName: string };

/** A registered project loaded into the wizard for Edit Registered Project (client request 2026-10-09). */
type EditSource = {
  project: Project;
  draft: RegisterDraft;
  studyIds: number[];
  originalIds: Record<"team" | "outputs" | "beneficiaries" | "workPlan" | "endorsers", number[]>;
  /** File names of the attachments already saved, so Step 7 counts them as attached */
  savedDocs: Partial<Record<ApprovalDocType, string>>;
};

function RegisterProjectContent({
  onStartOver,
  edit,
  fromExcel,
  onLoadExcel,
}: {
  onStartOver: () => void;
  edit?: EditSource;
  fromExcel?: ExcelDraft | null;
  onLoadExcel?: (excel: ExcelDraft) => void;
}) {
  const fundingTypes = useFundingTypes();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!edit;
  const isProjectLeader = user?.role?.code === "project_leader";
  const codeLocked = isEdit && user?.role?.code !== "system_admin";
  const selfName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.email || "";
  const draftKey = `rmis:draft:register-project:${user?.pk ?? "anon"}`;
  const [blank] = useState(() => blankDraft(isProjectLeader && user ? String(user.pk) : ""));
  const [restored] = useState(() => (edit || fromExcel ? null : loadDraft<RegisterDraft>(draftKey, DRAFT_VERSION)));
  const init: RegisterDraft = edit
    ? edit.draft
    : fromExcel
    ? { ...fromExcel.draft, form: { ...fromExcel.draft.form, ...(isProjectLeader ? { lead: blank.form.lead } : {}) } }
    : restored
    ? { ...blank, ...restored.data, form: { ...blank.form, ...restored.data.form, ...(isProjectLeader ? { lead: blank.form.lead } : {}) } }
    : blank;
  const [projectLeaders, setProjectLeaders] = useState<{ id: number; email: string; full_name?: string }[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [leadersBlocked, setLeadersBlocked] = useState(false);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [endorsers, setEndorsers] = useState<EndorserRow[]>(init.endorsers);
  const [libRows, setLibRows] = useState<LibRow[]>(init.libRows);
  const [libYear, setLibYear] = useState(init.libYear);
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [step, setStep] = useState(init.step);
  const [teamConfirmed, setTeamConfirmed] = useState(false);
  const [confirmTeamTo, setConfirmTeamTo] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [triedSteps, setTriedSteps] = useState<number[]>([]);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [certified, setCertified] = useState(false);
  const [objectives, setObjectives] = useState(init.objectives);
  const [studyTitles, setStudyTitles] = useState(init.studyTitles);
  const [team, setTeam] = useState<TeamRow[]>(init.team);
  const [beneficiaryRows, setBeneficiaryRows] = useState<BeneficiaryRow[]>(init.beneficiaryRows);
  const [outputRows, setOutputRows] = useState<OutputRow[]>(init.outputRows);
  const [workPlanRows, setWorkPlanRows] = useState<WorkPlanRow[]>(init.workPlanRows);
  const [workPlanErrors, setWorkPlanErrors] = useState<ProjectImportError[]>([]);
  const [supportingDocs, setSupportingDocs] = useState<StagedFile[]>([]);
  const [approvalDocs, setApprovalDocs] = useState<Record<ApprovalDocType, StagedFile[]>>({ notice_of_approval: [], ntp: [], moa: [] });
  const setApprovalDoc = (type: ApprovalDocType): Dispatch<SetStateAction<StagedFile[]>> => (next) =>
    setApprovalDocs((docs) => ({ ...docs, [type]: typeof next === "function" ? next(docs[type]) : next }));
  const approvalAttached = (type: ApprovalDocType) => approvalDocs[type].some((f) => f.status === "done") || !!edit?.savedDocs[type];
  const missingApprovalDocs = APPROVAL_DOCS.filter((d) => !approvalAttached(d.type)).map((d) => d.label);
  const stagedDocs: { file: StagedFile; type: ApprovalDocType | "other" }[] = [
    ...APPROVAL_DOCS.flatMap((d) => approvalDocs[d.type].map((file) => ({ file, type: d.type }))),
    ...supportingDocs.map((file) => ({ file, type: "other" as const })),
  ];

  const [form, setForm] = useState(init.form);
  const [choices, setChoices] = useState<Record<AdminChoiceKind, AdminChoice[]>>({ "college-units": [], "rde-thrusts": [], "cooperating-agencies": [], endorsers: [], "funding-types": [] });
  const [agencies, setAgencies] = useState<string[]>(init.agencies);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setRich = (key: keyof typeof form) => (html: string) => setForm((p) => ({ ...p, [key]: html }));

  useEffect(() => {
    let active = true;
    (["college-units", "rde-thrusts", "cooperating-agencies", "endorsers"] as const).forEach((kind) =>
      researchApi
        .getChoices(kind)
        .then((list) => active && setChoices((c) => ({ ...c, [kind]: list })))
        .catch(() => undefined),
    );
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

  const submittedRef = useRef(false);
  const [savedAt, setSavedAt] = useState<string | null>(restored?.savedAt ?? null);
  const [blankJson] = useState(() => JSON.stringify(blank));
  const draftJson = JSON.stringify({ form, agencies, objectives, studyTitles, team, beneficiaryRows, outputRows, workPlanRows, libRows, libYear, endorsers, step } satisfies RegisterDraft);

  useEffect(() => {
    if (isEdit) return;
    const timer = setTimeout(() => {
      if (submittedRef.current) return;
      if (draftJson === blankJson) {
        clearDraft(draftKey);
        setSavedAt(null);
        return;
      }
      setSavedAt(saveDraft(draftKey, DRAFT_VERSION, JSON.parse(draftJson) as RegisterDraft));
    }, 400);
    return () => clearTimeout(timer);
  }, [draftJson, blankJson, draftKey, isEdit]);

  const discardDraft = () => {
    submittedRef.current = true;
    clearDraft(draftKey);
  };

  const startOver = async () => {
    if (!(await notify.confirm("Clear everything you've entered and start a new registration?", "Clear"))) return;
    discardDraft();
    onStartOver();
  };

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
  const updateEndorser = (i: number, patch: Partial<EndorserRow>) => setEndorsers((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const pickEndorser = (i: number, name: string) =>
    updateEndorser(i, { role_code: "", user: null, name, designation: choices.endorsers.find((c) => c.name === name)?.designation ?? "" });
  const reloadEndorserChoices = () =>
    researchApi
      .getChoices("endorsers")
      .then((list) => setChoices((c) => ({ ...c, endorsers: list })))
      .catch(() => notify.error("Could not load the endorser list."));
  const isContinuing = form.is_continuing === "true";
  const uploadsPending = stagedDocs.some((d) => d.file.status !== "done");
  const approvedBudget = Number(form.total_cost) || 0;
  const libGrandTotal = libRows.reduce((sum, r) => sum + libRowTotal(r), 0);
  const libDifference = Math.round((libGrandTotal - approvedBudget) * 100) / 100;
  const libMatchesBudget = isEdit || approvedBudget === 0 || libDifference === 0;
  // Client 2026-10-14/10-17: each item is split per quarter of each project year (yearly.png), adding up to its total
  const libPeriods = allocationPeriods(form.start_date, form.target_end_date);
  const libSplitsMatch = isEdit || !libPeriods || filledLib.every((r) => allocatedTotal(r.allocations, libPeriods) === libRowTotal(r));
  const stepMissing = (i: number): string[] => {
    const missing: Record<number, string[]> = {
      0: [
        ...(form.project_code.trim() ? [] : ["Project Code"]),
        ...(form.rde_thrust ? [] : ["RDE Thrust"]),
        ...(form.rde_priority ? [] : ["RDE Priority Area"]),
      ],
      1: [...teamMissing(form.lead, team), ...(form.campus ? [] : ["Campus"])],
      2: form.sectors.length === 0 ? ["Sector"] : form.sectors.includes("others") && !form.sector_other.trim() ? ["Sector (Others)"] : [],
      3: filledObjectives.length ? [] : ["III. Objectives of the Study"],
      4: beneficiaryRows.every((b) => b.group.trim() && b.description.trim() && b.total.trim()) ? [] : ["every Target Beneficiaries row"],
      5: [
        ...(libMatchesBudget ? [] : [`a Grand Total equal to the approved budget (₱${peso(approvedBudget)})`]),
        ...(libSplitsMatch ? [] : ["a quarterly allocation that adds up to every item's total"]),
      ],
      6: [
        ...(form.ntp_number.trim() ? [] : ["Approval Reference Number (NTP No.)"]),
        ...missingApprovalDocs,
        ...(uploadsPending ? ["the document uploads"] : []),
      ],
    };
    return missing[i] ?? [];
  };
  const checks: { label: string; done: boolean; required?: boolean; step: number }[] = [
    { label: "Project title entered", done: !!form.title.trim(), required: true, step: 0 },
    { label: "Project code (LSPU Faculty Research Number) entered", done: !!form.project_code.trim(), required: true, step: 0 },
    { label: "Funding type selected", done: !!form.funding_type, required: true, step: 0 },
    { label: "2024–2028 LSPU RDE Agenda thrust & priority selected", done: !!form.rde_thrust && !!form.rde_priority, required: true, step: 0 },
    ...(isContinuing ? [{ label: "Continuing year (2 or later) entered", done: Number(form.continuing_year) >= 2, required: true, step: 0 }] : []),
    { label: "Start and end dates provided", done: !!form.start_date && !!form.target_end_date, step: 0 },
    { label: "Project Leader identified", done: !!form.lead, required: true, step: 1 },
    { label: "Campus selected", done: !!form.campus, required: true, step: 1 },
    { label: "College Unit - Implementing Unit selected", done: !!form.implementing_unit, step: 1 },
    { label: "At least 1 sector selected", done: form.sectors.length > 0 && (!form.sectors.includes("others") || !!form.sector_other.trim()), required: true, step: 2 },
    { label: "At least 1 SDG selected", done: form.sdgs.length > 0, required: true, step: 2 },
    { label: "Background of the study written", done: !!form.background.trim(), step: 3 },
    { label: "At least 1 objective defined", done: filledObjectives.length > 0, required: true, step: 3 },
    { label: "Methodology written", done: !!form.methodology.trim(), step: 3 },
    { label: "Every target beneficiary row complete", done: stepMissing(4).length === 0, required: true, step: 4 },
    { label: "LIB line items entered", done: filledLib.length > 0, step: 5 },
    { label: "LIB Grand Total equals the approved budget", done: libMatchesBudget, required: true, step: 5 },
    ...(libPeriods ? [{ label: "Every LIB item's allocation adds up to its total", done: libSplitsMatch, required: true, step: 5 }] : []),
    { label: "Approval reference number provided", done: !!form.ntp_number.trim(), required: true, step: 6 },
    ...APPROVAL_DOCS.map((d) => ({ label: `${d.label} attached`, done: approvalAttached(d.type), required: true, step: 6 })),
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
      notify.error(
        step === 5 && !libMatchesBudget
          ? `Grand total must equal approved budget (₱${peso(approvedBudget)}). Difference: ₱${peso(libDifference)}.`
          : step === 1 && missing.some((m) => m.startsWith("the member of"))
            ? `Fill in ${missing.join(", ")}, or remove the empty team row with ✕, before going to the next step.`
            : `Fill in ${missing.join(", ")} before going to the next step.`,
      );
      return;
    }
    if (step === 0 && form.project_code.trim() !== edit?.project.project_code) {
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
    if (needsTeamConfirm(step, step + 1, teamConfirmed)) {
      setConfirmTeamTo(step + 1);
      return;
    }
    setStep(step + 1);
  };

  const goToStep = (i: number) => {
    if (!canReach(i)) {
      notify.error("Finish the required fields of the earlier steps first.");
      return;
    }
    if (needsTeamConfirm(step, i, teamConfirmed)) {
      setConfirmTeamTo(i);
      return;
    }
    setStep(i);
  };

  const previewData = (): ProposalData => {
    const lead = isProjectLeader ? { full_name: selfName, email: user?.email ?? "" } : projectLeaders.find((u) => String(u.id) === form.lead);
    const named = filledTeam.map((t) => ({ name: t.name.trim(), gender: t.gender, role: t.member_role }));
    return {
      ...form,
      college: form.implementing_unit,
      cooperating_agencies: agencies.join(", "),
      lead_name: lead?.full_name || lead?.email || "",
      lead_email: lead?.email,
      co_leaders: named.filter((t) => t.role === "co_leader"),
      team: named.filter((t) => t.role !== "co_leader"),
      is_continuing: isContinuing,
      is_dry_research: dryResearchValue(form.is_dry_research),
      study_titles: filledStudies,
      sdgs: form.sdgs.map(Number),
      objectives: filledObjectives,
      outputs: filledOutputs.map((o) => ({ category: o.category, description: o.description.trim(), target_count: o.target_count || 1 })),
      beneficiaries: filledBeneficiaries,
      budget: filledLib.map((r) => ({
        category: r.category,
        description: r.description,
        unit: libUnitLabel(r.unit),
        quantity: Number(r.quantity) || 0,
        unit_cost: Number(r.unit_cost) || 0,
        total: libRowTotal(r),
        allocations: libPeriods?.map((period) => ({ period, amount: Number(r.allocations?.[period]) || 0 })),
      })),
      allocation_periods: libPeriods ?? [],
      work_plan: filledWorkPlan.map((w) => ({ title: w.title.trim(), start_date: w.start_date || null, target_date: w.target_date })),
      endorsers: filledEndorsers.map((e) => ({ name: e.name, designation: e.designation, signed_on: e.signed_on || null })),
    };
  };

  const handleSave = async (source: EditSource) => {
    const id = source.project.id;
    const date = (v: string) => v || null;
    setIsCreating(true);
    try {
      await researchApi.updateProject(id, {
        title: form.title.trim(),
        ...(codeLocked ? {} : { project_code: form.project_code.trim() }),
        funding_type: form.funding_type as FundingType,
        ntp_number: form.ntp_number.trim(),
        ntp_date: date(form.ntp_date),
        toe_signed_date: date(form.toe_signed_date),
        is_dry_research: dryResearchValue(form.is_dry_research),
        start_date: date(form.start_date),
        target_end_date: date(form.target_end_date),
        rde_thrust: form.rde_thrust,
        rde_priority: form.rde_priority,
        sdgs: form.sdgs.map(Number),
        sectors: form.sectors as Project["sectors"],
        sector_other: form.sectors.includes("others") ? form.sector_other.trim() : "",
        is_continuing: isContinuing,
        continuing_year: isContinuing ? Number(form.continuing_year) : null,
        research_type: form.research_type as Project["research_type"],
        research_priority_area: form.research_priority_area as Project["research_priority_area"],
        research_typology: form.research_typology as Project["research_typology"],
        campus: form.campus,
        college: form.implementing_unit,
        implementing_unit: form.implementing_unit,
        cooperating_agencies: agencies.join(", "),
        lead_gender: form.lead_gender as Project["lead_gender"],
        contact_number: form.contact_number.trim(),
        background: form.background,
        objectives: filledObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n"),
        methodology: form.methodology,
        socio_economic_significance: form.socio_economic_significance,
        monitoring_evaluation: form.monitoring_evaluation,
        references: form.references,
        description: form.description,
        expected_outcomes: form.expected_outcomes,
        expected_impacts: form.expected_impacts,
        proposal_submitted_on: date(form.proposal_submitted_on),
        proposal_reviewed_on: date(form.proposal_reviewed_on),
        proposal_approved_on: date(form.proposal_approved_on),
        reviewing_body: form.reviewing_body,
      });
      const removed = (key: keyof EditSource["originalIds"], rows: { id?: number }[]) => source.originalIds[key].filter((oid) => !rows.some((r) => r.id === oid));
      type Part = [string, Promise<unknown>];
      const parts: Part[] = [
        ...removed("team", filledTeam).map((x): Part => ["Team member (remove)", researchApi.deleteTeamMember(x)]),
        ...filledTeam.map((t): Part => {
          const row = { member_role: t.member_role, name: t.name.trim(), gender: t.gender, user: t.user };
          return ["Team member", t.id ? researchApi.updateTeamMember(t.id, row) : researchApi.createTeamMember({ project: id, ...row })];
        }),
        // Registered studies can't be removed here (client 2026-10-09), so the first rows are always the saved ones
        ...studyTitles.map((title, i): Part => [
          "Study",
          i < source.studyIds.length
            ? title.trim()
              ? researchApi.updateStudy(source.studyIds[i], { title: title.trim() })
              : Promise.resolve()
            : title.trim()
              ? researchApi.createStudy({ project: id, title: title.trim() })
              : Promise.resolve(),
        ]),
        ...removed("outputs", filledOutputs).map((x): Part => ["6P expected output (remove)", outputsApi.deleteExpectedOutput(x)]),
        ...filledOutputs.map((o): Part => {
          const row = { category: o.category as SixPCategory, description: o.description.trim(), target_count: Number(o.target_count) || 1 };
          return ["6P expected output", o.id ? outputsApi.updateExpectedOutput(o.id, row) : outputsApi.createExpectedOutput({ project: id, ...row })];
        }),
        ...removed("beneficiaries", filledBeneficiaries).map((x): Part => ["Target beneficiary (remove)", researchApi.deleteBeneficiary(x)]),
        ...filledBeneficiaries.map((b): Part => {
          const row = { group: b.group.trim(), description: b.description.trim(), total: Number(b.total) || 0 };
          return ["Target beneficiary", b.id ? researchApi.updateBeneficiary(b.id, row) : researchApi.createBeneficiary({ project: id, ...row })];
        }),
        ...removed("workPlan", filledWorkPlan).map((x): Part => ["Work plan activity (remove)", researchApi.deleteMilestone(x)]),
        ...filledWorkPlan.map((w): Part => [
          "Work plan activity",
          w.id
            ? researchApi.updateMilestone(w.id, { title: w.title.trim(), start_date: w.start_date || null, target_date: w.target_date })
            : researchApi.createMilestone({ project: id, title: w.title.trim(), start_date: w.start_date || undefined, target_date: w.target_date }),
        ]),
        ...removed("endorsers", filledEndorsers).map((x): Part => ["Annex A endorser (remove)", researchApi.deleteEndorser(x)]),
        // Annex A is listed in id order, so new endorsers are added one after another
        [
          "Annex A endorsers",
          filledEndorsers.reduce(
            (chain, e) =>
              chain.then(() =>
                e.id
                  ? researchApi.updateEndorser(e.id, { name: e.name.trim(), designation: e.designation.trim(), signed_on: e.signed_on || null })
                  : researchApi.createEndorser({ project: id, role_code: e.role_code, user: e.user, name: e.name.trim(), designation: e.designation.trim(), signed_on: e.signed_on || null }),
              ),
            Promise.resolve() as Promise<unknown>,
          ),
        ],
        ...stagedDocs.map(({ file, type }): Part => [
          `Document ${file.file.name}`,
          documentApi.registerStagedDocument({ project: id, document_type: type, stage: "inception", staged_token: file.token! }),
        ]),
      ];
      const failed = failedParts(parts.map(([label]) => label), await Promise.allSettled(parts.map(([, promise]) => promise)));
      const formSaved = await documentApi.saveProposalForm(id).then(() => true, () => false);
      if (failed.length) notify.error(`Project saved, but these could not be saved: ${failed.join("; ")}.`);
      else notify.success("Changes saved. A new version of the Research Proposal Form is under Document Management.");
      if (!formSaved) notify.error("The Research Proposal Form could not be saved to Document Management.");
      navigate(`/projects/${id}`);
    } catch (err) {
      notify.error(errorMessage(err, "Could not save the changes."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = async () => {
    setAttempted(true);
    if (missingRequired.length) {
      notify.error(`Complete the required items first: ${missingRequired.map((c) => c.label.toLowerCase()).join("; ")}.`);
      setStep(missingRequired[0].step);
      return;
    }
    if (edit) return handleSave(edit);
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
        is_dry_research: dryResearchValue(form.is_dry_research),
        start_date: opt(form.start_date),
        target_end_date: opt(form.target_end_date),
        rde_thrust: opt(form.rde_thrust),
        rde_priority: opt(form.rde_priority),
        sdgs: form.sdgs.map(Number),
        sectors: form.sectors,
        sector_other: form.sectors.includes("others") ? form.sector_other : undefined,
        is_continuing: isContinuing,
        continuing_year: isContinuing ? Number(form.continuing_year) : undefined,
        research_type: opt(form.research_type),
        research_priority_area: opt(form.research_priority_area),
        research_typology: form.research_typology,
        campus: opt(form.campus),
        // One dropdown since client feedback 2026-10-06; stored in both fields so the SF-018 form, reports and lists stay filled.
        college: opt(form.implementing_unit),
        implementing_unit: opt(form.implementing_unit),
        cooperating_agencies: agencies.length ? agencies.join(", ") : undefined,
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
      }, requestKey);
      const parts: [string, Promise<unknown>][] = [
        ...filledTeam.map((t): [string, Promise<unknown>] => [
          "Team member",
          researchApi.createTeamMember({ project: project.id, member_role: t.member_role, name: t.name.trim(), gender: t.gender || undefined, user: t.user }),
        ]),
        ...filledStudies.map((title): [string, Promise<unknown>] => ["Study", researchApi.createStudy({ project: project.id, title })]),
        ...(filledLib.length
          ? [
              [
                "LIB",
                researchApi.createProjectLib(
                  project.id,
                  filledLib.map((r) => ({
                    category: r.category,
                    description: r.description.trim(),
                    fiscal_year: (libPeriods ? Number(form.start_date.slice(0, 4)) : Number(libYear)) || null,
                    unit: r.unit,
                    quantity: r.quantity,
                    unit_cost: r.unit_cost,
                    ...(libPeriods ? { allocations: libPeriods.map((period) => ({ period, amount: r.allocations?.[period] || "0" })) } : {}),
                  })),
                  `${requestKey}-lib`,
                ),
              ] as [string, Promise<unknown>],
            ]
          : []),
        [
          "Annex A endorsers",
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
        ],
        ...filledBeneficiaries.map((b): [string, Promise<unknown>] => [
          "Target beneficiary",
          researchApi.createBeneficiary({ project: project.id, group: b.group.trim(), description: b.description.trim(), total: Number(b.total) || 0 }),
        ]),
        ...filledOutputs.map((o): [string, Promise<unknown>] => [
          "6P expected output",
          outputsApi.createExpectedOutput({ project: project.id, category: o.category as SixPCategory, description: o.description.trim(), target_count: Number(o.target_count) || 1 }),
        ]),
        ...filledWorkPlan.map((w): [string, Promise<unknown>] => [
          "Work plan activity",
          researchApi.createMilestone({ project: project.id, title: w.title.trim(), start_date: w.start_date || undefined, target_date: w.target_date }),
        ]),
        ...stagedDocs.map(({ file, type }): [string, Promise<unknown>] => [
          `Document ${file.file.name}`,
          documentApi.registerStagedDocument({ project: project.id, document_type: type, stage: "inception", staged_token: file.token! }),
        ]),
      ];
      const failed = failedParts(parts.map(([label]) => label), await Promise.allSettled(parts.map(([, promise]) => promise)));
      const formSaved = await documentApi.saveProposalForm(project.id).then(() => true, () => false);
      discardDraft();
      if (failed.length) notify.error(`Project registered, but these could not be saved: ${failed.join("; ")}. Add them from the project page.`);
      else notify.success("Project registered as a Draft. The Research Proposal Form is saved under Document Management. Submit it for review from Projects.");
      if (!formSaved) notify.error("The Research Proposal Form could not be saved to Document Management.");
      navigate(`/projects/${project.id}`);
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      if (data?.project_code) {
        notify.error(`Project code ${form.project_code.trim()} already exists. Use a different code.`);
        setStep(0);
      } else if (data?.title) {
        // Client 2026-10-24: an existing title can't be registered again
        notify.error(String([data.title].flat()[0] || "This project already exists."));
        setStep(0);
      } else {
        notify.error(errorMessage(err, "Could not register the project."));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const confirmTeam = confirmTeamTo === null ? null : previewData();
  const teamLines = confirmTeam
    ? [
        { role: "Project Leader", names: [confirmTeam.lead_name || edit?.project.lead_detail?.full_name || "—"] },
        { role: "Co-Project Leader", names: confirmTeam.co_leaders.map((t) => t.name) },
        { role: "Project Staff", names: confirmTeam.team.map((t) => t.name) },
      ]
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      {confirmTeamTo !== null && (
        <ProtoModal
          title="Confirm the Project Team"
          subtitle="Check that everyone who belongs to this approved project is listed."
          onClose={() => setConfirmTeamTo(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmTeamTo(null)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "#f1f5f9", color: "#475569" }}>
                No, Cancel
              </button>
              <button
                onClick={() => {
                  setTeamConfirmed(true);
                  setStep(confirmTeamTo);
                  setConfirmTeamTo(null);
                }}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: "#0d2a5e" }}
              >
                Yes, Proceed
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            {teamLines.map((line) => (
              <div key={line.role}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#64748b" }}>{line.role}</p>
                {line.names.length ? (
                  <ul className="text-sm space-y-0.5" style={{ color: "#0d2a5e" }}>
                    {line.names.map((n, i) => (
                      <li key={i}>• {n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm" style={{ color: "#94a3b8" }}>None added</p>
                )}
              </div>
            ))}
          </div>
        </ProtoModal>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Project List
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-semibold" style={{ color: "#64748b" }}>{edit ? `Edit ${edit.project.project_code}` : "Register Approved Project"}</span>
      </div>

      <div className="w-full rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-6 py-4 shrink-0" style={{ background: "#0d2a5e" }}>
          <p className="text-white font-bold text-base">{edit ? "Edit Registered Project" : "Register Approved Project"}</p>
          <p className="text-white/50 text-xs mt-0.5">
            Research Proposal Form (LSPU-RDO-SF-018) ·{" "}
            {mode === "manual" ? `Step ${step + 1}/${WIZARD_STEPS.length} — ${WIZARD_STEPS[step].label}` : "Upload via Excel"}
            {edit && " · The Line-Item Budget and the approved Total Project/Study Cost can't be changed here"}
            {mode === "manual" && !edit && savedAt && ` · Draft saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
          </p>
        </div>

        <div className="px-5 pt-4 flex flex-wrap gap-2" hidden={isEdit}>
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

        {mode === "excel" && <ExcelImport onReview={(excel) => onLoadExcel?.(excel)} />}

        {mode === "manual" && (
          <>
            {fromExcel && (
              <div className="mx-5 mt-4 px-4 py-3 rounded-xl flex items-start gap-3 flex-wrap" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <p className="text-xs flex-1 min-w-60" style={{ color: "#1e3a8a" }}>
                  <span className="font-bold">Loaded from {fromExcel.fileName}.</span> Nothing is registered yet: check and edit every step, attach the
                  documents, then Register on the last step.
                </p>
                <button onClick={startOver} className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0" style={{ background: "white", color: "#1e3a8a", border: "1px solid #bfdbfe" }}>
                  Start over
                </button>
              </div>
            )}
            {restored && (
              <div className="mx-5 mt-4 px-4 py-3 rounded-xl flex items-start gap-3 flex-wrap" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <p className="text-xs flex-1 min-w-60" style={{ color: "#92400e" }}>
                  <span className="font-bold">Draft restored</span> from {new Date(restored.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Uploaded
                  documents and the certification checkbox aren't kept in a draft, so attach and check them again.
                </p>
                <button onClick={startOver} className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0" style={{ background: "white", color: "#92400e", border: "1px solid #fde68a" }}>
                  Start over
                </button>
              </div>
            )}
            <div className="px-5 py-3 mt-4 border-y shrink-0 overflow-x-auto" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
              <div className="flex items-center gap-1 min-w-max">
                {WIZARD_STEPS.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <button
                      onClick={() => goToStep(i)}
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
                      <input
                        className={inputCls + " read-only:opacity-70"}
                        style={inputSt}
                        value={form.project_code}
                        onChange={set("project_code")}
                        readOnly={codeLocked}
                        title={codeLocked ? "Only the System Admin can change the code of a registered project" : undefined}
                        placeholder="e.g. FRN-2026-001"
                      />
                    </Field>
                    <Field label="Funding Type" required invalid={bad("funding_type")}>
                      <select className={inputCls} style={inputSt} value={form.funding_type} onChange={set("funding_type")}>
                        <option value="">Select funding type...</option>
                        {fundingTypes.options.map(([k, v]) => (
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
                        {DRY_RESEARCH_OPTIONS.map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
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
                      {isEdit ? (
                        <input readOnly className={inputCls + " opacity-70"} style={inputSt} value={form.total_cost ? `₱${peso(Number(form.total_cost))}` : "—"} title="Approved budget; changes go through Realignment" />
                      ) : (
                        <MoneyInput className={inputCls} style={inputSt} value={form.total_cost} onChange={(v) => setForm((p) => ({ ...p, total_cost: v }))} />
                      )}
                    </Field>
                    <RdeAgendaPicker
                      choices={choices["rde-thrusts"]}
                      thrust={form.rde_thrust}
                      priority={form.rde_priority}
                      onChange={(rde_thrust, rde_priority) => setForm((p) => ({ ...p, rde_thrust, rde_priority }))}
                      showErrors={showErrors}
                    />
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
                      <select className={inputCls + " disabled:opacity-80"} style={inputSt} value={form.lead} onChange={set("lead")} disabled={isProjectLeader || isEdit}>
                        <option value="">
                          {projectLeaders.length || isProjectLeader
                            ? "Select project leader..."
                            : leadersBlocked
                              ? "Leader list isn't available for your role, use Upload via Excel"
                              : "No active project leaders yet"}
                        </option>
                        {(edit
                          ? [{ id: edit.project.lead, email: edit.project.lead_detail?.email ?? "", full_name: edit.project.lead_detail?.full_name }]
                          : isProjectLeader && user
                            ? [{ id: user.pk, email: user.email, full_name: selfName }]
                            : projectLeaders
                        ).map((u) => (
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
                          const taken = takenUserIds(team, i);
                          return (
                            <div key={i} className="flex gap-2 items-start">
                              <select className={inputCls + " max-w-44"} style={inputSt} value={t.member_role} onChange={(e) => update({ member_role: e.target.value })}>
                                <option value="co_leader">Co-Project Leader</option>
                                <option value="member">Team Member</option>
                              </select>
                              <UserPicker
                                className="flex-1"
                                users={accounts.filter((a) => String(a.id) !== form.lead && !taken.has(a.id) && (TEAM_ROLE_CODES[t.member_role] ?? []).includes(a.role?.code ?? ""))}
                                value={{ user: t.user, name: t.name }}
                                onChange={(picked) => update(picked)}
                                invalid={showErrors && !t.name.trim()}
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
                    <Field label="College Unit - Implementing Unit" span>
                      <ChoiceSelect choices={choices["college-units"]} value={form.implementing_unit} onChange={set("implementing_unit")} placeholder="Select a unit" />
                    </Field>
                    <Field label="Cooperating Agency/ies" span>
                      <MultiSelect
                        options={choices["cooperating-agencies"].map((a) => ({ value: a.name, label: a.name }))}
                        value={agencies}
                        onChange={setAgencies}
                        placeholder={choices["cooperating-agencies"].length ? "Select one or more agencies" : "No choices yet, ask the System Admin to add them"}
                      />
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
                          {studyTitles.length > 1 && i >= (edit?.studyIds.length ?? 0) && (
                            <RemoveButton onClick={() => setStudyTitles(studyTitles.filter((_, idx) => idx !== i))} label="Remove study" />
                          )}
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
                    <RichTextEditor ariaLabel="II. Background of the Study" value={form.background} onChange={setRich("background")} placeholder="Background and rationale as stated in the approved proposal" />
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
                    <RichTextEditor ariaLabel="IV. Project Descriptions / Methodology" value={form.methodology} onChange={setRich("methodology")} />
                  </Field>
                  <Field label="VI. Socio-Economic Significance">
                    <RichTextEditor ariaLabel="VI. Socio-Economic Significance" value={form.socio_economic_significance} onChange={setRich("socio_economic_significance")} />
                  </Field>
                  <Field label="VIII. Monitoring / Evaluation">
                    <RichTextEditor ariaLabel="VIII. Monitoring / Evaluation" value={form.monitoring_evaluation} onChange={setRich("monitoring_evaluation")} />
                  </Field>
                  <Field label="IX. List of References (APA format)">
                    <RichTextEditor ariaLabel="IX. List of References" value={form.references} onChange={setRich("references")} />
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
                    <div className="flex items-center gap-4">
                      <WorkPlanExcelButton
                        onErrors={setWorkPlanErrors}
                        onRows={(rows) => {
                          setWorkPlanRows([...workPlanRows.filter((w) => w.id || w.title.trim() || w.start_date || w.target_date), ...rows]);
                          if (rows.length) notify.success(`${rows.length} activit${rows.length === 1 ? "y" : "ies"} added from Excel. Check them before you continue.`);
                          else notify.error("The Work Plan sheet has no activities.");
                        }}
                      />
                      <AddRowButton onClick={() => setWorkPlanRows([...workPlanRows, { title: "", start_date: "", target_date: "" }])}>Add Activity</AddRowButton>
                    </div>
                  </div>
                  {workPlanErrors.length > 0 && <ImportErrorTable errors={workPlanErrors} outcome="no activities were added" />}
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
                            {w.tasks ? (
                              <span className="mt-2 text-xs shrink-0" style={{ color: "#94a3b8" }} title="Move or delete its tasks on the Tasks page first">
                                {w.tasks} task{w.tasks !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <RemoveButton onClick={() => setWorkPlanRows(workPlanRows.filter((_, idx) => idx !== i))} label="Remove activity" />
                            )}
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
                <fieldset disabled={isEdit} className="space-y-4 min-w-0">
                  {edit && (
                    <div className="rounded-xl px-4 py-3 text-xs font-semibold" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                      🔒 The LIB of a registered project is locked. Changes go through a Realignment under Budget Management.
                    </div>
                  )}
                  <StepNote>
                    Section X, Budget Requirements: the approved Line-Item Budget (Total = Qty × Unit Cost). It is saved as the project's draft LIB (version 1) for the
                    CRC Chair to endorse and then the Budget Officer to certify under Budget Management. Its Grand Total must equal the Total Project/Study Cost from Project Details before you can go on.
                  </StepNote>
                  {libPeriods ? (
                    <div className="rounded-xl px-4 py-3 text-xs font-semibold" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" }}>
                      {libPeriods[0] === "Q1"
                        ? `One-year project: split each item's total per quarter (${libPeriods.join(", ")}) in the allocation table below.`
                        : `${periodYear(libPeriods[libPeriods.length - 1])}-year project: split each item's total per quarter of each project year in the allocation table below.`}{" "}
                      Only the quarters the project covers are shown; the split must add up to the item's total.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl px-4 py-3 text-xs font-semibold" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                        Set the Start and Target End dates in Project Details to split each item per year or per quarter.
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Fiscal Year">
                          <input type="number" min="2000" className={inputCls} style={inputSt} value={libYear} onChange={(e) => setLibYear(e.target.value)} />
                        </Field>
                      </div>
                    </>
                  )}
                  {libPeriods ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0d2a5e" }}>Allocation per Quarter</p>
                      <LibAllocationGrid
                        periods={libPeriods}
                        groups={groupLibRows(libRows, LIB_CATEGORIES, libRowTotal).map((g) => ({
                          key: g.key,
                          label: g.label,
                          subtotal: g.subtotal,
                          rows: g.rows.map(({ row, index }) => ({ index, description: row.description.trim(), total: libRowTotal(row), allocations: row.allocations })),
                        }))}
                        onChange={(i, period, v) => updateLib(i, { allocations: { ...libRows[i].allocations, [period]: v } })}
                        onAdd={(category) => setLibRows([...libRows, { category: category as LibCategory, description: "", unit: "unit", quantity: "", unit_cost: "" }])}
                        onRemove={(i) => setLibRows(libRows.filter((_, idx) => idx !== i))}
                        itemCells={(i) => {
                          const r = libRows[i];
                          const tableInput = "w-full px-2 py-1.5 rounded-md border text-xs outline-none focus:border-[#0891b2]";
                          const tableSt = { borderColor: "#94a3b8", background: "white", color: "#0f172a" };
                          return [
                            <LibItemSelect ariaLabel="Item" category={r.category} className={tableInput} style={tableSt} value={r.description} onChange={(description) => updateLib(i, { description })} />,
                            <select className={tableInput} style={tableSt} value={r.unit} onChange={(e) => updateLib(i, { unit: e.target.value })} aria-label="Unit">
                              {LIB_UNITS.map(([code, label]) => (
                                <option key={code} value={code}>{label}</option>
                              ))}
                            </select>,
                            <input type="number" min="0" step="any" className={tableInput} style={tableSt} value={r.quantity} onChange={(e) => updateLib(i, { quantity: e.target.value })} placeholder="Qty" aria-label="Qty" />,
                            <MoneyInput className={tableInput + " text-right"} style={tableSt} value={r.unit_cost} onChange={(v) => updateLib(i, { unit_cost: v })} placeholder="0.00" aria-label="Unit Cost" />,
                          ];
                        }}
                      />
                    </div>
                  ) : LIB_CATEGORIES.map((cat) => {
                    const rows = libRows.map((r, i) => ({ r, i })).filter(({ r }) => r.category === cat.key);
                    const subtotal = rows.reduce((sum, { r }) => sum + libRowTotal(r), 0);
                    return (
                      <div key={cat.key} className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                        <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#f8fafc" }}>
                          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0d2a5e" }}>{cat.label}</p>
                          <AddRowButton onClick={() => setLibRows([...libRows, { category: cat.key, description: "", unit: "unit", quantity: "", unit_cost: "" }])}>Add Item</AddRowButton>
                        </div>
                        {rows.length === 0 ? (
                          <p className="px-3 py-2 text-xs" style={{ color: "#94a3b8" }}>No items.</p>
                        ) : (
                          <div className="p-2 space-y-2">
                            <div className="hidden md:flex gap-2 px-1 text-xs font-semibold" style={{ color: "#64748b" }}>
                              <span className="flex-1">Item</span>
                              <span className="w-28">Unit</span>
                              <span className="w-24">Qty</span>
                              <span className="w-36">Unit Cost (₱)</span>
                              <span className="w-36">Total (₱)</span>
                              <span className="w-4" />
                            </div>
                            {rows.map(({ r, i }) => (
                              <div key={i} className="flex flex-wrap gap-2 items-start">
                                <LibItemSelect ariaLabel="Item" category={r.category} className={inputCls + " md:flex-1 min-w-48"} style={inputSt} value={r.description} onChange={(description) => updateLib(i, { description })} />
                                <select className={inputCls + " md:w-28"} style={inputSt} value={r.unit} onChange={(e) => updateLib(i, { unit: e.target.value })} aria-label="Unit">
                                  {LIB_UNITS.map(([code, label]) => (
                                    <option key={code} value={code}>{label}</option>
                                  ))}
                                </select>
                                <input type="number" min="0" step="any" className={inputCls + " md:w-24"} style={inputSt} value={r.quantity} onChange={(e) => updateLib(i, { quantity: e.target.value })} placeholder="Qty" aria-label="Qty" />
                                <MoneyInput className={inputCls + " md:w-36"} style={inputSt} value={r.unit_cost} onChange={(v) => updateLib(i, { unit_cost: v })} placeholder="Unit Cost" aria-label="Unit Cost" />
                                <input readOnly tabIndex={-1} className={inputCls + " md:w-36 font-mono font-bold text-right"} style={{ ...inputSt, background: "#f1f5f9", color: "#0d2a5e" }} value={peso(libRowTotal(r))} aria-label="Total" />
                                <RemoveButton onClick={() => setLibRows(libRows.filter((_, idx) => idx !== i))} label="Remove item" />
                              </div>
                            ))}
                            <p className="text-xs font-semibold text-right pr-8" style={{ color: "#64748b" }}>Subtotal: ₱{peso(subtotal)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {approvedBudget > 0 && libDifference !== 0 && (
                    <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                      Grand total must equal approved budget (₱{peso(approvedBudget)}). The approved budget can't be changed here; adjust the line items, or use a
                      Realignment after the project is registered.
                    </div>
                  )}
                  <div className="rounded-xl px-4 py-3" style={{ background: approvedBudget > 0 && libDifference !== 0 ? "#991b1b" : "#1e3a8a" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold" style={{ color: "white" }}>Grand Total</p>
                      <p className="text-lg font-mono font-black" style={{ color: "white" }}>₱{peso(libGrandTotal)}</p>
                    </div>
                    {approvedBudget > 0 && (
                      <div className="mt-2 pt-2 flex items-center justify-between text-xs font-semibold" style={{ borderTop: "1px solid rgba(255,255,255,0.25)", color: libDifference === 0 ? "#bfdbfe" : "#fecaca" }}>
                        <span>Difference from Approved Budget (₱{peso(approvedBudget)}):</span>
                        <span className="font-mono">{libDifference > 0 ? "+" : libDifference < 0 ? "-" : ""}₱{peso(Math.abs(libDifference))}</span>
                      </div>
                    )}
                  </div>
                </fieldset>
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
                    Pick the endorser's name; the designation fills in by itself. Add Endorser again for every other signatory. The list is kept by the
                    System Admin under Administration &gt; Endorsers.
                    {user?.role?.code === "system_admin" && (
                      <>
                        {" "}
                        <a href="/admin/endorsers" target="_blank" rel="noreferrer" className="font-semibold" style={{ color: "#0891b2" }}>Manage the list</a>
                        {" · "}
                        <button type="button" onClick={reloadEndorserChoices} className="font-semibold" style={{ color: "#0891b2" }}>Reload</button>
                      </>
                    )}
                  </p>
                  {endorsers.length === 0 && <p className="text-xs" style={{ color: "#94a3b8" }}>No endorsers added.</p>}
                  <div className="space-y-2">
                    {endorsers.map((e, i) => {
                      const listed = choices.endorsers.some((c) => c.name === e.name);
                      return (
                        <div key={i} className="rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-2 relative" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <select className={inputCls} style={inputSt} value={e.name} onChange={(ev) => pickEndorser(i, ev.target.value)} aria-label="Endorser">
                            <option value="">{choices.endorsers.length ? "Select the endorser..." : "No endorsers yet, ask the System Admin to add them"}</option>
                            {e.name && !listed && <option value={e.name}>{e.name}</option>}
                            {choices.endorsers.map((c) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
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
                    {APPROVAL_DOCS.map((d) => (
                      <Field key={d.type} label={d.label} required invalid={showErrors && !approvalAttached(d.type)}>
                        <FilePick label={`Click to upload the ${d.label}`} files={approvalDocs[d.type]} onChange={setApprovalDoc(d.type)} />
                        {edit?.savedDocs[d.type] && approvalDocs[d.type].length === 0 && (
                          <p className="mt-1 text-xs" style={{ color: "#166534" }}>✓ Saved: {edit.savedDocs[d.type]} · upload to replace it with a new version</p>
                        )}
                      </Field>
                    ))}
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
                    <InfoCard label={edit ? "Review Status" : "Initial Status"} value={edit ? edit.project.review_status_label : "Draft"} />
                    <InfoCard label="Documents Uploaded" value={String(stagedDocs.length)} />
                    <InfoCard label={edit ? "Edited On" : "Registration Date"} value={new Date().toLocaleDateString("en-PH")} />
                  </div>

                  {!edit && (
                    <div className="rounded-xl p-3" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                      <p className="text-xs leading-relaxed" style={{ color: "#1e40af" }}>
                        ℹ Registering saves this project as a Draft. Its Project Leader submits it for review from Projects once the LIB, Notice of
                        Approval, NTP and MOA are in.
                      </p>
                    </div>
                  )}

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
                onClick={() => (step > 0 ? setStep(step - 1) : navigate(edit ? `/projects/${edit.project.id}` : "/projects"))}
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
                  {edit ? (isCreating ? "Saving…" : "Save Changes") : isCreating ? "Registering…" : "Register Project"}
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
  const [resetKey, setResetKey] = useState(0);
  const [fromExcel, setFromExcel] = useState<ExcelDraft | null>(null);
  const reopen = (excel: ExcelDraft | null) => {
    setFromExcel(excel);
    setResetKey((k) => k + 1);
  };
  return (
    <ProtectedRoute>
      <AppShell title="Register Approved Project">
        <RegisterProjectContent key={resetKey} fromExcel={fromExcel} onLoadExcel={reopen} onStartOver={() => reopen(null)} />
      </AppShell>
    </ProtectedRoute>
  );
}

const byId = <T extends { id: number }>(rows: T[]) => [...rows].sort((a, b) => a.id - b.id);

/** The wizard's form state built from a registered project and its form rows. */
async function loadEditSource(projectId: number): Promise<EditSource> {
  const [project, team, studies, outputs, beneficiaries, milestones, endorsers, budgets] = await Promise.all([
    researchApi.getProject(projectId),
    researchApi.getTeamMembers(projectId),
    researchApi.getStudies(projectId),
    outputsApi.getExpectedOutputs({ project: projectId }),
    researchApi.getBeneficiaries(projectId),
    researchApi.getMilestones(projectId),
    researchApi.getEndorsers(projectId),
    budgetApi.getBudgets(projectId),
  ]);
  const documents = await documentApi.getDocuments({ project: projectId, current_only: true }).catch(() => []);
  const savedDocs: EditSource["savedDocs"] = {};
  for (const d of APPROVAL_DOCS) savedDocs[d.type] = documents.find((doc) => doc.document_type === d.type)?.file_name;
  const sortedStudies = byId(studies);
  const lineItems = budgets.find((b) => b.is_current)?.line_items ?? [];
  const draft = toRegisterDraft({ project, team, studies, outputs, beneficiaries, milestones, endorsers, line_items: lineItems }, true);
  return {
    project,
    draft,
    studyIds: sortedStudies.map((st) => st.id),
    originalIds: {
      team: team.map((t) => t.id),
      outputs: outputs.map((o) => o.id),
      beneficiaries: beneficiaries.map((b) => b.id),
      workPlan: milestones.map((m) => m.id),
      endorsers: endorsers.map((e) => e.id),
    },
    savedDocs,
  };
}

function EditProjectContent() {
  const { id } = useParams();
  const { user } = useAuth();
  const [source, setSource] = useState<EditSource | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadEditSource(Number(id))
      .then((s) => active && setSource(s))
      .catch(() => active && setSource(null));
    return () => {
      active = false;
    };
  }, [id]);

  if (source === undefined) return <div className="h-96 rounded-2xl animate-pulse" style={{ background: "white", border: "1px solid #e2e8f0" }} />;
  if (source === null) return <NoActualData message="Project not found" />;
  const code = user?.role?.code;
  if (!(code === "system_admin" || (code === "project_leader" && source.project.lead === user?.pk))) {
    return <NoActualData message="Only the System Admin or this project's Project Leader can edit it" />;
  }
  if (!registrationOpen(source.project.review_status)) {
    return (
      <NoActualData
        message={`This project is ${source.project.review_status_label} and can't be edited until it is returned for revision.`}
        hint={workAllowed(source.project.review_status) ? "Budget changes go through a Realignment under Budget Management." : undefined}
      />
    );
  }
  return <RegisterProjectContent edit={source} onStartOver={() => undefined} />;
}

/** Edit Registered Project (client request 2026-10-09): the Register Approved Project wizard, filled from the project. */
export function EditProjectPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Edit Registered Project">
        <EditProjectContent />
      </AppShell>
    </ProtectedRoute>
  );
}
