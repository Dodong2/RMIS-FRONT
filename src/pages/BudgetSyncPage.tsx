import { useEffect, useMemo, useRef, useState } from "react";
import { budgetSyncApi } from "../lib/budgetSyncApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE } from "../lib/protoStyles";
import type { BudgetOfficeImport, BudgetOfficeMatchMethod, BudgetOfficeRecord, Reconciliation } from "../types/budgetSync";
import type { BudgetOfficeMatchStatus } from "../types/monitoring";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { KpiCard, Pill, SectionCard, SkeletonRows, TableHead } from "../components/common/proto";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const MANAGE_ROLE_CODES = ["system_admin", "finance_budget"];

const STATUS_META: Record<BudgetOfficeMatchStatus, { label: string; bg: string; color: string }> = {
  matched: { label: "Matched", bg: "#d1fae5", color: "#166534" },
  discrepancy: { label: "Discrepancy", bg: "#fee2e2", color: "#b91c1c" },
  no_rmis_budget: { label: "No RMIS LIB", bg: "#fef3c7", color: "#92400e" },
  unlinked: { label: "Unlinked", bg: "#f1f5f9", color: "#64748b" },
};

const MATCH_LABELS: Record<BudgetOfficeMatchMethod, string> = {
  auto: "Matched by title",
  manual: "Linked manually",
  "": "Unlinked",
};

type Tab = "reconciliation" | "imports";

const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Diff({ n }: { n: number }) {
  if (Math.abs(n) < 0.01) return <span style={{ color: "#94a3b8" }}>—</span>;
  return (
    <span className="mono font-bold" style={{ color: n > 0 ? "#059669" : "#dc2626" }}>
      {n > 0 ? "+" : "−"}
      {peso(Math.abs(n))}
    </span>
  );
}

