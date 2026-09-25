import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { budgetApi } from "../lib/budgetApi";
import { financialApi } from "../lib/financialApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type { LineItem, LineItemBudget, LineItemCategory } from "../types/budget";
import type { BudgetSummary } from "../types/financial";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { Field, SkeletonRows } from "../components/common/proto";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const MANAGE_ROLE_CODES = ["system_admin", "finance_budget", "procurement_officer_lib", "program_leader", "project_leader"];
const CERTIFY_ROLE_CODES = ["system_admin", "finance_budget"];
const CATEGORIES: LineItemCategory[] = ["ps", "mooe", "co"];

const CATEGORY_META: Record<LineItemCategory, { label: string; full: string; color: string; bg: string; icon: string }> = {
  ps: { label: "PS", full: "Personal Services", color: "#0d2a5e", bg: "#e0eaf7", icon: "👥" },
  mooe: { label: "MOOE", full: "Maintenance & Other Operating Expenses", color: "#0891b2", bg: "#e0f2fe", icon: "🧾" },
  co: { label: "CO", full: "Capital Outlay", color: "#059669", bg: "#d1fae5", icon: "🏗️" },
};

const STATUS_META = {
  draft: { label: "Draft", bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  certified: { label: "Certified", bg: "#d1fae5", text: "#166534", dot: "#22c55e" },
} as const;

type LIBTab = "overview" | "line_items";

const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));

const catTotal = (b: LineItemBudget, cat: LineItemCategory) =>
  b.line_items.filter((i) => i.category === cat).reduce((s, i) => s + Number(i.amount), 0);

