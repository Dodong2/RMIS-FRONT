import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { budgetApi } from "../lib/budgetApi";
import { financialApi } from "../lib/financialApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useBudgets, useProjects } from "../lib/queries";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type { LineItem, LineItemBudget, LineItemCategory } from "../types/budget";
import type { ProcurementRequest, ProcurementStatus, ProcurementUpdateStatus } from "../types/financial";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { MoneyInput } from "../components/common/MoneyInput";
import { Field, SkeletonRows } from "../components/common/proto";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { PROCUREMENT_EVENTS, useRealtime } from "../hooks/useRealtime";

const REQUEST_ROLE_CODES = ["system_admin", "program_leader", "project_leader"];
const UPDATE_ROLE_CODES = ["system_admin", "procurement_officer_lib"];
const DELAY_DAYS = 30;

const CATEGORY_META: Record<LineItemCategory, { label: string; full: string; color: string; bg: string; icon: string }> = {
  ps: { label: "PS", full: "Personal Services", color: "#0d2a5e", bg: "#e0eaf7", icon: "👤" },
  mooe: { label: "MOOE", full: "Maintenance & Other Operating Expenses", color: "#0891b2", bg: "#e0f2fe", icon: "🧾" },
  co: { label: "CO", full: "Capital Outlay", color: "#059669", bg: "#d1fae5", icon: "🏗️" },
};
const CATEGORIES = Object.keys(CATEGORY_META) as LineItemCategory[];

const STATUS_META: Record<ProcurementStatus, { label: string; bg: string; color: string; dot: string }> = {
  requested: { label: "Request Submitted", bg: "#e0eaf7", color: "#0d2a5e", dot: "#0d2a5e" },
  under_review: { label: "Under Review", bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  returned_for_revision: { label: "Returned for Revision", bg: "#fef08a", color: "#b45309", dot: "#d97706" },
  for_procurement: { label: "For Procurement", bg: "#e0f2fe", color: "#0369a1", dot: "#0891b2" },
  procurement_in_progress: { label: "Procurement in Progress", bg: "#dbeafe", color: "#0284c7", dot: "#0284c7" },
  order_placed: { label: "Order Placed", bg: "#bfdbfe", color: "#1d4ed8", dot: "#1d4ed8" },
  awaiting_delivery: { label: "Awaiting Delivery", bg: "#ffedd5", color: "#a16207", dot: "#f59e0b" },
  delivered: { label: "Delivered", bg: "#ccfbf1", color: "#0f766e", dot: "#14b8a6" },
  ready_for_release: { label: "Ready for Release", bg: "#d1fae5", color: "#166534", dot: "#22c55e" },
  completed: { label: "Completed", bg: "#86efac", color: "#065f46", dot: "#059669" },
  cancelled: { label: "Cancelled", bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
};

const UPDATE_STATUSES: ProcurementUpdateStatus[] = [
  "returned_for_revision",
  "for_procurement",
  "procurement_in_progress",
  "order_placed",
  "awaiting_delivery",
  "delivered",
  "ready_for_release",
  "completed",
];
const CLOSED: ProcurementStatus[] = ["completed", "cancelled"];
const isOpen = (r: ProcurementRequest) => !CLOSED.includes(r.status);
const prNo = (r: ProcurementRequest) => `PR-${String(r.id).padStart(4, "0")}`;

const ROUTING_LABELS: Record<string, string> = {
  university_president: "University President (> ₱25,000)",
  campus_director: "Campus Director (≤ ₱25,000)",
};

const PIPELINE: ProcurementStatus[] = [
  "requested",
  "under_review",
  "for_procurement",
  "procurement_in_progress",
  "order_placed",
  "awaiting_delivery",
  "delivered",
  "ready_for_release",
  "completed",
];

type Tab = "requests" | "worklist";

const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));