function BudgetSyncContent() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLE_CODES.includes(user?.role?.code ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("reconciliation");
  const [imports, setImports] = useState<BudgetOfficeImport[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [importId, setImportId] = useState<number | null>(null);
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const [records, setRecords] = useState<BudgetOfficeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BudgetOfficeMatchStatus | "">("");
  const [linkDraft, setLinkDraft] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importsKey, setImportsKey] = useState(0);
  const [reconKey, setReconKey] = useState(0);

  useEffect(() => {
    let active = true;
    budgetSyncApi
      .getImports()
      .then((i) => {
        if (!active) return;
        setImports(i);
        setImportId((cur) => (cur && i.some((x) => x.id === cur) ? cur : i[0]?.id ?? null));
      })
      .catch(() => {
        if (!active) return;
        setImports([]);
        notify.error("Could not load Budget Office imports.");
      });
    researchApi
      .getProjects()
      .then((p) => active && setProjects(p))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [importsKey]);

  useEffect(() => {
    let active = true;
    if (imports === null) return;
    if (importId === null) {
      Promise.resolve().then(() => {
        if (!active) return;
        setRecon(null);
        setRecords([]);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }
    Promise.all([budgetSyncApi.getReconciliation(importId), budgetSyncApi.getRecords({ import: importId })])
      .then(([r, rec]) => {
        if (!active) return;
        setRecon(r);
        setRecords(rec);
      })
      .catch(() => active && notify.error("Could not load the reconciliation."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [imports, importId, reconKey]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const rows = useMemo(
    () => (recon?.records ?? []).filter((r) => !statusFilter || r.status === statusFilter),
    [recon, statusFilter],
  );
  const current = imports?.find((i) => i.id === importId) ?? null;

  const upload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      notify.error("Upload the Budget Office workbook as .xlsx.");
      return;
    }
    setUploading(true);
    try {
      const created = await budgetSyncApi.uploadImport(file);
      notify.success(`Imported ${created.record_count} sheet${created.record_count === 1 ? "" : "s"} from ${created.file_name}.`);
      setImportId(created.id);
      setLoading(true);
      setImportsKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not import the workbook."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const link = async (recordId: number, project: number | null) => {
    setBusy(recordId);
    try {
      await budgetSyncApi.linkRecord(recordId, project);
      notify.success(project ? "Record linked to project." : "Record unlinked.");
      setLinkDraft((d) => ({ ...d, [recordId]: "" }));
      setReconKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the link."));
    } finally {
      setBusy(null);
    }
  };

  const summary = recon?.summary;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[260px]">
          <label className="label-field">Budget Office Import</label>
          <select
            className={INPUT_CLS}
            style={INPUT_STYLE}
            value={importId ?? ""}
            disabled={!imports?.length}
            onChange={(e) => {
              setLoading(true);
              setImportId(Number(e.target.value));
            }}
          >
            {!imports?.length && <option value="">No imports yet</option>}
            {imports?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.file_name} · {fmtDate(i.uploaded_at)}
              </option>
            ))}
          </select>
        </div>
        {canManage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <button
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#0d2a5e" }}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Importing…" : "+ Import Workbook (.xlsx)"}
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Sheets" value={current?.record_count ?? 0} />
        <KpiCard label="Matched" value={summary?.matched ?? 0} color="#059669" />
        <KpiCard label="Discrepancy" value={summary?.discrepancy ?? 0} color="#dc2626" />
        <KpiCard label="No RMIS LIB" value={summary?.no_rmis_budget ?? 0} color="#d97706" />
        <KpiCard label="Unlinked" value={summary?.unlinked ?? 0} color="#64748b" />
      </div>

      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
        Each sheet of the Budget Office consolidated LIB workbook is compared against the linked project's current RMIS LIB (MOOE, CO, and grand total). Sheets are linked by title on import; link the ones the title match missed by hand.
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <div className="flex border-b px-2" style={{ borderColor: "#f1f5f9" }}>
          {(
            [
              ["reconciliation", "Reconciliation"],
              ["imports", "Import History"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className="px-4 py-3 text-sm font-semibold border-b-2 -mb-px"
              style={{ borderColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "reconciliation" && (
          <div className="p-5 space-y-4">
            <select
              className="px-3 py-2 rounded-xl border text-sm outline-none"
              style={INPUT_STYLE}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BudgetOfficeMatchStatus | "")}
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </select>

            {loading || imports === null ? (
              <SkeletonRows />
            ) : !recon ? (
              <NoActualData
                message="No Budget Office import yet"
                hint={canManage ? "Import the consolidated LIB workbook (.xlsx) to start reconciling." : undefined}
              />
            ) : rows.length === 0 ? (
              <NoActualData />
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#e2e8f0" }}>
                <table className="w-full text-sm">
                  <TableHead cols={["Sheet", "Budget Office Title", "RMIS Project", "Budget Office", "RMIS LIB"]} />
                  <tbody>
                    {rows.map((r) => {
                      const rec = recordById.get(r.record);
                      const proj = r.project ? projectById.get(r.project) : undefined;
                      const m = STATUS_META[r.status];
                      return (
                        <tr key={r.record} className="border-t align-top" style={{ borderColor: "#f1f5f9" }}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="mono text-xs font-bold mb-1" style={{ color: "#0891b2" }}>{r.sheet_name}</p>
                            <Pill bg={m.bg} color={m.color}>{m.label}</Pill>
                          </td>
                          <td className="px-4 py-3 max-w-[240px]">
                            <p className="text-xs font-semibold line-clamp-2" style={{ color: "#0d2a5e" }} title={r.title}>
                              {r.title}
                            </p>
                            {(rec?.leader_name || rec?.implementing_unit) && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: "#94a3b8" }}>
                                {[rec?.leader_name, rec?.implementing_unit].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 min-w-[200px]">
                            {r.project ? (
                              <>
                                <p className="mono text-xs font-bold" style={{ color: "#0891b2" }}>
                                  {proj?.project_code ?? `Project #${r.project}`}
                                </p>
                                <p className="text-xs truncate max-w-[200px]" style={{ color: "#64748b" }} title={proj?.title}>
                                  {proj?.title}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: "#94a3b8" }}>
                                  {MATCH_LABELS[r.match_method]}
                                  {canManage && (
                                    <button
                                      className="ml-2 font-bold disabled:opacity-60"
                                      style={{ color: "#dc2626" }}
                                      disabled={busy === r.record}
                                      onClick={() => link(r.record, null)}
                                    >
                                      Unlink
                                    </button>
                                  )}
                                </p>
                              </>
                            ) : canManage ? (
                              <div className="flex gap-1.5">
                                <select
                                  className="px-2 py-1.5 rounded-lg border text-xs outline-none w-[150px]"
                                  style={INPUT_STYLE}
                                  value={linkDraft[r.record] ?? ""}
                                  onChange={(e) => setLinkDraft((d) => ({ ...d, [r.record]: e.target.value }))}
                                >
                                  <option value="">Select project…</option>
                                  {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.project_code} — {p.title}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                                  style={{ background: "#e0f2fe", color: "#0369a1" }}
                                  disabled={!linkDraft[r.record] || busy === r.record}
                                  onClick={() => link(r.record, Number(linkDraft[r.record]))}
                                >
                                  Link
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: "#94a3b8" }}>
                                Unlinked
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <p className="mono font-bold" style={{ color: "#0d2a5e" }}>{peso(r.budget_office.grand_total)}</p>
                            <p style={{ color: "#94a3b8" }}>
                              MOOE {peso(r.budget_office.mooe_total)} · CO {peso(r.budget_office.co_total)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {r.rmis ? (
                              <>
                                <p className="mono font-bold" style={{ color: "#0d2a5e" }}>{peso(r.rmis.grand_total)}</p>
                                <p style={{ color: "#94a3b8" }}>
                                  MOOE {peso(r.rmis.mooe_total)} · CO {peso(r.rmis.co_total)}
                                </p>
                                {r.difference && Math.abs(r.difference.grand_total) >= 0.01 && (
                                  <p className="mt-0.5">
                                    <Diff n={r.difference.grand_total} /> <span style={{ color: "#94a3b8" }}>vs Budget Office</span>
                                  </p>
                                )}
                              </>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
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

        {tab === "imports" && (
          <div className="p-5">
            {imports === null ? (
              <SkeletonRows />
            ) : imports.length === 0 ? (
              <NoActualData message="No Budget Office import yet" />
            ) : (
              <SectionCard title={`${imports.length} import${imports.length === 1 ? "" : "s"}`}>
                <table className="w-full text-sm">
                  <TableHead cols={["File", "Uploaded", "Sheets", ""]} />
                  <tbody>
                    {imports.map((i) => (
                      <tr key={i.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#0d2a5e" }}>{i.file_name}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{fmtDate(i.uploaded_at)}</td>
                        <td className="px-4 py-3 mono text-xs font-bold" style={{ color: "#0d2a5e" }}>{i.record_count}</td>
                        <td className="px-4 py-3 text-right">
                          {i.id === importId ? (
                            <Pill bg="#e0f2fe" color="#0369a1">Viewing</Pill>
                          ) : (
                            <button
                              className="px-3 py-1.5 rounded-lg text-xs font-bold"
                              style={{ background: "#e0f2fe", color: "#0369a1" }}
                              onClick={() => {
                                setLoading(true);
                                setImportId(i.id);
                                setTab("reconciliation");
                              }}
                            >
                              Reconcile
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BudgetSyncPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Budget Office Sync">
        <BudgetSyncContent />
      </AppShell>
    </ProtectedRoute>
  );
}
