import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { budgetApi } from "../lib/budgetApi";
import { financialApi } from "../lib/financialApi";
import { researchApi } from "../lib/researchApi";
import { documentApi } from "../lib/documentApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type { LineItemBudget, LineItemCategory } from "../types/budget";
import type { BudgetRealignment, BudgetSummary, Disbursement, LineItemBalance, RealignmentStatus, RealignmentTier } from "../types/financial";
import type { ProjectDocument } from "../types/document";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { Field, SkeletonRows } from "../components/common/proto";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const DISBURSEMENT_ROLE_CODES = ["system_admin", "finance_budget"];
const REALIGNMENT_REQUEST_ROLE_CODES = ["system_admin", "project_leader"];
const REALIGNMENT_MAJOR_REVIEW_ROLE_CODES = ["system_admin", "university_admin"];
const REALIGNMENT_BOR_REVIEW_ROLE_CODES = ["system_admin"];

const CATEGORIES: LineItemCategory[] = ["ps", "mooe", "co"];
const CATEGORY_META: Record<LineItemCategory, { label: string; full: string; color: string; bg: string; icon: string }> = {
  ps: { label: "PS", full: "Personal Services", color: "#0d2a5e", bg: "#e0eaf7", icon: "👤" },
  mooe: { label: "MOOE", full: "Maintenance & Other Operating Expenses", color: "#0891b2", bg: "#e0f2fe", icon: "🧾" },
  co: { label: "CO", full: "Capital Outlay", color: "#059669", bg: "#d1fae5", icon: "🏗️" },
};

const TIER_META: Record<RealignmentTier, { label: string; bg: string; color: string }> = {
  minor: { label: "Minor (≤33%)", bg: "#e0f2fe", color: "#0369a1" },
  major: { label: "Major (33–100%)", bg: "#fef3c7", color: "#92400e" },
  bor: { label: "Board of Regents", bg: "#faf5ff", color: "#6b21a8" },
};

const STATUS_META: Record<RealignmentStatus, { label: string; bg: string; color: string }> = {
  implemented: { label: "Implemented", bg: "#d1fae5", color: "#166534" },
  pending_approval: { label: "Pending University Admin", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#d1fae5", color: "#166534" },
  pending_bor: { label: "Pending Board of Regents", bg: "#faf5ff", color: "#6b21a8" },
  bor_approved: { label: "BOR Approved", bg: "#d1fae5", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};

type FlagType = "over_utilization" | "near_limit" | "under_utilization" | "significant_variance";
const FLAG_META: Record<FlagType, { label: string; icon: string; bg: string; color: string }> = {
  over_utilization: { label: "Over-utilized", icon: "🔴", bg: "#fee2e2", color: "#991b1b" },
  near_limit: { label: "Near limit (>85%)", icon: "🟠", bg: "#fff7ed", color: "#c2410c" },
  under_utilization: { label: "Under-utilized", icon: "🟡", bg: "#fef3c7", color: "#92400e" },
  significant_variance: { label: "Realigned >15%", icon: "🟣", bg: "#faf5ff", color: "#6b21a8" },
};

type BoardTab = "ledger" | "utilization" | "variance" | "adjustments" | "report";

const today = () => new Date().toLocaleDateString("en-CA");
const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));
const isPending = (s: RealignmentStatus) => s === "pending_approval" || s === "pending_bor";

function flagsFor(r: LineItemBalance): FlagType[] {
  const pct = r.utilization_pct ?? 0;
  const flags: FlagType[] = [];
  if (pct > 100) flags.push("over_utilization");
  else if (pct > 85) flags.push("near_limit");
  else if (pct < 20 && r.adjusted > 50000) flags.push("under_utilization");
  if (r.approved > 0 && Math.abs(r.adjusted - r.approved) / r.approved > 0.15) flags.push("significant_variance");
  return flags;
}

function CatChip({ cat }: { cat: LineItemCategory }) {
  const m = CATEGORY_META[cat];
  return <span className="text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: m.bg, color: m.color }}>{m.icon} {m.label}</span>;
}

function Chip({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color }}>{children}</span>;
}