function StatusBadge({ s }: { s: ProcurementStatus }) {
  const m = STATUS_META[s];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: m.bg, color: m.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function Pipeline({ status }: { status: ProcurementStatus }) {
  const idx = PIPELINE.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {PIPELINE.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-full"
            title={STATUS_META[s].label}
            style={{ background: status === "cancelled" ? "#e2e8f0" : i <= idx ? STATUS_META[s].dot : "#e2e8f0" }}
          />
          {i < PIPELINE.length - 1 && <div className="w-1.5 h-px" style={{ background: status !== "cancelled" && i < idx ? "#22c55e" : "#e2e8f0" }} />}
        </div>
      ))}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4 pb-4" style={{ background: "rgba(8,26,61,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[95vh]" style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-start justify-between gap-3 shrink-0" style={{ background: "#0d2a5e" }}>
          <div className="min-w-0">
            <p className="text-white font-bold">{title}</p>
            {subtitle && <p className="text-white/50 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white shrink-0" aria-label="Close">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">{children}</div>
        <div className="px-6 py-4 border-t flex gap-3 shrink-0" style={{ borderColor: "#e2e8f0" }}>{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

function NewRequestModal({ projects, budgets, onClose, onSaved }: { projects: Project[]; budgets: LineItemBudget[]; onClose: () => void; onSaved: () => void }) {
  const thisYear = new Date().getFullYear();
  const certified = budgets.filter((b) => b.is_current && b.status === "certified");
  const eligible = projects.filter((p) => certified.some((b) => b.project === p.id));
  const [form, setForm] = useState({
    project: eligible[0] ? String(eligible[0].id) : "",
    line_item: "",
    description: "",
    amount: "",
    fiscal_year: String(thisYear),
    quarter: String(Math.floor(new Date().getMonth() / 3) + 1),
    remarks: "",
  });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const lib = certified.find((b) => String(b.project) === form.project);
  const firstCategory = (b?: LineItemBudget) => CATEGORIES.find((c) => b?.line_items.some((li) => li.category === c)) ?? "mooe";
  const [cat, setCat] = useState<LineItemCategory>(() => firstCategory(lib));
  const catItems = (lib?.line_items ?? []).filter((li) => li.category === cat);
  const amount = parseFloat(form.amount) || 0;

  const save = async () => {
    setAttempted(true);
    if (!form.line_item || !form.description.trim() || amount <= 0 || !form.fiscal_year) {
      notify.error("Line item, description, amount, and fiscal year are required.");
      return;
    }
    setSaving(true);
    try {
      await financialApi.createProcurementRequest({
        line_item: Number(form.line_item),
        description: form.description.trim(),
        amount: amount.toFixed(2),
        fiscal_year: Number(form.fiscal_year),
        quarter: Number(form.quarter),
        remarks: form.remarks.trim() || undefined,
      }, requestKey);
      notify.success("Procurement request filed.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not file the procurement request."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New Procurement Request"
      subtitle="Quarterly request against a certified LIB item · routed by amount"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving || eligible.length === 0} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Filing…" : "File Request"}
          </button>
        </>
      }
    >
      {eligible.length === 0 ? (
        <NoActualData message="No project with a certified LIB yet" hint="Procurement can only be requested against a certified budget." />
      ) : (
        <>
          <Field label="Project" required>
            <select
              className={INPUT_CLS}
              style={INPUT_STYLE}
              value={form.project}
              onChange={(e) => {
                const project = e.target.value;
                setForm((f) => ({ ...f, project, line_item: "" }));
                setCat(firstCategory(certified.find((b) => String(b.project) === project)));
              }}
            >
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Expense Category" required>
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
          <Field label="Link to LIB Item" required>
            <select className={INPUT_CLS} style={invalidStyle(attempted && !form.line_item)} value={form.line_item} onChange={set("line_item")}>
              <option value="">{catItems.length ? "— Select LIB line item —" : `No ${CATEGORY_META[cat].label} items in this LIB`}</option>
              {catItems.map((li) => (
                <option key={li.id} value={li.id}>{li.description} · {peso(li.amount)}</option>
              ))}
            </select>
          </Field>
          <Field label="Description" required>
            <input className={INPUT_CLS} style={invalidStyle(attempted && !form.description.trim())} value={form.description} onChange={set("description")} placeholder="Goods/services to procure" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Amount (₱)" required>
              <MoneyInput className={INPUT_CLS} style={invalidStyle(attempted && amount <= 0)} value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} />
            </Field>
            <Field label="Fiscal Year" required>
              <input type="number" className={INPUT_CLS} style={INPUT_STYLE} value={form.fiscal_year} onChange={set("fiscal_year")} />
            </Field>
            <Field label="Quarter" required>
              <select className={INPUT_CLS} style={INPUT_STYLE} value={form.quarter} onChange={set("quarter")}>
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </Field>
          </div>
          {amount > 0 && (
            <div className="rounded-xl px-4 py-2.5 text-xs font-bold" style={amount > 25000 ? { background: "#faf5ff", color: "#6b21a8" } : { background: "#e0f2fe", color: "#0369a1" }}>
              Routed to: {amount > 25000 ? ROUTING_LABELS.university_president : ROUTING_LABELS.campus_director}
            </div>
          )}
          <Field label="Remarks">
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={form.remarks} onChange={set("remarks")} />
          </Field>
        </>
      )}
    </Modal>
  );
}

function ResubmitModal({ request, onClose, onSaved }: { request: ProcurementRequest; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ description: request.description, amount: request.amount, remarks: "" });
  const [saving, setSaving] = useState(false);
  const amount = parseFloat(form.amount) || 0;

  const save = async () => {
    if (!form.description.trim() || amount <= 0) {
      notify.error("Description and amount are required.");
      return;
    }
    setSaving(true);
    try {
      await financialApi.resubmitProcurementRequest(request.id, {
        description: form.description.trim(),
        amount: amount.toFixed(2),
        remarks: form.remarks.trim() || undefined,
      });
      notify.success("Procurement request resubmitted.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not resubmit the request."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Revise & Resubmit"
      subtitle={`${prNo(request)} · returned for revision by the Procurement Office`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Resubmitting…" : "Resubmit Request"}
          </button>
        </>
      }
    >
      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#fef9c3", border: "1px solid #fde047", color: "#854d0e" }}>
        <p className="font-bold">Procurement Office remarks</p>
        <p className="mt-0.5">{request.remarks || "—"}</p>
      </div>
      <Field label="Description" required>
        <input className={INPUT_CLS} style={INPUT_STYLE} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </Field>
      <Field label="Amount (₱)" required>
        <MoneyInput className={INPUT_CLS} style={INPUT_STYLE} value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} />
      </Field>
      <Field label="Remarks">
        <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="What you changed" />
      </Field>
    </Modal>
  );
}

function StatusNoteModal({ status, onCancel, onConfirm }: { status: ProcurementUpdateStatus; onCancel: () => void; onConfirm: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const required = status === "returned_for_revision";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Status Update Details</h3>
          <p className="text-xs text-slate-500 mt-1">
            {required ? "Provide mandatory remarks or justification for changing status to " : "Add optional remarks before changing status to "}
            <strong>{STATUS_META[status].label}</strong>.
          </p>
        </div>
        <div className="p-5">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes, justification, or remarks..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
          <button
            disabled={saving || (required && !note.trim())}
            onClick={async () => {
              setSaving(true);
              await onConfirm(note.trim());
              setSaving(false);
            }}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PendingProcurementView({ requests, projectOf, itemsById, onBack, onChanged }: {
  requests: ProcurementRequest[] | null;
  projectOf: (id: number | undefined) => Project | undefined;
  itemsById: Map<number, LineItem>;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [noting, setNoting] = useState<{ request: ProcurementRequest; status: ProcurementUpdateStatus } | null>(null);

  const receive = async (r: ProcurementRequest) => {
    setBusy(r.id);
    try {
      await financialApi.receiveProcurementRequest(r.id);
      notify.success(`${prNo(r)} marked received. ${r.requested_by_name} has been notified.`);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not mark the request received."));
    } finally {
      setBusy(null);
    }
  };

  const update = async (r: ProcurementRequest, status: ProcurementUpdateStatus, remarks?: string) => {
    setBusy(r.id);
    try {
      await financialApi.updateProcurementStatus(r.id, status, remarks || undefined);
      notify.success(`${prNo(r)} is now ${STATUS_META[status].label}.`);
      setNoting(null);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the request."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-700">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          Procurement
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-xs font-mono font-semibold text-slate-500">Pending Procurement Requests</span>
      </div>

      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
          <p className="text-white font-black text-lg">Active Procurement Tracking</p>
          <p className="text-sm text-blue-200 mt-1">Review, approve, and update the status of active procurement requests.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Request No.</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Project / Item</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-500">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Justification</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests === null ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">No active procurement requests found.</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 text-xs font-mono font-bold text-blue-700 whitespace-nowrap">{prNo(r)}</td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 inline-block mb-1">{projectOf(r.project)?.project_code ?? `#${r.project}`}</p>
                      <p className="text-xs font-semibold text-slate-700">{itemsById.get(r.line_item)?.description ?? `Line item #${r.line_item}`}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Req by {r.requested_by_name}</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono font-black text-slate-800 text-right whitespace-nowrap">{peso(r.amount)}</td>
                    <td className="px-5 py-4 text-xs text-slate-500 max-w-xs">
                      {r.description}
                      {r.remarks && <p className="mt-0.5 text-slate-400">{r.remarks}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide whitespace-nowrap" style={{ background: STATUS_META[r.status].bg, color: STATUS_META[r.status].color }}>
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {r.status === "requested" ? (
                        <button disabled={busy === r.id} onClick={() => receive(r)} className="w-40 px-2 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                          {busy === r.id ? "Saving…" : "✓ Received"}
                        </button>
                      ) : r.status === "returned_for_revision" ? (
                        <span className="text-xs text-slate-400">Awaiting leader's revision</span>
                      ) : (
                        <select
                          className="text-xs font-semibold px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-40"
                          value=""
                          disabled={busy === r.id}
                          onChange={(e) => {
                            const status = e.target.value as ProcurementUpdateStatus;
                            if (status === "returned_for_revision" || status === "completed") setNoting({ request: r, status });
                            else update(r, status);
                          }}
                        >
                          <option value="" disabled>Update Status...</option>
                          {UPDATE_STATUSES.map((s) => (
                            <option key={s} value={s} disabled={r.status === s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {noting && (
        <StatusNoteModal
          status={noting.status}
          onCancel={() => setNoting(null)}
          onConfirm={(note) => update(noting.request, noting.status, note)}
        />
      )}
    </div>
  );
}

function ProcurementContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canRequest = REQUEST_ROLE_CODES.includes(code);
  const canUpdate = UPDATE_ROLE_CODES.includes(code);

  const queryClient = useQueryClient();
  const projectsQ = useProjects();
  const budgetsQ = useBudgets();
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const budgets = useMemo(() => budgetsQ.data ?? [], [budgetsQ.data]);
  const listsFailed = projectsQ.isError || budgetsQ.isError;
  const [requests, setRequests] = useState<ProcurementRequest[] | null>(null);
  const [appItems, setAppItems] = useState<LineItem[] | null>(null);
  const [overdueIds, setOverdueIds] = useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [params, setParams] = useSearchParams();
  const focusId = Number(params.get("request")) || null;
  const showPending = canUpdate && params.get("view") === "pending";
  const [chosenTab, setTab] = useState<Tab>("requests");
  const tab: Tab = focusId ? "requests" : chosenTab;
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProcurementStatus | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pendingList, setPendingList] = useState<ProcurementRequest[] | null>(null);
  const [resubmitting, setResubmitting] = useState<ProcurementRequest | null>(null);

  useEffect(() => {
    if (!canUpdate) return;
    let active = true;
    financialApi
      .getProcurementRequests({ active: true })
      .then((r) => active && setPendingList(r))
      .catch(() => {
        if (!active) return;
        setPendingList([]);
        notify.error("Could not load pending procurement requests.");
      });
    return () => {
      active = false;
    };
  }, [canUpdate, reloadKey]);

  useEffect(() => {
    let active = true;
    financialApi
      .getProcurementRequests({ overdue: true })
      .then((r) => active && setOverdueIds(new Set(r.map((x) => x.id))))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (listsFailed) notify.error("Could not load projects or budgets.");
  }, [listsFailed]);

  const reload = () => {
    setReloadKey((k) => k + 1);
    queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
    queryClient.invalidateQueries({ queryKey: queryKeys.financialAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.budgetSummaries });
  };
  useRealtime(PROCUREMENT_EVENTS, reload);

  useEffect(() => {
    if (focusId) document.getElementById(`pr-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, requests]);

  useEffect(() => {
    let active = true;
    const project = projectFilter ? Number(projectFilter) : undefined;
    financialApi
      .getProcurementRequests({ project })
      .then((r) => active && setRequests(r))
      .catch(() => {
        if (!active) return;
        setRequests([]);
        notify.error("Could not load procurement requests.");
      });
    budgetApi
      .getLineItems({ project, is_app_flagged: true })
      .then((i) => active && setAppItems(i))
      .catch(() => active && setAppItems([]));
    return () => {
      active = false;
    };
  }, [projectFilter, reloadKey]);

  const budgetsById = useMemo(() => new Map(budgets.map((b) => [b.id, b])), [budgets]);
  const itemsById = useMemo(() => new Map(budgets.flatMap((b) => b.line_items.map((li) => [li.id, li] as const))), [budgets]);
  const projectOf = (id: number | undefined) => projects.find((p) => p.id === id);
  // KPIs count every request of the selected project(s); the status/delayed filters only narrow the table.
  const all = requests ?? [];
  const shown = all.filter((r) => r.id === focusId || ((!statusFilter || r.status === statusFilter) && (!overdueOnly || overdueIds.has(r.id))));

  const kpis = [
    { label: "Total Requests", val: all.length, color: "#0d2a5e" },
    { label: "Ongoing", val: all.filter(isOpen).length, color: "#92400e" },
    { label: "Completed", val: all.filter((r) => r.status === "completed").length, color: "#166534" },
    { label: "Returned for Revision", val: all.filter((r) => r.status === "returned_for_revision").length, color: "#b45309" },
    { label: `Delayed (>${DELAY_DAYS}d)`, val: all.filter((r) => overdueIds.has(r.id)).length, color: "#dc2626" },
    { label: "Open Amount", val: peso(all.filter(isOpen).reduce((s, r) => s + Number(r.amount), 0)), color: "#0d2a5e", mono: true },
  ];

  if (showPending) {
    return (
      <PendingProcurementView
        requests={pendingList}
        projectOf={projectOf}
        itemsById={itemsById}
        onBack={() => setParams({})}
        onChanged={reload}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
            <p className={`font-black mt-1 ${s.mono ? "text-lg font-mono" : "text-3xl"}`} style={{ color: s.color }}>{requests === null ? "…" : s.val}</p>
          </div>
        ))}
      </div>

      {canUpdate && (
        <div
          onClick={() => setParams({ view: "pending" })}
          className="rounded-2xl p-5 cursor-pointer hover:shadow-lg transition-all border border-blue-200 bg-blue-50 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-lg text-blue-900">Manage Pending Procurement Requests</p>
              <p className="text-sm text-blue-700 mt-0.5">Review, approve, or decline procurement requests from Project Leaders.</p>
            </div>
          </div>
          <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full whitespace-nowrap">
            {pendingList === null ? "…" : pendingList.length} Active
          </span>
        </div>
      )}

      <div className="rounded-xl p-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
        Fund release goes through the Procurement Office: Request Submitted → Received (Under Review) → For Procurement → … → Completed. A request returned for revision goes back to its leader to revise and resubmit. Requests above ₱25,000 route to the University President; ₱25,000 and below to the Campus Director. Requests open longer than {DELAY_DAYS} days are flagged as delayed.
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-2" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex overflow-x-auto">
            {(
              [
                ["requests", "Procurement Requests"],
                ["worklist", "APP Worklist (> ₱50,000)"],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => {
                  setTab(k);
                  if (focusId) setParams({});
                }}
                className="px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all"
                style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}
              >
                {l}
              </button>
            ))}
          </div>
          {canRequest && tab === "requests" && (
            <button onClick={() => setShowNew(true)} className="mr-3 my-2 px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
              + New Request
            </button>
          )}
        </div>

        <div className="p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
              style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_code}</option>
              ))}
            </select>
            {tab === "requests" && (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProcurementStatus | "")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
                  style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
                >
                  <option value="">All statuses</option>
                  {(Object.keys(STATUS_META) as ProcurementStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setOverdueOnly((v) => !v)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={overdueOnly ? { background: "#fee2e2", color: "#dc2626" } : { background: "#f1f5f9", color: "#64748b" }}
                >
                  {overdueOnly ? "⚠ Delayed only" : "Show delayed only"}
                </button>
              </>
            )}
          </div>

          {tab === "requests" &&
            (requests === null ? (
              <SkeletonRows />
            ) : shown.length === 0 ? (
              <NoActualData hint={canRequest ? 'Click "New Request" to file one against a certified LIB item.' : undefined} />
            ) : (
              <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f0f4f8" }}>
                      {["Ref", "Project / Item", "Description", "Amount", "FY/Q", "Routing", "Status", "Action"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const item = itemsById.get(r.line_item);
                      const delayed = overdueIds.has(r.id);
                      return (
                        <tr
                          key={r.id}
                          id={`pr-${r.id}`}
                          className="border-t align-top hover:bg-slate-50"
                          style={{ borderColor: "#f1f5f9", background: r.id === focusId ? "#fef9c3" : undefined }}
                        >
                          <td className="px-3 py-2.5 text-xs font-mono font-bold whitespace-nowrap" style={{ color: "#94a3b8" }}>
                            {prNo(r)}
                            <p className="font-sans font-normal" style={{ color: "#94a3b8" }}>{r.requested_at.slice(0, 10)}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ maxWidth: "200px" }}>
                            <p className="font-mono font-bold" style={{ color: "#0891b2" }}>{projectOf(r.project)?.project_code ?? `#${r.project}`}</p>
                            <p className="truncate" style={{ color: "#64748b" }}>{item?.description ?? `Line item #${r.line_item}`}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "#0d2a5e", maxWidth: "220px" }}>
                            {r.description}
                            {r.remarks && <p className="mt-0.5" style={{ color: "#94a3b8" }}>{r.remarks}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono font-black whitespace-nowrap" style={{ color: "#0d2a5e" }}>{peso(r.amount)}</td>
                          <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: "#64748b" }}>{r.fiscal_year} Q{r.quarter}</td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: r.routed_to === "university_president" ? "#6b21a8" : "#0369a1" }}>{ROUTING_LABELS[r.routed_to] ?? r.routed_to}</td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-1">
                              <StatusBadge s={r.status} />
                              <Pipeline status={r.status} />
                              {delayed && <p className="text-xs font-bold" style={{ color: "#dc2626" }}>⚠ Delayed</p>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "#94a3b8" }}>
                            {r.status === "returned_for_revision" && canRequest ? (
                              <button onClick={() => setResubmitting(r)} className="px-2 py-1 rounded-lg text-xs font-bold text-white whitespace-nowrap" style={{ background: "#d97706" }}>
                                Revise & Resubmit
                              </button>
                            ) : r.status === "requested" ? (
                              "Awaiting Procurement Office"
                            ) : r.status === "completed" ? (
                              `Done${r.completed_at ? ` ${r.completed_at.slice(0, 10)}` : ""}`
                            ) : r.status === "cancelled" ? (
                              "Closed"
                            ) : r.received_by_name ? (
                              `Received by ${r.received_by_name}`
                            ) : (
                              "In progress"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === "worklist" &&
            (appItems === null ? (
              <SkeletonRows />
            ) : appItems.length === 0 ? (
              <NoActualData hint="Line items over ₱50,000 must go through the Annual Procurement Plan." />
            ) : (
              <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f0f4f8" }}>
                      {["Project", "LIB", "Category", "Description", "Fiscal Year", "Amount"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appItems.map((item) => {
                      const b = budgetsById.get(item.budget);
                      const p = projectOf(b?.project);
                      const cm = CATEGORY_META[item.category];
                      return (
                        <tr key={item.id} className="border-t hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                          <td className="px-3 py-2.5 text-xs" style={{ maxWidth: "220px" }}>
                            <p className="font-mono font-bold" style={{ color: "#0891b2" }}>{p?.project_code ?? "—"}</p>
                            <p className="truncate" style={{ color: "#64748b" }}>{p?.title}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: "#64748b" }}>{b ? `v${b.version_number} · ${b.status}` : "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: cm.bg, color: cm.color }}>{cm.icon} {cm.label}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: "#0d2a5e" }}>{item.description}</td>
                          <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "#64748b" }}>{item.fiscal_year ?? "—"}</td>
                          <td className="px-3 py-2.5 text-xs font-mono font-black whitespace-nowrap" style={{ color: "#0d2a5e" }}>{peso(item.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>

      {resubmitting && (
        <ResubmitModal
          request={resubmitting}
          onClose={() => setResubmitting(null)}
          onSaved={() => {
            setResubmitting(null);
            reload();
          }}
        />
      )}

      {showNew && (
        <NewRequestModal
          projects={projects}
          budgets={budgets}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

export default function ProcurementPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Procurement">
        <ProcurementContent />
      </AppShell>
    </ProtectedRoute>
  );
}