function StatusBadge({ s }: { s: keyof typeof STATUS_META }) {
  const m = STATUS_META[s];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function CatBar({ budget }: { budget: LineItemBudget }) {
  const vals = CATEGORIES.map((c) => catTotal(budget, c));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5" style={{ background: "#f1f5f9" }}>
        {CATEGORIES.map((c, i) => (
          <div key={c} style={{ width: `${(vals[i] / total) * 100}%`, background: CATEGORY_META[c].color }} />
        ))}
      </div>
      <div className="flex gap-3 mt-1.5 flex-wrap">
        {CATEGORIES.map((c, i) => (
          <span key={c} className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-sm" style={{ background: CATEGORY_META[c].color }} />
            <span style={{ color: "#64748b" }}>{CATEGORY_META[c].label}</span>
            <span className="font-mono font-bold" style={{ color: CATEGORY_META[c].color }}>{Math.round((vals[i] / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DryCapWarning() {
  return (
    <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#fef3c7", border: "1px solid #fcd34d" }}>
      <span>⚠️</span>
      <div>
        <p className="text-xs font-black" style={{ color: "#92400e" }}>Over the ₱100,000/year institutional dry-research cap</p>
        <p className="text-xs" style={{ color: "#b45309" }}>Warning only (Manual, Article III). The LIB can still be encoded and certified.</p>
      </div>
    </div>
  );
}

const EMPTY_ITEM = { category: "", description: "", amount: "", fiscal_year: "", funding_source: "", is_counterpart: false };

function LIBDetail({
  project,
  canManage,
  canCertify,
  isStudyLeader,
  onBack,
  onChanged,
}: {
  project: Project;
  canManage: boolean;
  canCertify: boolean;
  isStudyLeader: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [budget, setBudget] = useState<LineItemBudget | null | undefined>(undefined);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<LIBTab>("overview");
  const [item, setItem] = useState(EMPTY_ITEM);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    budgetApi
      .getBudgets(project.id)
      .then((list) => {
        if (!active) return;
        const current = list.find((b) => b.is_current) ?? null;
        setBudget(current);
        if (current?.status === "certified") {
          financialApi
            .getBudgetSummary(current.id)
            .then((s) => active && setSummary(s))
            .catch(() => active && setSummary(null));
        } else {
          setSummary(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setBudget(null);
        notify.error("Could not load the budget for this project.");
      });
    return () => {
      active = false;
    };
  }, [project.id, reloadKey]);

  const reload = () => {
    setReloadKey((k) => k + 1);
    onChanged();
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      notify.success(ok);
      reload();
    } catch (err) {
      notify.error(errorMessage(err, "The change could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const addItem = () => {
    setAttempted(true);
    if (!budget || !item.category || !item.description.trim() || !item.amount) {
      notify.error("Category, description, and amount are required.");
      return;
    }
    run(async () => {
      await budgetApi.createLineItem({
        budget: budget.id,
        category: item.category as LineItemCategory,
        description: item.description.trim(),
        amount: item.amount,
        fiscal_year: item.fiscal_year ? Number(item.fiscal_year) : null,
        funding_source: item.funding_source.trim(),
        is_counterpart: item.is_counterpart,
      });
      setItem(EMPTY_ITEM);
      setAttempted(false);
    }, "Line item added.");
  };

  const years = useMemo(() => {
    const ys = new Set<number | null>((budget?.line_items ?? []).map((i) => i.fiscal_year));
    return [...ys].sort((a, b) => (a ?? 9999) - (b ?? 9999));
  }, [budget]);

  const isDraft = budget?.status === "draft";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#0891b2" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Budget Management
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-mono font-semibold" style={{ color: "#64748b" }}>
          {project.project_code}
          {budget ? ` LIB v${budget.version_number}` : ""}
        </span>
      </div>

      {budget === undefined ? (
        <SkeletonRows rows={4} />
      ) : budget === null ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm font-semibold" style={{ color: "#64748b" }}>This project has no Line-Item Budget yet.</p>
          {canManage && (
            <button
              onClick={() => run(() => budgetApi.createBudget(project.id), "LIB draft started.")}
              disabled={busy}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
              style={{ background: "#0d2a5e" }}
            >
              + Prepare LIB
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #0d2a5e 0%, #1a3f7a 100%)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.15)", color: "#67e8f9" }}>
                    {project.project_code}
                  </span>
                  <StatusBadge s={budget.status} />
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(168,196,232,0.7)" }}>
                    v{budget.version_number}
                  </span>
                </div>
                <p className="text-white font-black text-lg leading-snug max-w-2xl">{project.title}</p>
                <p className="text-sm mt-1" style={{ color: "rgba(168,196,232,0.6)" }}>
                  Created {budget.created_at.slice(0, 10)}
                  {budget.certified_at ? ` · Certified ${budget.certified_at.slice(0, 10)}` : " · Not yet certified by the Budget Officer"}
                </p>
              </div>
              {canCertify && isDraft && (
                <button
                  onClick={() => run(() => budgetApi.certifyBudget(budget.id), "LIB certified.")}
                  disabled={busy || budget.line_items.length === 0}
                  className="px-4 py-2 rounded-xl text-xs font-bold shrink-0 disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                >
                  Certify LIB
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              {[
                { label: "Total Budget", val: peso(budget.total_amount) },
                ...CATEGORIES.map((c) => ({ label: CATEGORY_META[c].label, val: peso(catTotal(budget, c)) })),
              ].map((k) => (
                <div key={k.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <p className="text-xs" style={{ color: "rgba(168,196,232,0.5)" }}>{k.label}</p>
                  <p className="font-black text-lg mt-0.5 font-mono" style={{ color: "white" }}>{k.val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2e8f0" }}>
            {(
              [
                ["overview", "Overview"],
                ["line_items", "Line Items"],
              ] as [LIBTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all"
                style={{ borderBottomColor: tab === key ? "#0891b2" : "transparent", color: tab === key ? "#0891b2" : "#64748b" }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "overview" && (
              <div className="space-y-5">
                {budget.exceeds_dry_cap && <DryCapWarning />}
                {isStudyLeader && (
                  <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
                    Read-only view. Per-study allocation isn't tracked yet, so this shows the whole project LIB.
                  </div>
                )}
                {budget.line_items.length === 0 ? (
                  <NoActualData hint={canManage && isDraft ? 'Add PS, MOOE, or CO items under "Line Items".' : undefined} />
                ) : (
                  <>
                    <CatBar budget={budget} />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Annual Budget Allocations</p>
                      <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #e2e8f0" }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: "#f0f4f8" }}>
                              <th className="px-3 py-2 text-left text-xs font-bold" style={{ color: "#64748b" }}>Category</th>
                              {years.map((y) => (
                                <th key={y ?? "none"} className="px-3 py-2 text-right text-xs font-bold whitespace-nowrap" style={{ color: "#64748b" }}>
                                  {y ? `FY ${y}` : "No fiscal year"}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-right text-xs font-bold" style={{ color: "#64748b" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {CATEGORIES.map((cat) => {
                              const cm = CATEGORY_META[cat];
                              return (
                                <tr key={cat} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                                  <td className="px-3 py-2.5">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: cm.bg, color: cm.color }}>{cm.icon} {cm.label}</span>
                                  </td>
                                  {years.map((y) => (
                                    <td key={y ?? "none"} className="px-3 py-2.5 text-right text-xs font-mono" style={{ color: "#334155" }}>
                                      {peso(budget.line_items.filter((i) => i.category === cat && i.fiscal_year === y).reduce((s, i) => s + Number(i.amount), 0))}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2.5 text-right text-xs font-mono font-black" style={{ color: cm.color }}>{peso(catTotal(budget, cat))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#f0f4f8" }}>
                              <td className="px-3 py-2.5 text-xs font-black" style={{ color: "#0d2a5e" }}>TOTAL</td>
                              {years.map((y) => (
                                <td key={y ?? "none"} className="px-3 py-2.5 text-right text-xs font-mono font-black" style={{ color: "#0d2a5e" }}>
                                  {peso(budget.line_items.filter((i) => i.fiscal_year === y).reduce((s, i) => s + Number(i.amount), 0))}
                                </td>
                              ))}
                              <td className="px-3 py-2.5 text-right text-xs font-mono font-black" style={{ color: "#0d2a5e" }}>{peso(budget.total_amount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </>
                )}
                {budget.status === "certified" && summary && (
                  <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#d1fae5", border: "1px solid #86efac" }}>
                    <svg width="18" height="18" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-black" style={{ color: "#166534" }}>Approved Budget Baseline (certified)</p>
                      <p className="text-sm font-mono font-black" style={{ color: "#166534" }}>{peso(summary.totals.approved)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "#166534" }}>Adjusted · Actual · Available</p>
                      <p className="text-xs font-mono font-bold" style={{ color: "#166534" }}>
                        {peso(summary.totals.adjusted)} · {peso(summary.totals.actual)} · {peso(summary.totals.available)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "line_items" && (
              <div className="space-y-5">
                {budget.exceeds_dry_cap && <DryCapWarning />}
                {canManage && isDraft && (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Add a Line Item</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Category" required>
                        <select className={INPUT_CLS} style={invalidStyle(attempted && !item.category)} value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value })}>
                          <option value="">Select category</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{CATEGORY_META[c].full} ({CATEGORY_META[c].label})</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Description" required className="lg:col-span-2">
                        <input
                          className={INPUT_CLS}
                          style={invalidStyle(attempted && !item.description.trim())}
                          value={item.description}
                          onChange={(e) => setItem({ ...item, description: e.target.value })}
                          placeholder="e.g. Research assistant honorarium"
                        />
                      </Field>
                      <Field label="Amount (₱)" required>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={INPUT_CLS}
                          style={invalidStyle(attempted && !item.amount)}
                          value={item.amount}
                          onChange={(e) => setItem({ ...item, amount: e.target.value })}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field label="Fiscal Year">
                        <input type="number" min="2000" max="2100" className={INPUT_CLS} style={INPUT_STYLE} value={item.fiscal_year} onChange={(e) => setItem({ ...item, fiscal_year: e.target.value })} placeholder="e.g. 2026" />
                      </Field>
                      <Field label="Funding Source">
                        <input className={INPUT_CLS} style={INPUT_STYLE} value={item.funding_source} onChange={(e) => setItem({ ...item, funding_source: e.target.value })} placeholder="e.g. LSPU GAA, DOST-PCAARRD" />
                      </Field>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "#475569" }}>
                        <input type="checkbox" checked={item.is_counterpart} onChange={(e) => setItem({ ...item, is_counterpart: e.target.checked })} />
                        Counterpart funding
                      </label>
                      <button onClick={addItem} disabled={busy} className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                        {busy ? "Saving…" : "+ Add Item"}
                      </button>
                    </div>
                  </div>
                )}

                {budget.line_items.length === 0 && <NoActualData />}

                {CATEGORIES.map((cat) => {
                  const items = budget.line_items.filter((i) => i.category === cat);
                  if (items.length === 0) return null;
                  const cm = CATEGORY_META[cat];
                  const canRemove = canManage && isDraft;
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">{cm.icon}</span>
                        <p className="font-black text-sm" style={{ color: cm.color }}>{cm.full} ({cm.label})</p>
                        <span className="text-xs font-bold font-mono ml-auto" style={{ color: cm.color }}>{peso(catTotal(budget, cat))}</span>
                      </div>
                      <div className="rounded-2xl overflow-x-auto" style={{ border: `1px solid ${cm.bg}` }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: cm.bg }}>
                              {["#", "Description", "Fiscal Year", "Funding Source", "Amount", ...(canRemove ? [""] : [])].map((h, i) => (
                                <th key={`${h}-${i}`} className="px-3 py-2 text-left text-xs font-bold whitespace-nowrap" style={{ color: cm.color }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((li: LineItem, idx) => (
                              <tr key={li.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                                <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "#94a3b8" }}>{cm.label}-{String(idx + 1).padStart(2, "0")}</td>
                                <td className="px-3 py-2.5 text-xs font-semibold max-w-xs" style={{ color: "#0d2a5e" }}>
                                  {li.description}
                                  <div className="flex gap-1 mt-0.5 flex-wrap">
                                    {li.is_app_flagged && (
                                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "#fee2e2", color: "#991b1b" }}>APP · above ₱50,000</span>
                                    )}
                                    {li.is_counterpart && (
                                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "#f0fdf4", color: "#166534" }}>Counterpart</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "#64748b" }}>{li.fiscal_year ?? "—"}</td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: "#64748b" }}>{li.funding_source || "—"}</td>
                                <td className="px-3 py-2.5 text-xs font-mono font-black text-right whitespace-nowrap" style={{ color: cm.color }}>{peso(li.amount)}</td>
                                {canRemove && (
                                  <td className="px-3 py-2.5 text-right">
                                    <button
                                      onClick={() => run(() => budgetApi.deleteLineItem(li.id), "Line item removed.")}
                                      disabled={busy}
                                      className="text-xs font-bold px-2 py-1 rounded-lg"
                                      style={{ background: "#fee2e2", color: "#dc2626" }}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: cm.bg }}>
                              <td colSpan={4} className="px-3 py-2 text-xs font-black" style={{ color: cm.color }}>Subtotal — {cm.label}</td>
                              <td className="px-3 py-2 text-xs font-black font-mono text-right" style={{ color: cm.color }}>{peso(catTotal(budget, cat))}</td>
                              {canRemove && <td />}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canManage = MANAGE_ROLE_CODES.includes(code);
  const canCertify = CERTIFY_ROLE_CODES.includes(code);
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [budgets, setBudgets] = useState<LineItemBudget[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([researchApi.getProjects(), budgetApi.getBudgets()])
      .then(([p, b]) => {
        if (!active) return;
        setProjects(p);
        setBudgets(b);
      })
      .catch(() => {
        if (!active) return;
        setProjects([]);
        notify.error("Could not load budgets. Check your connection and refresh.");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const current = budgets.filter((b) => b.is_current);
  const selected = projects?.find((p) => p.id === Number(params.get("project")));
  if (selected) {
    return (
      <LIBDetail
        project={selected}
        canManage={canManage}
        canCertify={canCertify}
        isStudyLeader={code === "study_leader"}
        onBack={() => setParams({})}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  const withLib = (projects ?? []).filter((p) => current.some((b) => b.project === p.id));
  const withoutLib = (projects ?? []).filter((p) => !current.some((b) => b.project === p.id));
  const sum = (list: LineItemBudget[]) => list.reduce((s, b) => s + Number(b.total_amount), 0);
  const kpis = [
    { label: "Total LIB", val: peso(sum(current)), mono: true, color: "#0d2a5e" },
    { label: "Certified", val: peso(sum(current.filter((b) => b.status === "certified"))), mono: true, color: "#166534" },
    { label: "Certified LIBs", val: String(current.filter((b) => b.status === "certified").length), mono: false, color: "#166534" },
    { label: "Draft", val: String(current.filter((b) => b.status === "draft").length), mono: false, color: "#475569" },
    { label: "Over Dry Cap", val: String(current.filter((b) => b.exceeds_dry_cap).length), mono: false, color: "#92400e" },
    { label: "No LIB Yet", val: String(withoutLib.length), mono: false, color: "#991b1b" },
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
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <p className="font-black text-lg" style={{ color: "#0d2a5e" }}>Line-Item Budgets</p>
          {canManage && (
            <div className="relative">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: "#0d2a5e" }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Prepare New LIB
              </button>
              {pickerOpen && (
                <div className="absolute right-0 mt-1 w-72 rounded-2xl shadow-2xl z-10 overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                  <p className="px-4 pt-3 pb-1 text-xs font-black uppercase tracking-wide" style={{ color: "#94a3b8" }}>Select Project</p>
                  {withoutLib.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setParams({ project: String(p.id) })}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors"
                      style={{ color: "#334155" }}
                    >
                      <span className="font-bold font-mono" style={{ color: "#0891b2" }}>{p.project_code}</span> · {p.title.slice(0, 40)}
                      {p.title.length > 40 ? "…" : ""}
                    </button>
                  ))}
                  {withoutLib.length === 0 && <p className="px-4 py-3 text-xs" style={{ color: "#94a3b8" }}>All projects already have LIBs.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {projects === null ? (
            <SkeletonRows rows={2} />
          ) : withLib.length === 0 ? (
            <NoActualData hint={canManage ? 'Click "Prepare New LIB" to get started.' : "No LIBs in your access scope yet."} />
          ) : (
            withLib.map((project) => {
              const b = current.find((x) => x.project === project.id)!;
              return (
                <div
                  key={b.id}
                  onClick={() => setParams({ project: String(project.id) })}
                  className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:border-[#0891b2] hover:-translate-y-px"
                  style={{ background: "white", border: "1px solid #e2e8f0" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0369a1" }}>{project.project_code}</span>
                        {project.campus && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0891b2" }}>{project.campus}</span>
                        )}
                        <StatusBadge s={b.status} />
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f0f4f8", color: "#64748b" }}>v{b.version_number}</span>
                        {b.exceeds_dry_cap && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>⚠ Over dry cap</span>
                        )}
                      </div>
                      <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{project.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                        PI: {project.lead_detail.email} · {b.line_items.length} line item{b.line_items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black font-mono" style={{ color: "#0d2a5e" }}>{peso(b.total_amount)}</p>
                      {b.status === "certified" && <p className="text-xs font-mono mt-0.5" style={{ color: "#059669" }}>✓ Baseline established</p>}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {CATEGORIES.map((cat) => {
                      const cm = CATEGORY_META[cat];
                      return (
                        <div key={cat} className="rounded-xl p-2.5 text-center" style={{ background: cm.bg }}>
                          <p className="text-xs font-bold" style={{ color: cm.color }}>{cm.icon} {cm.label}</p>
                          <p className="text-xs font-mono font-black mt-0.5" style={{ color: cm.color }}>{peso(catTotal(b, cat))}</p>
                        </div>
                      );
                    })}
                  </div>
                  {canCertify && b.status === "draft" && b.line_items.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#fef3c7" }}>
                      <span className="text-xs">⏳</span>
                      <p className="text-xs font-bold" style={{ color: "#92400e" }}>Awaiting Budget Officer certification</p>
                      <span className="ml-auto text-xs font-bold" style={{ color: "#0891b2" }}>Open to certify →</span>
                    </div>
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

export default function BudgetPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Budget Management">
        <BudgetContent />
      </AppShell>
    </ProtectedRoute>
  );
}