function UtilBar({ pct, approved, disbursed }: { pct: number; approved: number; disbursed: number }) {
  const color = pct > 100 ? "#dc2626" : pct > 85 ? "#d97706" : "#0891b2";
  return (
    <div className="space-y-1">
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
        <span className="text-xs font-mono truncate" style={{ color: "#94a3b8" }}>{peso(disbursed)} / {peso(approved)}</span>
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, footer, width = "max-w-xl" }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 pb-4" style={{ background: "rgba(8,26,61,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className={`w-full ${width} rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[95vh]`} style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-start justify-between gap-3 shrink-0" style={{ background: "#0d2a5e" }}>
          <div className="min-w-0">
            <p className="text-white font-bold">{title}</p>
            {subtitle && <p className="text-white/50 text-xs mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white shrink-0" aria-label="Close">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t flex gap-3 shrink-0" style={{ borderColor: "#e2e8f0" }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

function RecordModal({
  budget,
  summary,
  documents,
  onClose,
  onSaved,
}: {
  budget: LineItemBudget;
  summary: BudgetSummary | null;
  documents: ProjectDocument[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cat, setCat] = useState<LineItemCategory>("mooe");
  const [form, setForm] = useState({ line_item: "", amount: "", reference_number: "", payee: "", description: "", supporting_document: "", disbursed_on: today() });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const row = summary?.line_items.find((r) => String(r.line_item) === form.line_item);
  const amount = parseFloat(form.amount) || 0;
  const wouldOver = !!row && amount > row.available;

  const checks = [
    { label: "LIB line item selected", ok: !!form.line_item },
    { label: "Transaction date provided", ok: !!form.disbursed_on },
    { label: "Amount > 0", ok: amount > 0 },
    { label: "Within the line item's available balance", ok: !wouldOver },
    { label: "Payee provided", ok: !!form.payee.trim() },
    { label: "Reference number provided", ok: !!form.reference_number.trim() },
  ];
  const allValid = checks.every((c) => c.ok);

  const save = async () => {
    setSaving(true);
    try {
      await financialApi.createDisbursement({
        line_item: Number(form.line_item),
        amount: amount.toFixed(2),
        reference_number: form.reference_number.trim(),
        payee: form.payee.trim(),
        description: form.description.trim(),
        supporting_document: form.supporting_document ? Number(form.supporting_document) : null,
        disbursed_on: form.disbursed_on,
      });
      notify.success(`Disbursement of ${peso(amount)} recorded.`);
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not record the disbursement."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Record Disbursement"
      subtitle="Link to LIB item · Validate · Post"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={!allValid || saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: allValid && !saving ? "#0d2a5e" : "#94a3b8" }}>
            {saving ? "Posting…" : "Post Disbursement"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Transaction Date">
          <input type="date" className={INPUT_CLS} style={INPUT_STYLE} value={form.disbursed_on} onChange={set("disbursed_on")} />
        </Field>
        <Field label="Expense Category">
          <select
            className={INPUT_CLS}
            style={INPUT_STYLE}
            value={cat}
            onChange={(e) => {
              setCat(e.target.value as LineItemCategory);
              setForm((f) => ({ ...f, line_item: "" }));
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label} — {CATEGORY_META[c].full}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Link to LIB Item" required>
        <select className={INPUT_CLS} style={INPUT_STYLE} value={form.line_item} onChange={set("line_item")}>
          <option value="">— Select LIB line item —</option>
          {budget.line_items
            .filter((i) => i.category === cat)
            .map((i) => {
              const r = summary?.line_items.find((x) => x.line_item === i.id);
              return (
                <option key={i.id} value={i.id}>
                  {i.description} · {r ? `${peso(r.available)} available · ${Math.round(r.utilization_pct ?? 0)}% used` : peso(i.amount)}
                </option>
              );
            })}
        </select>
      </Field>
      {wouldOver && row && (
        <div className="rounded-xl px-4 py-3" style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}>
          <p className="text-xs font-black" style={{ color: "#991b1b" }}>🔴 Over the available balance</p>
          <p className="text-xs mt-0.5" style={{ color: "#7f1d1d" }}>
            {peso(amount)} exceeds the {peso(row.available)} still available on "{row.description}". Request a realignment first.
          </p>
        </div>
      )}
      <Field label="Description of Expenditure">
        <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={form.description} onChange={set("description")} placeholder="Goods/services purchased or expenses incurred…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₱)" required>
          <input type="number" min="0" step="0.01" className={INPUT_CLS} style={INPUT_STYLE} value={form.amount} onChange={set("amount")} placeholder="0.00" />
        </Field>
        <Field label="Reference No." required>
          <input className={INPUT_CLS} style={INPUT_STYLE} value={form.reference_number} onChange={set("reference_number")} placeholder="PO / DV / OR number" />
        </Field>
      </div>
      <Field label="Payee" required>
        <input className={INPUT_CLS} style={INPUT_STYLE} value={form.payee} onChange={set("payee")} placeholder="Supplier, recipient, or institution" />
      </Field>
      <Field label="Supporting Document">
        <select className={INPUT_CLS} style={INPUT_STYLE} value={form.supporting_document} onChange={set("supporting_document")}>
          <option value="">{documents.length ? "— None —" : "No documents uploaded for this project yet"}</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>{d.file_name} (v{d.version_number})</option>
          ))}
        </select>
      </Field>
      <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Validation</p>
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: c.ok ? "#059669" : "#e2e8f0" }}>
              {c.ok && <span className="text-white" style={{ fontSize: "8px" }}>✓</span>}
            </div>
            <p className="text-xs" style={{ color: c.ok ? "#166534" : "#94a3b8" }}>{c.label}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function RealignModal({ budget, onClose, onSaved }: { budget: LineItemBudget; onClose: () => void; onSaved: () => void }) {
  const [target, setTarget] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({ from_line_item: "", to_line_item: "", new_item_category: "", new_item_description: "", amount: "", justification: "" });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const from = budget.line_items.find((i) => String(i.id) === form.from_line_item);
  const pct = from && Number(from.amount) > 0 ? Math.round(((parseFloat(form.amount) || 0) / Number(from.amount)) * 100) : 0;
  const expectedTier: RealignmentTier = target === "new" || pct > 100 ? "bor" : pct > 33 ? "major" : "minor";

  const save = async () => {
    setAttempted(true);
    const targetOk = target === "existing" ? !!form.to_line_item : !!form.new_item_category && !!form.new_item_description.trim();
    if (!form.from_line_item || !targetOk || !form.amount || !form.justification.trim()) {
      notify.error("Source item, target, amount, and justification are required.");
      return;
    }
    setSaving(true);
    try {
      await financialApi.createRealignment({
        from_line_item: Number(form.from_line_item),
        to_line_item: target === "existing" ? Number(form.to_line_item) : null,
        new_item_category: target === "new" ? form.new_item_category : undefined,
        new_item_description: target === "new" ? form.new_item_description.trim() : undefined,
        amount: form.amount,
        justification: form.justification.trim(),
      });
      notify.success("Realignment requested.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit the realignment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Request Budget Realignment"
      subtitle="Once per year per project · at least 60 days before the target end date"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </>
      }
    >
      <Field label="From Line Item" required>
        <select className={INPUT_CLS} style={invalidStyle(attempted && !form.from_line_item)} value={form.from_line_item} onChange={set("from_line_item")}>
          <option value="">Select source item</option>
          {budget.line_items.map((i) => (
            <option key={i.id} value={i.id}>{CATEGORY_META[i.category].label} — {i.description} ({peso(i.amount)})</option>
          ))}
        </select>
      </Field>
      <Field label="Realign To">
        <select className={INPUT_CLS} style={INPUT_STYLE} value={target} onChange={(e) => setTarget(e.target.value as "existing" | "new")}>
          <option value="existing">An existing line item</option>
          <option value="new">A new expense item (BOR tier)</option>
        </select>
      </Field>
      {target === "existing" ? (
        <Field label="To Line Item" required>
          <select className={INPUT_CLS} style={invalidStyle(attempted && !form.to_line_item)} value={form.to_line_item} onChange={set("to_line_item")}>
            <option value="">Select target item</option>
            {budget.line_items
              .filter((i) => String(i.id) !== form.from_line_item)
              .map((i) => (
                <option key={i.id} value={i.id}>{CATEGORY_META[i.category].label} — {i.description}</option>
              ))}
          </select>
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="New Item Category" required>
            <select className={INPUT_CLS} style={invalidStyle(attempted && !form.new_item_category)} value={form.new_item_category} onChange={set("new_item_category")}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].full}</option>
              ))}
            </select>
          </Field>
          <Field label="New Item Description" required>
            <input className={INPUT_CLS} style={invalidStyle(attempted && !form.new_item_description.trim())} value={form.new_item_description} onChange={set("new_item_description")} />
          </Field>
        </div>
      )}
      <Field label="Amount (₱)" required>
        <input type="number" min="0" step="0.01" className={INPUT_CLS} style={invalidStyle(attempted && !form.amount)} value={form.amount} onChange={set("amount")} />
      </Field>
      {form.from_line_item && form.amount && (
        <div className="rounded-xl px-4 py-2.5 flex items-center justify-between" style={{ background: TIER_META[expectedTier].bg }}>
          <span className="text-xs font-bold" style={{ color: TIER_META[expectedTier].color }}>Expected tier: {TIER_META[expectedTier].label}</span>
          <span className="text-xs font-mono" style={{ color: TIER_META[expectedTier].color }}>{pct}% of source · computed by the server</span>
        </div>
      )}
      <Field label="Justification" required>
        <textarea rows={3} className={INPUT_CLS + " resize-none"} style={invalidStyle(attempted && !form.justification.trim())} value={form.justification} onChange={set("justification")} />
      </Field>
    </Modal>
  );
}

