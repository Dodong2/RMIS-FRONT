import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { budgetApi } from "../lib/budgetApi";
import { financialApi } from "../lib/financialApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type { LineItem, LineItemBudget, LineItemCategory } from "../types/budget";
import type { ProcurementRequest, ProcurementStatus } from "../types/financial";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { Field, SkeletonRows } from "../components/common/proto";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const REQUEST_ROLE_CODES = ["system_admin", "program_leader", "project_leader"];
const UPDATE_ROLE_CODES = ["system_admin", "procurement_officer_lib"];
const DELAY_DAYS = 30;

const CATEGORY_META: Record<LineItemCategory, { label: string; color: string; bg: string; icon: string }> = {
  ps: { label: "PS", color: "#0d2a5e", bg: "#e0eaf7", icon: "👤" },
  mooe: { label: "MOOE", color: "#0891b2", bg: "#e0f2fe", icon: "🧾" },
  co: { label: "CO", color: "#059669", bg: "#d1fae5", icon: "🏗️" },
};

const STATUS_META: Record<ProcurementStatus, { label: string; bg: string; color: string; dot: string }> = {
  requested: { label: "Requested", bg: "#e0f2fe", color: "#0369a1", dot: "#0891b2" },
  processing: { label: "Processing", bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  released: { label: "Released", bg: "#d1fae5", color: "#166534", dot: "#22c55e" },
  cancelled: { label: "Cancelled", bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
};

const ROUTING_LABELS: Record<string, string> = {
  university_president: "University President (> ₱25,000)",
  campus_director: "Campus Director (≤ ₱25,000)",
};

const PIPELINE: ProcurementStatus[] = ["requested", "processing", "released"];

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
          {i < PIPELINE.length - 1 && <div className="w-4 h-px" style={{ background: status !== "cancelled" && i < idx ? "#22c55e" : "#e2e8f0" }} />}
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
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const lib = certified.find((b) => String(b.project) === form.project);
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
      });
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
            <select className={INPUT_CLS} style={INPUT_STYLE} value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value, line_item: "" }))}>
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
              ))}
            </select>
          </Field>
          <Field label="LIB Line Item" required>
            <select className={INPUT_CLS} style={invalidStyle(attempted && !form.line_item)} value={form.line_item} onChange={set("line_item")}>
              <option value="">Select line item</option>
              {(lib?.line_items ?? []).map((li) => (
                <option key={li.id} value={li.id}>{CATEGORY_META[li.category].label} — {li.description} ({peso(li.amount)})</option>
              ))}
            </select>
          </Field>
          <Field label="Description" required>
            <input className={INPUT_CLS} style={invalidStyle(attempted && !form.description.trim())} value={form.description} onChange={set("description")} placeholder="Goods/services to procure" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Amount (₱)" required>
              <input type="number" min="0" step="0.01" className={INPUT_CLS} style={invalidStyle(attempted && amount <= 0)} value={form.amount} onChange={set("amount")} />
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

function ProcurementContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canRequest = REQUEST_ROLE_CODES.includes(code);
  const canUpdate = UPDATE_ROLE_CODES.includes(code);

  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<LineItemBudget[]>([]);
  const [requests, setRequests] = useState<ProcurementRequest[] | null>(null);
  const [appItems, setAppItems] = useState<LineItem[] | null>(null);
  const [overdueIds, setOverdueIds] = useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>("requests");
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProcurementStatus | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [remarks, setRemarks] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    Promise.all([researchApi.getProjects(), budgetApi.getBudgets()])
      .then(([p, b]) => {
        if (!active) return;
        setProjects(p);
        setBudgets(b);
      })
      .catch(() => active && notify.error("Could not load projects or budgets."));
    financialApi
      .getProcurementRequests({ overdue: true })
      .then((r) => active && setOverdueIds(new Set(r.map((x) => x.id))))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    const project = projectFilter ? Number(projectFilter) : undefined;
    financialApi
      .getProcurementRequests({ project, status: statusFilter || undefined, overdue: overdueOnly })
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
  }, [projectFilter, statusFilter, overdueOnly, reloadKey]);

  const budgetsById = useMemo(() => new Map(budgets.map((b) => [b.id, b])), [budgets]);
  const itemsById = useMemo(() => new Map(budgets.flatMap((b) => b.line_items.map((li) => [li.id, li] as const))), [budgets]);
  const projectOf = (id: number | undefined) => projects.find((p) => p.id === id);
  const all = requests ?? [];

  const move = async (r: ProcurementRequest, status: "processing" | "released" | "cancelled") => {
    setBusy(r.id);
    try {
      await financialApi.updateProcurementStatus(r.id, status, remarks[r.id]?.trim() || undefined);
      notify.success(`Request moved to ${STATUS_META[status].label}.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the request."));
    } finally {
      setBusy(null);
    }
  };

  const kpis = [
    { label: "Requested", val: all.filter((r) => r.status === "requested").length, color: "#0369a1" },
    { label: "Processing", val: all.filter((r) => r.status === "processing").length, color: "#92400e" },
    { label: "Released", val: all.filter((r) => r.status === "released").length, color: "#166534" },
    { label: `Delayed (>${DELAY_DAYS}d)`, val: overdueIds.size, color: "#dc2626" },
    { label: "Open Amount", val: peso(all.filter((r) => r.status === "requested" || r.status === "processing").reduce((s, r) => s + Number(r.amount), 0)), color: "#0d2a5e", mono: true },
    { label: "APP-Flagged Items", val: appItems?.length ?? "…", color: "#6b21a8" },
  ];

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

      <div className="rounded-xl p-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
        Fund release goes through the Procurement Office: Requested → Processing → Released. Requests above ₱25,000 route to the University President; ₱25,000 and below to the Campus Director. Requests open longer than {DELAY_DAYS} days are flagged as delayed.
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
                onClick={() => setTab(k)}
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
            ) : all.length === 0 ? (
              <NoActualData hint={canRequest ? 'Click "New Request" to file one against a certified LIB item.' : undefined} />
            ) : (
              <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f0f4f8" }}>
                      {["Ref", "Project / Item", "Description", "Amount", "FY/Q", "Routing", "Status", ...(canUpdate ? ["Action"] : [])].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {all.map((r) => {
                      const item = itemsById.get(r.line_item);
                      const delayed = overdueIds.has(r.id);
                      return (
                        <tr key={r.id} className="border-t align-top hover:bg-slate-50" style={{ borderColor: "#f1f5f9" }}>
                          <td className="px-3 py-2.5 text-xs font-mono font-bold whitespace-nowrap" style={{ color: "#94a3b8" }}>
                            PR-{String(r.id).padStart(4, "0")}
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
                          {canUpdate && (
                            <td className="px-3 py-2.5">
                              {r.status === "requested" || r.status === "processing" ? (
                                <div className="space-y-1.5 min-w-40">
                                  <input
                                    className={INPUT_CLS + " py-1.5 text-xs"}
                                    style={INPUT_STYLE}
                                    placeholder="Remarks (optional)"
                                    value={remarks[r.id] ?? ""}
                                    onChange={(e) => setRemarks((m) => ({ ...m, [r.id]: e.target.value }))}
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      disabled={busy === r.id}
                                      onClick={() => move(r, r.status === "requested" ? "processing" : "released")}
                                      className="flex-1 px-2 py-1 rounded-lg text-xs font-bold text-white"
                                      style={{ background: r.status === "requested" ? "#d97706" : "#059669" }}
                                    >
                                      {r.status === "requested" ? "→ Processing" : "→ Released"}
                                    </button>
                                    <button disabled={busy === r.id} onClick={() => move(r, "cancelled")} className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: "#fee2e2", color: "#dc2626" }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: "#94a3b8" }}>{r.released_at ? `Released ${r.released_at.slice(0, 10)}` : "Closed"}</span>
                              )}
                            </td>
                          )}
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

      {showNew && (
        <NewRequestModal
          projects={projects}
          budgets={budgets}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            setReloadKey((k) => k + 1);
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
