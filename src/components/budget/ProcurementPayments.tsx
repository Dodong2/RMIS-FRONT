import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { financialApi } from "../../lib/financialApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { queryKeys } from "../../lib/queries";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../../lib/protoStyles";
import { PROCUREMENT_EVENTS, useRealtime } from "../../hooks/useRealtime";
import type { LineItemBudget } from "../../types/budget";
import type { ProcurementRequest } from "../../types/financial";
import type { Project } from "../../types/research";
import { NoActualData } from "../common/NoActualData";
import { Field, ProtoModal, SkeletonRows } from "../common/proto";

type PaymentFilter = "awaiting_payment" | "paid";

const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));
const prNo = (r: ProcurementRequest) => `PR-${String(r.id).padStart(4, "0")}`;
const today = () => new Date().toLocaleDateString("en-CA");
const shortDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—");

const completedQuery = () => ({
  queryKey: [...queryKeys.financialAll, "procurement", "completed"],
  queryFn: () => financialApi.getProcurementRequests({ status: "completed" }),
});

export function PaymentsBanner({ onOpen }: { onOpen: () => void }) {
  const q = useQuery(completedQuery());
  const awaiting = (q.data ?? []).filter((r) => r.payment_status === "awaiting_payment").length;
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl px-5 py-4 flex items-center gap-4 text-left transition-all hover:shadow-md"
      style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
    >
      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "#dcfce7", color: "#166534" }}>
        <Banknote size={18} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold" style={{ color: "#0d2a5e" }}>Procurement Payments</p>
        <p className="text-xs mt-0.5" style={{ color: "#166534" }}>Confirm the payment of procurement requests the Procurement Office has completed.</p>
      </div>
      {q.data && (
        <span className="text-xs font-bold px-3 py-1 rounded-full text-white shrink-0" style={{ background: awaiting ? "#16a34a" : "#94a3b8" }}>
          {awaiting} Awaiting Payment
        </span>
      )}
    </button>
  );
}