function TxnDetailModal({ txn, seq, item, doc, onClose }: { txn: Disbursement; seq: number; item?: LineItemBudget["line_items"][number]; doc?: ProjectDocument; onClose: () => void }) {
  const cm = item ? CATEGORY_META[item.category] : CATEGORY_META.mooe;
  return (
    <Modal title={txn.description || "Disbursement"} subtitle={`TXN-${String(seq).padStart(4, "0")} · ${txn.reference_number || "no reference"}`} onClose={onClose} width="max-w-md">
      <div className="flex items-center gap-2 flex-wrap">
        <Chip bg="#d1fae5" color="#166534">Posted</Chip>
        {item && <CatChip cat={item.category} />}
      </div>
      <div className="text-center py-3 rounded-2xl" style={{ background: cm.bg }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: cm.color }}>Amount</p>
        <p className="text-3xl font-black font-mono" style={{ color: cm.color }}>{peso(txn.amount)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Transaction Date", txn.disbursed_on],
          ["Recorded", txn.created_at.slice(0, 10)],
          ["Payee", txn.payee || "—"],
          ["Funding Source", txn.funding_source || "—"],
        ].map(([l, v]) => (
          <div key={l}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{l}</p>
            <p className="text-sm font-semibold mt-0.5 break-words" style={{ color: "#0d2a5e" }}>{v}</p>
          </div>
        ))}
      </div>
      {item && (
        <div className="rounded-xl px-4 py-3" style={{ background: "#e0f2fe", border: "1px solid #bae6fd" }}>
          <p className="text-xs font-bold" style={{ color: "#0369a1" }}>Linked LIB Item</p>
          <p className="text-xs mt-0.5" style={{ color: "#0369a1" }}>{item.description}</p>
        </div>
      )}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Supporting Document</p>
        <p className="text-sm mt-0.5" style={{ color: "#334155" }}>{doc ? `${doc.file_name} (v${doc.version_number})` : txn.supporting_document ? `Document #${txn.supporting_document}` : "None attached"}</p>
      </div>
    </Modal>
  );
}