export function ProcurementPayments({ projects, budgets, onBack }: { projects: Project[]; budgets: LineItemBudget[]; onBack: () => void }) {
  const queryClient = useQueryClient();
  const q = useQuery(completedQuery());
  const [filter, setFilter] = useState<PaymentFilter>("awaiting_payment");
  const [paying, setPaying] = useState<ProcurementRequest | null>(null);
  useRealtime(PROCUREMENT_EVENTS, () => q.refetch());

  useEffect(() => {
    if (q.isError) notify.error("Could not load the procurement payments.");
  }, [q.isError]);

  const items = budgets.flatMap((b) => b.line_items);
  const project = (id: number) => projects.find((p) => p.id === id);
  const all = q.data ?? [];
  const rows = all.filter((r) => r.payment_status === filter);
  const count = (f: PaymentFilter) => all.filter((r) => r.payment_status === f).length;

  const paid = () => {
    setPaying(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.financialAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.budgetSummaries });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="font-semibold" style={{ color: "#0891b2" }}>‹ Budget Management</button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span className="text-xs font-mono" style={{ color: "#64748b" }}>Procurement Payments</span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="px-6 py-5 flex flex-wrap items-end justify-between gap-3" style={{ background: "linear-gradient(135deg, #0d2a5e, #1e3a8a)" }}>
          <div>
            <p className="font-black text-lg text-white">Procurement Payments</p>
            <p className="text-xs mt-1" style={{ color: "#cbd5e1" }}>A completed request is paid only after you confirm its full payment here.</p>
          </div>
          <select
            aria-label="Payment status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as PaymentFilter)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
            style={{ borderColor: "#e2e8f0", background: "white", color: "#334155" }}
          >
            <option value="awaiting_payment">Awaiting Payment ({count("awaiting_payment")})</option>
            <option value="paid">Already Paid ({count("paid")})</option>
          </select>
        </div>
        {q.isPending ? (
          <div className="p-4"><SkeletonRows rows={3} /></div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <NoActualData message={filter === "paid" ? "No paid requests yet" : "No requests awaiting payment"} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Request", "Project", "LIB Item", "Year / Q", "Amount", "Completed", filter === "paid" ? "Payment" : "Action"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-bold whitespace-nowrap ${h === "Amount" ? "text-right" : "text-left"}`} style={{ color: "#64748b" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = project(r.project);
                  return (
                    <tr key={r.id} className="border-t align-top" style={{ borderColor: "#f1f5f9" }}>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono font-bold" style={{ color: "#1d4ed8" }}>{prNo(r)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#64748b" }}>by {r.requested_by_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0369a1" }}>{p?.project_code ?? `#${r.project}`}</span>
                        <p className="text-xs mt-1" style={{ color: "#334155" }}>{p?.title ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#334155" }}>
                        {items.find((i) => i.id === r.line_item)?.description ?? `Line item #${r.line_item}`}
                        <p className="mt-0.5" style={{ color: "#94a3b8" }}>{r.description}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "#64748b" }}>
                        {r.project_year ? `Year ${r.project_year}` : r.fiscal_year ?? "—"}{r.quarter ? ` · Q${r.quarter}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-black text-right whitespace-nowrap" style={{ color: "#0f172a" }}>{peso(r.amount)}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#64748b" }}>{shortDate(r.completed_at)}</td>
                      <td className="px-4 py-3 text-xs">
                        {r.payment_status === "paid" ? (
                          <div style={{ color: "#166534" }}>
                            <p className="font-bold whitespace-nowrap"><Check size={12} className="inline" aria-hidden="true" /> Paid {shortDate(r.paid_on)}</p>
                            <p style={{ color: "#64748b" }}>{r.payment_reference}</p>
                            <p style={{ color: "#64748b" }}>by {r.paid_by_name}</p>
                          </div>
                        ) : (
                          <button onClick={() => setPaying(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap" style={{ background: "#16a34a" }}>
                            Mark as Paid
                          </button>
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
      {paying && <PayDialog request={paying} projectCode={project(paying.project)?.project_code} onClose={() => setPaying(null)} onPaid={paid} />}
    </div>
  );
}

function PayDialog({ request, projectCode, onClose, onPaid }: { request: ProcurementRequest; projectCode?: string; onClose: () => void; onPaid: () => void }) {
  const [paidOn, setPaidOn] = useState(today());
  const [reference, setReference] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setAttempted(true);
    if (!paidOn || paidOn > today() || !reference.trim()) {
      notify.error("Enter the payment date (not in the future) and the OR/voucher reference.");
      return;
    }
    setSaving(true);
    try {
      await financialApi.payProcurementRequest(request.id, { paid_on: paidOn, reference_number: reference.trim() });
      notify.success(`${prNo(request)} marked as paid (${peso(request.amount)}).`);
      onPaid();
    } catch (err) {
      notify.error(errorMessage(err, "Could not record the payment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Confirm Payment"
      subtitle={`${prNo(request)}${projectCode ? ` · ${projectCode}` : ""} · full payment only`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#16a34a" }}>
            {saving ? "Saving…" : "Confirm Payment"}
          </button>
        </>
      }
    >
      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#fef9c3", border: "1px solid #fde047", color: "#854d0e" }}>
        Confirm only when the full amount has actually been paid. This moves {peso(request.amount)} from unpaid commitment to paid/utilized and can't be done twice.
      </div>
      <Field label="Amount Paid">
        <div className={INPUT_CLS + " font-semibold"} style={{ ...INPUT_STYLE, background: "#f8fafc" }}>{peso(request.amount)}</div>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Payment Date" required>
          <input type="date" max={today()} className={INPUT_CLS} style={invalidStyle(attempted && (!paidOn || paidOn > today()))} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label="OR / Voucher Reference" required>
          <input className={INPUT_CLS} style={invalidStyle(attempted && !reference.trim())} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. DV-2026-031" maxLength={100} />
        </Field>
      </div>
    </ProtoModal>
  );
}