function ProjectBoard({
  project,
  canDisburse,
  canRequest,
  canReviewTier,
  onBack,
  onChanged,
}: {
  project: Project;
  canDisburse: boolean;
  canRequest: boolean;
  canReviewTier: (t: RealignmentTier) => boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [budget, setBudget] = useState<LineItemBudget | null | undefined>(undefined);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [realignments, setRealignments] = useState<BudgetRealignment[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<BoardTab>("ledger");
  const [catFilter, setCatFilter] = useState<LineItemCategory | "all">("all");
  const [showRecord, setShowRecord] = useState(false);
  const [showRealign, setShowRealign] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<number | null>(null);
  const [bor, setBor] = useState<Record<number, string>>({});
  const [reviewing, setReviewing] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    budgetApi
      .getBudgets(project.id)
      .then((list) => {
        if (!active) return;
        const current = list.find((b) => b.is_current) ?? null;
        setBudget(current);
        if (!current) return;
        Promise.all([
          financialApi.getDisbursements({ budget: current.id }),
          financialApi.getRealignments(current.id),
          current.status === "certified" ? financialApi.getBudgetSummary(current.id) : Promise.resolve(null),
        ])
          .then(([d, r, s]) => {
            if (!active) return;
            setDisbursements(d);
            setRealignments(r);
            setSummary(s);
          })
          .catch(() => active && notify.error("Could not load financial records for this project."));
      })
      .catch(() => active && setBudget(null));
    documentApi
      .getDocuments({ project: project.id, current_only: true })
      .then((d) => active && setDocuments(d))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id, reloadKey]);

  const reload = () => {
    setReloadKey((k) => k + 1);
    onChanged();
  };

  const review = async (r: BudgetRealignment, decision: "approved" | "rejected") => {
    if (decision === "approved" && r.tier === "bor" && !bor[r.id]?.trim()) {
      notify.error("Enter the BOR resolution number before approving.");
      return;
    }
    setReviewing(r.id);
    try {
      await financialApi.reviewRealignment(r.id, {
        decision,
        bor_resolution_number: decision === "approved" && r.tier === "bor" ? bor[r.id].trim() : undefined,
      });
      notify.success(decision === "approved" ? "Realignment approved." : "Realignment rejected.");
      reload();
    } catch (err) {
      notify.error(errorMessage(err, "Could not review the realignment."));
    } finally {
      setReviewing(null);
    }
  };

  const items = budget?.line_items ?? [];
  const itemOf = (id: number) => items.find((i) => i.id === id);
  const totalDisb = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const certified = budget?.status === "certified";
  const sortedTxns = [...disbursements].sort((a, b) => a.id - b.id);
  const seqOf = (id: number) => sortedTxns.findIndex((d) => d.id === id) + 1;
  const filtered = disbursements.filter((d) => catFilter === "all" || itemOf(d.line_item)?.category === catFilter);
  const util = summary?.line_items ?? [];
  const pendingCount = realignments.filter((r) => isPending(r.status)).length;
  const selected = disbursements.find((d) => d.id === selectedTxn);

  const monthly = useMemo(() => {
    const m: Record<string, number> = {};
    disbursements.forEach((d) => (m[d.disbursed_on.slice(0, 7)] = (m[d.disbursed_on.slice(0, 7)] ?? 0) + Number(d.amount)));
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [disbursements]);
  const maxMonthly = Math.max(...monthly.map(([, v]) => v), 1);

  const TABS: { key: BoardTab; label: string }[] = [
    { key: "ledger", label: "Disbursement Ledger" },
    { key: "utilization", label: "Budget Utilization" },
    { key: "variance", label: "Variance Analysis" },
    { key: "adjustments", label: "Budget Adjustments" },
    { key: "report", label: "Financial Report" },
  ];

  const needsCertified = (
    <div className="rounded-2xl p-10 text-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <p className="text-2xl mb-2">📊</p>
      <p className="text-sm font-semibold" style={{ color: "#64748b" }}>This needs a certified LIB as the approved baseline.</p>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Financial Monitoring
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-mono font-semibold" style={{ color: "#64748b" }}>{project.project_code}</span>
      </div>

      {budget === undefined ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded mb-2 inline-block" style={{ background: "rgba(255,255,255,0.15)", color: "#67e8f9" }}>
                  {project.project_code}
                </span>
                <p className="text-white font-black text-lg leading-snug max-w-2xl">{project.title}</p>
                <p className="text-sm mt-1" style={{ color: "rgba(168,196,232,0.6)" }}>
                  {!budget ? "⚠ No LIB yet" : certified ? "Certified LIB · financial monitoring active" : "⚠ LIB not yet certified — disbursements open after certification"}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {canRequest && certified && (
                  <button onClick={() => setShowRealign(true)} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "rgba(124,58,237,0.6)" }}>
                    Request Realignment
                  </button>
                )}
                {canDisburse && certified && (
                  <button onClick={() => setShowRecord(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
                    + Record Disbursement
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              {[
                { label: "Transactions", val: String(disbursements.length) },
                { label: "Total Disbursed", val: peso(totalDisb) },
                { label: "Adjusted Budget", val: summary ? peso(summary.totals.adjusted) : "N/A" },
                { label: "Available", val: summary ? peso(summary.totals.available) : "N/A" },
                { label: "Pending Realignments", val: String(pendingCount) },
              ].map((k) => (
                <div key={k.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <p className="text-xs" style={{ color: "rgba(168,196,232,0.5)" }}>{k.label}</p>
                  <p className="font-black text-lg mt-0.5 font-mono truncate" style={{ color: "white" }}>{k.val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all"
                style={{ borderBottomColor: tab === t.key ? "#0891b2" : "transparent", color: tab === t.key ? "#0891b2" : "#64748b" }}
              >
                {t.label}
                {t.key === "adjustments" && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 rounded-full text-white" style={{ background: "#d97706", fontSize: "10px" }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "ledger" &&
              (disbursements.length === 0 ? (
                <NoActualData hint={canDisburse && certified ? 'Click "Record Disbursement" to post the first expenditure.' : undefined} />
              ) : (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <select
                      value={catFilter}
                      onChange={(e) => setCatFilter(e.target.value as LineItemCategory | "all")}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
                      style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
                    >
                      <option value="all">All Categories</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>
                      ))}
                    </select>
                    <span className="text-xs self-center" style={{ color: "#94a3b8" }}>{filtered.length} transactions</span>
                  </div>
                  <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "#f0f4f8" }}>
                          {["Ref", "Date", "Description / Payee", "LIB Link", "Cat", "Amount", ""].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...filtered]
                          .sort((a, b) => b.disbursed_on.localeCompare(a.disbursed_on))
                          .map((d) => {
                            const it = itemOf(d.line_item);
                            return (
                              <tr key={d.id} className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={() => setSelectedTxn(d.id)}>
                                <td className="px-3 py-2.5 text-xs font-mono font-bold whitespace-nowrap" style={{ color: "#94a3b8" }}>TXN-{String(seqOf(d.id)).padStart(4, "0")}</td>
                                <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#64748b" }}>{d.disbursed_on}</td>
                                <td className="px-3 py-2.5" style={{ maxWidth: "240px" }}>
                                  <p className="text-xs font-semibold truncate" style={{ color: "#0d2a5e" }}>{d.description || d.reference_number || "—"}</p>
                                  <p className="text-xs truncate" style={{ color: "#94a3b8" }}>{d.payee || "—"}</p>
                                </td>
                                <td className="px-3 py-2.5"><p className="text-xs truncate max-w-xs" style={{ color: "#0369a1" }}>{it?.description ?? `#${d.line_item}`}</p></td>
                                <td className="px-3 py-2.5">{it && <CatChip cat={it.category} />}</td>
                                <td className="px-3 py-2.5 text-xs font-mono font-black whitespace-nowrap" style={{ color: "#0d2a5e" }}>{peso(d.amount)}</td>
                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => setSelectedTxn(d.id)} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#e0f2fe", color: "#0369a1" }}>View</button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f0f4f8" }}>
                          <td colSpan={5} className="px-3 py-2.5 text-xs font-black" style={{ color: "#0d2a5e" }}>Total ({filtered.length} txn{filtered.length !== 1 ? "s" : ""})</td>
                          <td className="px-3 py-2.5 text-xs font-mono font-black whitespace-nowrap" style={{ color: "#0d2a5e" }}>{peso(filtered.reduce((s, d) => s + Number(d.amount), 0))}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}

            {tab === "utilization" &&
              (!certified ? (
                needsCertified
              ) : !summary ? (
                <SkeletonRows />
              ) : (
                <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#f0f4f8" }}>
                        {["LIB Item", "Cat", "Adjusted", "Disbursed", "Balance", "Utilization", ""].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {util.map((r) => (
                        <tr key={r.line_item} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                          <td className="px-3 py-3 text-xs font-semibold" style={{ color: "#0d2a5e", maxWidth: "220px" }}>{r.description}</td>
                          <td className="px-3 py-3"><CatChip cat={r.category} /></td>
                          <td className="px-3 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "#334155" }}>{peso(r.adjusted)}</td>
                          <td className="px-3 py-3 text-xs font-mono font-bold whitespace-nowrap" style={{ color: "#0891b2" }}>{peso(r.actual)}</td>
                          <td className="px-3 py-3 text-xs font-mono font-bold whitespace-nowrap" style={{ color: r.available < 0 ? "#dc2626" : "#059669" }}>{peso(r.available)}</td>
                          <td className="px-3 py-3" style={{ minWidth: "180px" }}>
                            <UtilBar pct={Math.round(r.utilization_pct ?? 0)} approved={r.adjusted} disbursed={r.actual} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              {flagsFor(r).map((f) => (
                                <span key={f} title={FLAG_META[f].label} className="text-sm">{FLAG_META[f].icon}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f0f4f8" }}>
                        <td colSpan={2} className="px-3 py-2.5 text-xs font-black" style={{ color: "#0d2a5e" }}>TOTAL (Adjusted)</td>
                        <td className="px-3 py-2.5 text-xs font-mono font-black" style={{ color: "#0d2a5e" }}>{peso(summary.totals.adjusted)}</td>
                        <td className="px-3 py-2.5 text-xs font-mono font-black" style={{ color: "#0891b2" }}>{peso(summary.totals.actual)}</td>
                        <td className="px-3 py-2.5 text-xs font-mono font-black" style={{ color: "#059669" }}>{peso(summary.totals.available)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}

            {tab === "variance" &&
              (!certified ? (
                needsCertified
              ) : !summary ? (
                <SkeletonRows />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.keys(FLAG_META) as FlagType[]).map((f) => {
                      const fm = FLAG_META[f];
                      return (
                        <div key={f} className="rounded-2xl p-4" style={{ background: fm.bg }}>
                          <p className="text-base mb-1">{fm.icon}</p>
                          <p className="text-xs font-bold" style={{ color: fm.color }}>{fm.label}</p>
                          <p className="text-3xl font-black mt-1" style={{ color: fm.color }}>{util.filter((r) => flagsFor(r).includes(f)).length}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Approved vs. Adjusted vs. Actual</p>
                  <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "#f0f4f8" }}>
                          {["LIB Item", "Cat", "Approved", "Adjusted", "Actual", "Variance (Actual − Adjusted)", "Flags"].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {util.map((r) => {
                          const variance = r.actual - r.adjusted;
                          const fl = flagsFor(r);
                          return (
                            <tr key={r.line_item} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                              <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: "#0d2a5e", maxWidth: "200px" }}>{r.description}</td>
                              <td className="px-3 py-2.5"><CatChip cat={r.category} /></td>
                              <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#334155" }}>{peso(r.approved)}</td>
                              <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#334155" }}>{peso(r.adjusted)}</td>
                              <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#0891b2" }}>{peso(r.actual)}</td>
                              <td className="px-3 py-2.5">
                                <Chip bg={variance > 0 ? "#fee2e2" : "#d1fae5"} color={variance > 0 ? "#dc2626" : "#059669"}>
                                  {variance > 0 ? "▲" : "▼"} {peso(Math.abs(variance))}
                                </Chip>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex gap-1 flex-wrap">
                                  {fl.length === 0 ? (
                                    <span className="text-xs" style={{ color: "#059669" }}>✓</span>
                                  ) : (
                                    fl.map((f) => <Chip key={f} bg={FLAG_META[f].bg} color={FLAG_META[f].color}>{FLAG_META[f].icon} {FLAG_META[f].label}</Chip>)
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

            {tab === "adjustments" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Post-Approval Budget Adjustments (Realignments)</p>
                  {canRequest && certified && (
                    <button onClick={() => setShowRealign(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
                      + Request Realignment
                    </button>
                  )}
                </div>
                {summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["Original Approved Budget", summary.totals.approved, "#334155", "#f1f5f9"],
                      ["Current Adjusted Budget", summary.totals.adjusted, "#0891b2", "#e0f2fe"],
                      ["Actual Expenditure", summary.totals.actual, "#059669", "#f0fdf4"],
                      ["Remaining Balance", summary.totals.available, "#ca8a04", "#fef9c3"],
                    ].map(([l, v, c, bg]) => (
                      <div key={l as string} className="rounded-xl p-3" style={{ background: bg as string }}>
                        <p className="text-xs font-bold" style={{ color: "#64748b" }}>{l as string}</p>
                        <p className="text-lg font-black font-mono" style={{ color: c as string }}>{peso(v as number)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {realignments.length === 0 ? (
                  <NoActualData message="No budget adjustments recorded." />
                ) : (
                  <div className="rounded-xl overflow-x-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                    <table className="w-full text-left">
                      <thead style={{ background: "#f8fafc" }}>
                        <tr>
                          {["Date", "From → To", "Amount", "Tier", "Status", "Justification", "Review"].map((h) => (
                            <th key={h} className="px-4 py-2 text-xs font-bold uppercase whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {realignments.map((r) => {
                          const pending = isPending(r.status);
                          const can = pending && canReviewTier(r.tier);
                          return (
                            <tr key={r.id} className="border-t align-top" style={{ borderColor: "#f1f5f9" }}>
                              <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">{r.created_at.slice(0, 10)}</td>
                              <td className="px-4 py-3 text-xs" style={{ maxWidth: "220px" }}>
                                <p style={{ color: "#dc2626" }}>{itemOf(r.from_line_item)?.description ?? `#${r.from_line_item}`}</p>
                                <p style={{ color: "#059669" }}>→ {r.to_line_item ? itemOf(r.to_line_item)?.description ?? `#${r.to_line_item}` : `New: ${r.new_item_description}`}</p>
                              </td>
                              <td className="px-4 py-3 text-xs font-mono font-bold whitespace-nowrap" style={{ color: "#0d2a5e" }}>{peso(r.amount)}</td>
                              <td className="px-4 py-3"><Chip bg={TIER_META[r.tier].bg} color={TIER_META[r.tier].color}>{TIER_META[r.tier].label}</Chip></td>
                              <td className="px-4 py-3">
                                <Chip bg={STATUS_META[r.status].bg} color={STATUS_META[r.status].color}>{STATUS_META[r.status].label}</Chip>
                                {r.bor_resolution_number && <p className="text-xs mt-1 font-mono" style={{ color: "#6b21a8" }}>BOR Res. {r.bor_resolution_number}</p>}
                              </td>
                              <td className="px-4 py-3 text-xs" style={{ color: "#475569", maxWidth: "220px" }}>{r.justification}</td>
                              <td className="px-4 py-3">
                                {can ? (
                                  <div className="space-y-1.5 min-w-40">
                                    {r.tier === "bor" && (
                                      <input
                                        className={INPUT_CLS + " py-1.5 text-xs"}
                                        style={INPUT_STYLE}
                                        placeholder="BOR resolution no."
                                        value={bor[r.id] ?? ""}
                                        onChange={(e) => setBor((b) => ({ ...b, [r.id]: e.target.value }))}
                                      />
                                    )}
                                    <div className="flex gap-1.5">
                                      <button disabled={reviewing === r.id} onClick={() => review(r, "approved")} className="flex-1 px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: "#059669" }}>Approve</button>
                                      <button disabled={reviewing === r.id} onClick={() => review(r, "rejected")} className="flex-1 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: "#fee2e2", color: "#dc2626" }}>Reject</button>
                                    </div>
                                  </div>
                                ) : pending ? (
                                  <span className="text-xs" style={{ color: "#94a3b8" }}>Awaiting {r.tier === "bor" ? "System Admin (BOR)" : "University Admin"}</span>
                                ) : (
                                  <span className="text-xs" style={{ color: "#94a3b8" }}>{r.reviewed_at ? `Reviewed ${r.reviewed_at.slice(0, 10)}` : "Auto-implemented"}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "report" &&
              (!certified || !summary ? (
                needsCertified
              ) : (
                <div className="space-y-5">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Financial Monitoring Report</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      ["Adjusted Approved Budget", summary.totals.adjusted, "#0d2a5e", "#e0eaf7"],
                      ["Total Disbursed", summary.totals.actual, "#0891b2", "#e0f2fe"],
                      ["Remaining Balance", summary.totals.available, summary.totals.available < 0 ? "#dc2626" : "#059669", summary.totals.available < 0 ? "#fee2e2" : "#d1fae5"],
                    ].map(([l, v, c, bg]) => (
                      <div key={l as string} className="rounded-2xl p-4" style={{ background: bg as string }}>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: c as string }}>{l as string}</p>
                        <p className="text-xl font-black font-mono mt-1" style={{ color: c as string }}>{peso(v as number)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Category Breakdown</p>
                    {CATEGORIES.map((cat) => {
                      const cm = CATEGORY_META[cat];
                      const row = summary.by_category.find((c) => c.category === cat);
                      if (!row) return null;
                      const pct = Math.round(row.utilization_pct ?? 0);
                      return (
                        <div key={cat} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                            <p className="font-black text-sm" style={{ color: cm.color }}>{cm.icon} {cm.label} — {cm.full}</p>
                            <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>
                              Balance: <span className="font-bold" style={{ color: row.available < 0 ? "#dc2626" : "#059669" }}>{peso(row.available)}</span>
                            </p>
                          </div>
                          <div className="h-3 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? "#dc2626" : cm.color }} />
                          </div>
                          <div className="flex justify-between text-xs mt-1.5">
                            <span className="font-mono font-bold" style={{ color: cm.color }}>{pct}% utilized</span>
                            <span className="font-mono" style={{ color: "#94a3b8" }}>{peso(row.actual)} of {peso(row.adjusted)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Monthly Disbursements</p>
                    {monthly.length === 0 ? (
                      <NoActualData />
                    ) : (
                      <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                        <div className="flex items-end gap-2 h-32">
                          {monthly.map(([ym, val]) => (
                            <div key={ym} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                              <div className="w-full rounded-t-lg" style={{ height: `${Math.round((val / maxMonthly) * 100)}%`, minHeight: "4px", background: "#0891b2" }} />
                              <div className="absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap text-xs font-bold px-2 py-1 rounded-lg z-10" style={{ background: "#0d2a5e", color: "white" }}>
                                {peso(val)}
                              </div>
                              <p className="font-mono text-center" style={{ color: "#94a3b8", fontSize: "8px" }}>{ym.slice(5)}/{ym.slice(2, 4)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {showRecord && budget && (
        <RecordModal
          budget={budget}
          summary={summary}
          documents={documents}
          onClose={() => setShowRecord(false)}
          onSaved={() => {
            setShowRecord(false);
            reload();
          }}
        />
      )}
      {showRealign && budget && (
        <RealignModal
          budget={budget}
          onClose={() => setShowRealign(false)}
          onSaved={() => {
            setShowRealign(false);
            reload();
          }}
        />
      )}
      {selected && (
        <TxnDetailModal
          txn={selected}
          seq={seqOf(selected.id)}
          item={itemOf(selected.line_item)}
          doc={documents.find((d) => d.id === selected.supporting_document)}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </div>
  );
}

function DisbursementsContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canDisburse = DISBURSEMENT_ROLE_CODES.includes(code);
  const canRequest = REALIGNMENT_REQUEST_ROLE_CODES.includes(code);
  const canReviewTier = (t: RealignmentTier) => (t === "bor" ? REALIGNMENT_BOR_REVIEW_ROLE_CODES : REALIGNMENT_MAJOR_REVIEW_ROLE_CODES).includes(code);
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [budgets, setBudgets] = useState<LineItemBudget[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [realignments, setRealignments] = useState<BudgetRealignment[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([researchApi.getProjects(), budgetApi.getBudgets(), financialApi.getDisbursements(), financialApi.getRealignments()])
      .then(([p, b, d, r]) => {
        if (!active) return;
        setProjects(p);
        setBudgets(b);
        setDisbursements(d);
        setRealignments(r);
      })
      .catch(() => {
        if (!active) return;
        setProjects([]);
        notify.error("Could not load financial records. Check your connection and refresh.");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const selected = projects?.find((p) => p.id === Number(params.get("project")));
  if (selected) {
    return (
      <ProjectBoard
        project={selected}
        canDisburse={canDisburse}
        canRequest={canRequest}
        canReviewTier={canReviewTier}
        onBack={() => setParams({})}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  const current = budgets.filter((b) => b.is_current);
  const itemProject = new Map(budgets.flatMap((b) => b.line_items.map((li) => [li.id, b.project] as const)));
  const disbOf = (pid: number) => disbursements.filter((d) => itemProject.get(d.line_item) === pid);
  const pendingOf = (pid: number) => realignments.filter((r) => isPending(r.status) && itemProject.get(r.from_line_item) === pid).length;
  const certified = current.filter((b) => b.status === "certified");
  const kpis = [
    { label: "Total Disbursed", val: peso(disbursements.reduce((s, d) => s + Number(d.amount), 0)), mono: true, color: "#0d2a5e" },
    { label: "Certified LIB Total", val: peso(certified.reduce((s, b) => s + Number(b.total_amount), 0)), mono: true, color: "#166534" },
    { label: "Transactions", val: String(disbursements.length), mono: false, color: "#0369a1" },
    { label: "Certified LIBs", val: String(certified.length), mono: false, color: "#166534" },
    { label: "Pending Realignments", val: String(realignments.filter((r) => isPending(r.status)).length), mono: false, color: "#92400e" },
    { label: "Rejected", val: String(realignments.filter((r) => r.status === "rejected").length), mono: false, color: "#991b1b" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
            <p className={`font-black mt-1 ${s.mono ? "text-lg font-mono" : "text-3xl"}`} style={{ color: s.color }}>{projects === null ? "…" : s.val}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="font-black text-lg mb-3" style={{ color: "#0d2a5e" }}>Select Project</p>
        <div className="space-y-3">
          {projects === null ? (
            <SkeletonRows rows={2} />
          ) : projects.length === 0 ? (
            <NoActualData />
          ) : (
            projects.map((proj) => {
              const lib = current.find((b) => b.project === proj.id);
              const txns = disbOf(proj.id);
              const total = txns.reduce((s, d) => s + Number(d.amount), 0);
              const pending = pendingOf(proj.id);
              const libTotal = Number(lib?.total_amount ?? 0);
              const pct = libTotal > 0 ? Math.round((total / libTotal) * 100) : 0;
              return (
                <div
                  key={proj.id}
                  onClick={() => setParams({ project: String(proj.id) })}
                  className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:border-[#0891b2] hover:-translate-y-px"
                  style={{ background: "white", border: "1px solid #e2e8f0" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0369a1" }}>{proj.project_code}</span>
                        {proj.campus && <Chip bg="#e0f2fe" color="#0891b2">{proj.campus}</Chip>}
                        {lib?.status === "certified" ? (
                          <Chip bg="#d1fae5" color="#166534">✓ Certified LIB</Chip>
                        ) : lib ? (
                          <Chip bg="#fef3c7" color="#92400e">⚠ LIB not certified</Chip>
                        ) : (
                          <Chip bg="#fef3c7" color="#92400e">⚠ No LIB</Chip>
                        )}
                        {pending > 0 && <Chip bg="#faf5ff" color="#6b21a8">{pending} pending realignment{pending !== 1 ? "s" : ""}</Chip>}
                      </div>
                      <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{proj.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{txns.length} transactions</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black font-mono" style={{ color: "#0d2a5e" }}>{peso(total)}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>disbursed</p>
                    </div>
                  </div>
                  {lib?.status === "certified" && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: "#94a3b8" }}>Utilization vs. certified LIB</span>
                        <span className="font-mono font-bold" style={{ color: "#0891b2" }}>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? "#dc2626" : "#0891b2" }} />
                      </div>
                    </div>
                  )}
                  {txns.length === 0 && (
                    <p className="mt-3 text-xs text-center py-2 rounded-xl" style={{ background: "#f0f4f8", color: "#94a3b8" }}>
                      {lib?.status === "certified" ? "No disbursements recorded yet" : "Disbursements open once the LIB is certified"}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function DisbursementsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Financial Monitoring">
        <DisbursementsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
