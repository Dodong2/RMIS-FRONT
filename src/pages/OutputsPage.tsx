import { useEffect, useMemo, useState } from "react";
import { outputsApi } from "../lib/outputsApi";
import { personnelApi } from "../lib/personnelApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import { FAMILY_META, INDEXING_LABELS, IP_STATUS_LABELS, IP_TYPE_LABELS, PUBLICATION_TYPE_LABELS, SIX_P_META, type OutputFamily } from "../lib/outputsMeta";
import type {
  CreativeWorkRecord,
  ExpectedOutput,
  ExpectedVsActual,
  IPRecord,
  IPStatus,
  ProjectOutcome,
  PublicationRecord,
  SenseRankedPublisher,
  SixPCategory,
} from "../types/outputs";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { NoActualData } from "../components/common/NoActualData";
import { Field, ProtoModal, SkeletonRows, TableHead } from "../components/common/proto";
import { RegisterOutputModal } from "../components/outputs/RegisterOutputModal";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";

const MANAGE_ROLE_CODES = ["system_admin", "riuh"];
const REPORT_ROLE_CODES = ["system_admin", "riuh", "project_leader", "study_leader"];
const CREATIVE_WORK_ROLE_CODES = [...REPORT_ROLE_CODES, "project_staff"];

type StatusKey = "published" | "disclosed" | "filed" | "registered" | "adopted" | "met" | "in_progress" | "outcome" | "impact";
type PageTab = "outputs" | "sixps" | "creative" | "sense";

const STATUS_META: Record<StatusKey, { label: string; bg: string; text: string; dot: string }> = {
  published: { label: "Published", bg: "#d1fae5", text: "#166534", dot: "#059669" },
  disclosed: { label: "Disclosed", bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  filed: { label: "Filed", bg: "#fdf4ff", text: "#7c3aed", dot: "#8b5cf6" },
  registered: { label: "Registered", bg: "#e0eaf7", text: "#0d2a5e", dot: "#3b82f6" },
  adopted: { label: "Adopted", bg: "#d1fae5", text: "#166534", dot: "#059669" },
  met: { label: "Target Met", bg: "#d1fae5", text: "#166534", dot: "#22c55e" },
  in_progress: { label: "In Progress", bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  outcome: { label: "Outcome", bg: "#e0f2fe", text: "#0369a1", dot: "#0891b2" },
  impact: { label: "Impact", bg: "#d1fae5", text: "#166534", dot: "#059669" },
};

const INDEXING_COLORS: Record<string, { bg: string; text: string }> = {
  isi: { bg: "#e0f2fe", text: "#0369a1" },
  scopus: { bg: "#fff7ed", text: "#c2410c" },
  lspu_refereed: { bg: "#fef3c7", text: "#92400e" },
  non_indexed: { bg: "#f1f5f9", text: "#475569" },
};

type Item = {
  key: string;
  family: OutputFamily;
  project: number;
  title: string;
  subtype: string;
  status: StatusKey;
  date: string;
  people: number[];
  pub?: PublicationRecord;
  ip?: IPRecord;
  exp?: ExpectedOutput;
  outcome?: ProjectOutcome;
};

const peso = (n: string | number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toLocaleDateString("en-CA");

function StatusBadge({ s }: { s: StatusKey }) {
  const m = STATUS_META[s];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function FamilyChip({ f }: { f: OutputFamily }) {
  const m = FAMILY_META[f];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>
      {m.icon} {m.label}
    </span>
  );
}

function Info({ label, children, color = "#0d2a5e", mono }: { label: string; children: React.ReactNode; color?: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{label}</p>
      <p className={`text-sm font-semibold mt-0.5 break-words ${mono ? "font-mono" : ""}`} style={{ color }}>{children}</p>
    </div>
  );
}

function OutputDetailModal({
  item,
  projectLabel,
  nameOf,
  senseName,
  canReport,
  onClose,
  onChanged,
}: {
  item: Item;
  projectLabel: string;
  nameOf: (id: number | null) => string;
  senseName: (id: number | null) => string;
  canReport: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"detail" | "researchers" | "records">("detail");
  const [actual, setActual] = useState(item.exp ? String(item.exp.manual_actual_count) : "0");
  const [busy, setBusy] = useState(false);
  const { pub, ip, exp, outcome } = item;

  const act = async (fn: () => Promise<unknown>, ok: string, close = false) => {
    setBusy(true);
    try {
      await fn();
      notify.success(ok);
      onChanged();
      if (close) onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not update this output."));
    } finally {
      setBusy(false);
    }
  };

  const coCreators = ip?.co_creators ? ip.co_creators.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return (
    <ProtoModal
      width="max-w-2xl"
      onClose={onClose}
      title={
        <>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <FamilyChip f={item.family} />
            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(168,196,232,0.8)" }}>{item.subtype}</span>
            <StatusBadge s={item.status} />
          </div>
          <p className="text-white font-black leading-snug">{item.title}</p>
          <p className="text-xs mt-1 font-normal" style={{ color: "rgba(168,196,232,0.6)" }}>
            {projectLabel} · {item.date}
          </p>
        </>
      }
    >
      <div className="flex border-b -mx-6 -mt-6 mb-2 px-2" style={{ borderColor: "#e2e8f0" }}>
        {(
          [
            ["detail", "Output Details"],
            ["researchers", "Linked Researchers"],
            ["records", "Supporting Records"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "detail" && (
        <div className="space-y-4">
          {pub && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Publication Type">{PUBLICATION_TYPE_LABELS[pub.publication_type]}</Info>
                <Info label="Date Published" mono>{pub.published_on}</Info>
                {pub.publisher_name && <Info label="Publisher">{pub.publisher_name}</Info>}
                {pub.doi_or_isbn && <Info label="DOI / ISBN" color="#0891b2" mono>{pub.doi_or_isbn}</Info>}
                {pub.impact_factor && <Info label="Impact Factor" color="#059669" mono>{pub.impact_factor}</Info>}
                {pub.h_index && <Info label="H-Index" color="#059669" mono>{pub.h_index}</Info>}
                {pub.sense_publisher && <Info label="SENSE-Ranked Publisher">{senseName(pub.sense_publisher)}</Info>}
              </div>
              {pub.indexing_tier && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Indexing</p>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: INDEXING_COLORS[pub.indexing_tier].bg, color: INDEXING_COLORS[pub.indexing_tier].text }}>
                    {INDEXING_LABELS[pub.indexing_tier]}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {[
                  [pub.has_isbn, "Has ISBN"],
                  [pub.is_lspu_published, "LSPU-Published"],
                  [pub.is_thesis_derived, "Thesis-Derived"],
                  [pub.is_supervised_approved_thesis, "Supervised & Approved Thesis"],
                ]
                  .filter(([on]) => on)
                  .map(([, l]) => (
                    <span key={l as string} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f4f8", color: "#64748b" }}>✓ {l as string}</span>
                  ))}
              </div>
              <div className="rounded-xl px-4 py-3" style={{ background: "#d1fae5" }}>
                <p className="text-xs font-black" style={{ color: "#166534" }}>Estimated R&D Incentive (Manual Art. V)</p>
                <p className="text-xl font-black font-mono mt-0.5" style={{ color: "#166534" }}>{pub.estimated_incentive ? peso(pub.estimated_incentive) : "Not eligible"}</p>
              </div>
            </>
          )}

          {ip && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Info label="IP Type">{IP_TYPE_LABELS[ip.ip_type]}</Info>
                <Info label="TRL">{ip.trl ?? "—"}</Info>
                {ip.registration_number && <Info label="Registration / Filing No." color="#6b21a8" mono>{ip.registration_number}</Info>}
                {ip.registered_on && <Info label="Date Registered" color="#059669" mono>{ip.registered_on}</Info>}
                {ip.adoption_moa_reference && <Info label="Adoption MOA Reference" mono>{ip.adoption_moa_reference}</Info>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ip.is_commercialization_intended && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f4f8", color: "#64748b" }}>✓ Commercialization intended</span>}
                {ip.is_adopted_by_community && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f4f8", color: "#64748b" }}>✓ Adopted by a recipient community</span>}
              </div>
              {canReport && (
                <Field label="IP Status">
                  <select className={INPUT_CLS} style={INPUT_STYLE} value={ip.status} disabled={busy} onChange={(e) => act(() => outputsApi.updateIPRecord(ip.id, { status: e.target.value as IPStatus }), "IP status updated.")}>
                    {Object.entries(IP_STATUS_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: ip.incentive_eligible ? "#d1fae5" : "#f1f5f9" }}>
                <div>
                  <p className="text-xs font-black" style={{ color: ip.incentive_eligible ? "#166534" : "#475569" }}>R&D Incentive</p>
                  <p className="text-xs mt-0.5" style={{ color: ip.incentive_eligible ? "#166534" : "#64748b" }}>
                    {ip.incentive_claimed ? "Already claimed (once per patent)" : ip.incentive_eligible ? "Eligible — not yet claimed" : "Not eligible at this status"}
                  </p>
                </div>
                {canReport && (
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: "#0d2a5e" }}>
                    <input type="checkbox" checked={ip.incentive_claimed} disabled={busy} onChange={() => act(() => outputsApi.updateIPRecord(ip.id, { incentive_claimed: !ip.incentive_claimed }), "Claimed flag updated.")} />
                    Incentive claimed
                  </label>
                )}
              </div>
            </>
          )}

          {exp && (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Description</p>
                <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{exp.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["6Ps Category", SIX_P_META[exp.category].label, "#0d2a5e"],
                  ["Target", String(exp.target_count), "#0891b2"],
                  ["Actual", String(exp.actual_count), exp.actual_count >= exp.target_count ? "#059669" : "#d97706"],
                ].map(([l, val, c]) => (
                  <div key={l} className="rounded-xl p-3 text-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{l}</p>
                    <p className="text-sm font-black mt-0.5" style={{ color: c }}>{val}</p>
                  </div>
                ))}
              </div>
              {canReport && (
                <div className="flex items-end gap-2 flex-wrap">
                  <Field label="Update Achieved Count" className="w-40">
                    <input type="number" min="0" className={INPUT_CLS} style={INPUT_STYLE} value={actual} onChange={(e) => setActual(e.target.value)} />
                  </Field>
                  <button disabled={busy || actual === String(exp.manual_actual_count)} onClick={() => act(() => outputsApi.updateExpectedOutput(exp.id, { manual_actual_count: Number(actual) }), "Achieved count updated.")} className="px-3 py-2.5 rounded-xl text-xs font-bold disabled:opacity-60" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                    Save
                  </button>
                  <button disabled={busy} onClick={() => act(() => outputsApi.deleteExpectedOutput(exp.id), "Expected output removed.", true)} className="px-3 py-2.5 rounded-xl text-xs font-bold ml-auto disabled:opacity-60" style={{ background: "#fee2e2", color: "#991b1b" }}>
                    Remove
                  </button>
                </div>
              )}
            </>
          )}

          {outcome && (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Description</p>
                <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{outcome.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Kind">{outcome.kind === "impact" ? "🌱 Societal Impact" : "📈 Project Outcome"}</Info>
                <Info label="Observed On" mono>{outcome.observed_on ?? "—"}</Info>
              </div>
              {outcome.evidence && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Evidence</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{outcome.evidence}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "researchers" && (
        <div className="space-y-3">
          {item.people.length === 0 && coCreators.length === 0 ? (
            <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc" }}>
              <p className="text-sm" style={{ color: "#94a3b8" }}>No researchers linked to this record.</p>
            </div>
          ) : (
            <>
              {item.people.map((id) => (
                <div key={id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0" style={{ background: "#0d2a5e" }}>
                    {nameOf(id).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{nameOf(id)}</p>
                    <p className="text-xs" style={{ color: "#0891b2" }}>{pub ? "Lead Author" : ip ? "Creator" : "Recorded by"}</p>
                  </div>
                </div>
              ))}
              {coCreators.map((n) => (
                <div key={n} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                    {n.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{n}</p>
                    <p className="text-xs" style={{ color: "#0891b2" }}>Co-Creator</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "records" && (
        <div className="rounded-xl px-4 py-3" style={{ background: "#f0f4f8" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "#0d2a5e" }}>Output Status Tracking</p>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge s={item.status} />
            <span className="text-xs" style={{ color: "#94a3b8" }}>
              Registered {(pub ?? ip ?? exp ?? outcome)?.created_at.slice(0, 10)}
              {pub ? ` · ${nameOf(pub.recorded_by)}` : ip ? ` · ${nameOf(ip.recorded_by)}` : outcome ? ` · ${nameOf(outcome.recorded_by)}` : ""}
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>Supporting files for this project live in Document and Records Management.</p>
        </div>
      )}
    </ProtoModal>
  );
}

function SixPsTab({ projects, canReport }: { projects: Project[]; canReport: boolean }) {
  const [project, setProject] = useState(projects[0] ? String(projects[0].id) : "");
  const [data, setData] = useState<ExpectedVsActual | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ category: "products" as SixPCategory, description: "", target_count: "1" });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    if (!project) return;
    outputsApi
      .getExpectedVsActual(Number(project))
      .then((d) => active && setData(d))
      .catch(() => {
        if (!active) return;
        setData(null);
        notify.error("Could not load expected vs actual outputs.");
      });
    return () => {
      active = false;
    };
  }, [project, reloadKey]);

  const add = async () => {
    setAttempted(true);
    if (!form.description.trim() || !Number(form.target_count)) {
      notify.error("Description and a target count are required.");
      return;
    }
    setSaving(true);
    try {
      await outputsApi.createExpectedOutput({ project: Number(project), category: form.category, description: form.description.trim(), target_count: Number(form.target_count) });
      notify.success("Expected output added.");
      setForm((f) => ({ ...f, description: "", target_count: "1" }));
      setAttempted(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not add this expected output."));
    } finally {
      setSaving(false);
    }
  };

  const saveActual = async (row: ExpectedOutput) => {
    try {
      await outputsApi.updateExpectedOutput(row.id, { manual_actual_count: Number(edits[row.id]) });
      notify.success("Achieved count updated.");
      setEdits((e) => {
        const next = { ...e };
        delete next[row.id];
        return next;
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the count."));
    }
  };

  if (projects.length === 0) return <NoActualData message="No projects yet" />;

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <label className="label-field">Project</label>
        <select className={INPUT_CLS} style={INPUT_STYLE} value={project} onChange={(e) => {
          setData(null);
          setProject(e.target.value);
        }}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
          ))}
        </select>
      </div>

      {data === null ? (
        <SkeletonRows />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.by_category.map((c) => {
              const pct = c.target > 0 ? Math.min(100, Math.round((c.actual / c.target) * 100)) : 0;
              const color = c.target === 0 ? "#94a3b8" : c.met ? "#059669" : "#d97706";
              return (
                <div key={c.category} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                  <div className="flex items-center gap-1.5">
                    <span>{SIX_P_META[c.category].icon}</span>
                    <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>{c.label}</p>
                  </div>
                  <p className="text-2xl font-black mt-2 font-mono" style={{ color }}>
                    {c.actual}
                    <span className="text-sm" style={{ color: "#94a3b8" }}> / {c.target}</span>
                  </p>
                  <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: "#f1f5f9" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <p className="text-xs font-bold mt-1.5" style={{ color }}>{c.target === 0 ? "No target set" : c.met ? "✓ Target met" : `${pct}% of target`}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl overflow-x-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
            {data.expected_outputs.length === 0 ? (
              <NoActualData message="No expected outputs set for this project" hint={canReport ? "Add the project's 6Ps targets below." : undefined} />
            ) : (
              <table className="w-full text-sm">
                <TableHead cols={["6Ps Category", "Expected Output", "Target", "Actual", ""]} />
                <tbody>
                  {data.expected_outputs.map((row) => {
                    const computed = SIX_P_META[row.category].computed;
                    return (
                      <tr key={row.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                        <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{ color: "#0d2a5e" }}>{SIX_P_META[row.category].icon} {SIX_P_META[row.category].label}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#334155" }}>{row.description}</td>
                        <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: "#0891b2" }}>{row.target_count}</td>
                        <td className="px-4 py-3 text-xs">
                          {canReport && !computed ? (
                            <div className="flex items-center gap-1.5">
                              <input type="number" min="0" className="w-16 px-2 py-1 rounded-lg border text-xs outline-none" style={INPUT_STYLE} value={edits[row.id] ?? String(row.manual_actual_count)} onChange={(e) => setEdits((x) => ({ ...x, [row.id]: e.target.value }))} />
                              {edits[row.id] !== undefined && edits[row.id] !== String(row.manual_actual_count) && (
                                <button onClick={() => saveActual(row)} className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: "#e0f2fe", color: "#0369a1" }}>Save</button>
                              )}
                            </div>
                          ) : (
                            <span className="font-mono font-bold" style={{ color: row.actual_count >= row.target_count ? "#059669" : "#d97706" }}>{row.actual_count}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#94a3b8" }}>{computed ? "Counted from records" : "Manual count"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {canReport && (
            <div className="rounded-2xl p-4 flex flex-wrap items-end gap-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
              <Field label="6Ps Category" className="w-52">
                <select className={INPUT_CLS} style={INPUT_STYLE} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SixPCategory }))}>
                  {(Object.entries(SIX_P_META) as [SixPCategory, (typeof SIX_P_META)[SixPCategory]][]).map(([k, m]) => (
                    <option key={k} value={k}>{m.icon} {m.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Expected Output" className="flex-1 min-w-[220px]">
                <input className={INPUT_CLS} style={invalidStyle(attempted && !form.description.trim())} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. 2 journal articles in Scopus-indexed journals" />
              </Field>
              <Field label="Target" className="w-24">
                <input type="number" min="1" className={INPUT_CLS} style={invalidStyle(attempted && !Number(form.target_count))} value={form.target_count} onChange={(e) => setForm((f) => ({ ...f, target_count: e.target.value }))} />
              </Field>
              <button onClick={add} disabled={saving} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                {saving ? "Adding…" : "+ Add Target"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CreativeWorksTab({ projects, canCreate, userPk, projectLabel, nameOf }: { projects: Project[]; canCreate: boolean; userPk: number; projectLabel: (id: number) => string; nameOf: (id: number | null) => string }) {
  const [works, setWorks] = useState<CreativeWorkRecord[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ project: "", title: "", work_type: "", description: "", date_created: today(), rights_holder: "" });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let active = true;
    outputsApi
      .getCreativeWorks()
      .then((w) => active && setWorks(w))
      .catch(() => {
        if (!active) return;
        setWorks([]);
        notify.error("Could not load creative works.");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const save = async () => {
    setAttempted(true);
    if (!form.title.trim() || !form.work_type.trim() || !form.date_created) {
      notify.error("Title, work type, and date created are required.");
      return;
    }
    setSaving(true);
    try {
      await outputsApi.createCreativeWork({
        project: form.project ? Number(form.project) : null,
        creator: userPk,
        title: form.title.trim(),
        work_type: form.work_type.trim(),
        description: form.description || undefined,
        date_created: form.date_created,
        rights_holder: form.rights_holder || undefined,
      });
      notify.success("Creative work logged.");
      setShow(false);
      setForm({ project: "", title: "", work_type: "", description: "", date_created: today(), rights_holder: "" });
      setAttempted(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not log this creative work."));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (w: CreativeWorkRecord) => {
    try {
      await outputsApi.updateCreativeWork(w.id, { is_registered: !w.is_registered });
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the registration status."));
    }
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button onClick={() => setShow(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Log Creative Work
          </button>
        </div>
      )}
      {works === null ? (
        <SkeletonRows />
      ) : works.length === 0 ? (
        <NoActualData />
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <table className="w-full text-sm">
            <TableHead cols={["Title", "Work Type", "Project", "Creator", "Date Created", "Rights Holder", "Registered"]} />
            <tbody>
              {works.map((w) => (
                <tr key={w.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-4 py-3 text-xs font-bold" style={{ color: "#0d2a5e" }}>{w.title}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#334155" }}>{w.work_type}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "#0369a1" }}>{w.project ? projectLabel(w.project) : "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{nameOf(w.creator)}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "#64748b" }}>{w.date_created}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{w.rights_holder || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {canCreate ? (
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold" style={{ color: w.is_registered ? "#166534" : "#64748b" }}>
                        <input type="checkbox" checked={w.is_registered} onChange={() => toggle(w)} />
                        {w.is_registered ? "Registered" : "Not registered"}
                      </label>
                    ) : (
                      <span className="font-bold" style={{ color: w.is_registered ? "#166534" : "#64748b" }}>{w.is_registered ? "Registered" : "Not registered"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {show && (
        <ProtoModal
          title="Log Creative Work"
          onClose={() => setShow(false)}
          footer={
            <>
              <button onClick={() => setShow(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                {saving ? "Saving…" : "Log Creative Work"}
              </button>
            </>
          }
        >
          <Field label="Project (optional)">
            <select className={INPUT_CLS} style={INPUT_STYLE} value={form.project} onChange={set("project")}>
              <option value="">Not tied to a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Title" required>
            <input className={INPUT_CLS} style={invalidStyle(attempted && !form.title.trim())} value={form.title} onChange={set("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Work Type" required>
              <input className={INPUT_CLS} style={invalidStyle(attempted && !form.work_type.trim())} value={form.work_type} onChange={set("work_type")} placeholder="e.g. Film, Artwork, Software" />
            </Field>
            <Field label="Date Created" required>
              <input type="date" className={INPUT_CLS} style={invalidStyle(attempted && !form.date_created)} value={form.date_created} onChange={set("date_created")} />
            </Field>
          </div>
          <Field label="Description">
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={form.description} onChange={set("description")} />
          </Field>
          <Field label="Rights Holder">
            <input className={INPUT_CLS} style={INPUT_STYLE} value={form.rights_holder} onChange={set("rights_holder")} />
          </Field>
        </ProtoModal>
      )}
    </div>
  );
}

function SenseTab({ senses, canManage, onAdded }: { senses: SenseRankedPublisher[]; canManage: boolean; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const add = async () => {
    if (!name.trim()) {
      notify.error("Publisher name is required.");
      return;
    }
    setSaving(true);
    try {
      await outputsApi.createSensePublisher(name.trim());
      notify.success("Publisher added.");
      setName("");
      onAdded();
    } catch (err) {
      notify.error(errorMessage(err, "Could not add this publisher."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1" }}>
        Books published by a SENSE-ranked publisher qualify for the higher book incentive under the Manual's Article V. This list is institution-wide.
      </div>
      {canManage && (
        <div className="flex gap-2 max-w-lg">
          <input className={INPUT_CLS} style={INPUT_STYLE} value={name} onChange={(e) => setName(e.target.value)} placeholder="Publisher name" />
          <button onClick={add} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Adding…" : "+ Add"}
          </button>
        </div>
      )}
      {senses.length === 0 ? (
        <NoActualData />
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <table className="w-full text-sm">
            <TableHead cols={["Publisher", "Added"]} />
            <tbody>
              {senses.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-4 py-3 text-xs font-bold" style={{ color: "#0d2a5e" }}>{s.name}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "#64748b" }}>{s.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OutputsContent() {
  const { user } = useAuth();
  const code = user?.role?.code ?? "";
  const canManage = MANAGE_ROLE_CODES.includes(code);
  const canReport = REPORT_ROLE_CODES.includes(code);
  const canCreative = CREATIVE_WORK_ROLE_CODES.includes(code);

  const [tab, setTab] = useState<PageTab>("outputs");
  const [projects, setProjects] = useState<Project[]>([]);
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [senses, setSenses] = useState<SenseRankedPublisher[]>([]);
  const [data, setData] = useState<{ pubs: PublicationRecord[]; ips: IPRecord[]; exps: ExpectedOutput[]; outcomes: ProjectOutcome[] } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [senseKey, setSenseKey] = useState(0);

  const [familyFilter, setFamilyFilter] = useState<OutputFamily | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    let active = true;
    researchApi
      .getProjects()
      .then((p) => {
        if (!active) return;
        setProjects(p);
        setNames((m) => new Map([...m, ...p.map((x) => [x.lead_detail.id, x.lead_detail.email] as [number, string])]));
      })
      .catch(() => active && notify.error("Could not load projects."));
    personnelApi
      .getAssignments({ active: true })
      .then((a) => active && setNames((m) => new Map([...m, ...a.map((x) => [x.user_detail.id, x.user_detail.email] as [number, string])])))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    outputsApi
      .getSensePublishers()
      .then((s) => active && setSenses(s))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [senseKey]);

  useEffect(() => {
    let active = true;
    Promise.all([outputsApi.getPublications(), outputsApi.getIPRecords(), outputsApi.getExpectedOutputs(), outputsApi.getOutcomes()])
      .then(([pubs, ips, exps, outcomes]) => active && setData({ pubs, ips, exps, outcomes }))
      .catch(() => {
        if (!active) return;
        setData({ pubs: [], ips: [], exps: [], outcomes: [] });
        notify.error("Could not load research outputs.");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const nameOf = (id: number | null) => (id === null ? "—" : id === user?.pk ? user.email : names.get(id) ?? `User #${id}`);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectLabel = (id: number) => projectById.get(id)?.project_code ?? `Project #${id}`;
  const senseName = (id: number | null) => senses.find((s) => s.id === id)?.name ?? "—";

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    return [
      ...data.pubs.map((p) => ({
        key: `pub-${p.id}`,
        family: "publication" as const,
        project: p.project,
        title: p.title,
        subtype: PUBLICATION_TYPE_LABELS[p.publication_type],
        status: "published" as StatusKey,
        date: p.published_on,
        people: [p.lead_author],
        pub: p,
      })),
      ...data.ips.map((ip) => ({
        key: `ip-${ip.id}`,
        family: "ip" as const,
        project: ip.project,
        title: ip.title,
        subtype: IP_TYPE_LABELS[ip.ip_type],
        status: ip.status as StatusKey,
        date: ip.registered_on ?? ip.created_at.slice(0, 10),
        people: [ip.creator],
        ip,
      })),
      ...data.exps
        .filter((e) => e.category === "products" || e.category === "places_partnerships")
        .map((e) => ({
          key: `exp-${e.id}`,
          family: (e.category === "products" ? "technology" : "partnership") as OutputFamily,
          project: e.project,
          title: e.description,
          subtype: `${SIX_P_META[e.category].label} · ${e.actual_count}/${e.target_count}`,
          status: (e.actual_count >= e.target_count ? "met" : "in_progress") as StatusKey,
          date: e.created_at.slice(0, 10),
          people: [],
          exp: e,
        })),
      ...data.outcomes.map((o) => ({
        key: `out-${o.id}`,
        family: "outcome_impact" as const,
        project: o.project,
        title: o.description,
        subtype: o.kind === "impact" ? "🌱 Societal Impact" : "📈 Project Outcome",
        status: o.kind as StatusKey,
        date: o.observed_on ?? o.created_at.slice(0, 10),
        people: [o.recorded_by],
        outcome: o,
      })),
    ];
  }, [data]);

  const q = search.trim().toLowerCase();
  const filtered = items.filter(
    (o) =>
      (familyFilter === "all" || o.family === familyFilter) &&
      (statusFilter === "all" || o.status === statusFilter) &&
      (projectFilter === "all" || String(o.project) === projectFilter) &&
      (!q || o.title.toLowerCase().includes(q)),
  );

  const count = (f: OutputFamily) => items.filter((o) => o.family === f).length;
  const pubs = data?.pubs ?? [];
  const indexed = pubs.filter((p) => p.indexing_tier === "isi" || p.indexing_tier === "scopus").length;
  const publishedOrRegistered = pubs.length + (data?.ips ?? []).filter((i) => i.status === "registered" || i.status === "adopted").length;
  const incentiveTotal = pubs.reduce((sum, p) => sum + Number(p.estimated_incentive ?? 0), 0);
  const selected = items.find((o) => o.key === selectedKey) ?? null;

  const card = (o: Item) => {
    const fm = FAMILY_META[o.family];
    return (
      <div
        key={o.key}
        onClick={() => setSelectedKey(o.key)}
        className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md"
        style={{ background: "white", border: "1px solid #e2e8f0" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#0891b2";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#e2e8f0";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: fm.bg }}>{fm.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <StatusBadge s={o.status} />
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: fm.bg, color: fm.color }}>{o.subtype}</span>
            </div>
            <p className="text-xs font-bold leading-snug line-clamp-3" style={{ color: "#0d2a5e" }}>{o.title}</p>
            {o.people.length > 0 && (
              <p className="text-xs mt-0.5 truncate" style={{ color: "#94a3b8" }}>
                {o.people.map(nameOf).join("; ")}
                {o.ip?.co_creators ? `; ${o.ip.co_creators}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t gap-2" style={{ borderColor: "#f1f5f9" }}>
          <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>{projectLabel(o.project)} · {o.date}</span>
          {o.pub?.indexing_tier && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: INDEXING_COLORS[o.pub.indexing_tier].bg, color: INDEXING_COLORS[o.pub.indexing_tier].text }}>
              {INDEXING_LABELS[o.pub.indexing_tier].split(" ")[0].replace("-indexed", "")}
            </span>
          )}
          {!!o.pub?.estimated_incentive && <span className="text-xs font-bold font-mono" style={{ color: "#059669" }}>{peso(o.pub.estimated_incentive)}</span>}
          {o.ip?.incentive_eligible && !o.ip.incentive_claimed && <span className="text-xs font-bold" style={{ color: "#059669" }}>Incentive-eligible</span>}
        </div>
      </div>
    );
  };

  const filterCls = "px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none";
  const filterSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex gap-1 p-1 rounded-xl w-fit flex-wrap" style={{ background: "#e2e8f0" }}>
        {(
          [
            ["outputs", "🔬 Research Outputs"],
            ["sixps", "🎯 6Ps Expected vs Actual"],
            ["creative", "🎨 Creative Works"],
            ["sense", "🏷 SENSE Publishers"],
          ] as [PageTab, string][]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-lg text-xs font-bold transition-all" style={tab === k ? { background: "white", color: "#0d2a5e", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: "#64748b" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "sixps" && <SixPsTab projects={projects} canReport={canReport} />}
      {tab === "creative" && <CreativeWorksTab projects={projects} canCreate={canCreative} userPk={user?.pk ?? 0} projectLabel={projectLabel} nameOf={nameOf} />}
      {tab === "sense" && <SenseTab senses={senses} canManage={canManage} onAdded={() => setSenseKey((k) => k + 1)} />}

      {tab === "outputs" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["publication", "ip", "technology", "partnership"] as OutputFamily[]).map((f) => {
              const fm = FAMILY_META[f];
              return (
                <button key={f} onClick={() => setFamilyFilter(familyFilter === f ? "all" : f)} className="rounded-2xl p-4 text-left transition-all" style={{ background: familyFilter === f ? fm.bg : "white", border: `1.5px solid ${familyFilter === f ? fm.color + "40" : "#e2e8f0"}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xl">{fm.icon}</span>
                    <p className="text-3xl font-black" style={{ color: fm.color }}>{data ? count(f) : "—"}</p>
                  </div>
                  <p className="text-xs font-bold" style={{ color: fm.color }}>{fm.label}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Outcomes & Impacts", val: data ? count("outcome_impact") : "—", color: "#166534" },
              { label: "Total Outputs", val: data ? items.length : "—", color: "#0d2a5e" },
              { label: "Published / Registered", val: data ? publishedOrRegistered : "—", color: "#059669" },
              { label: "ISI / Scopus-indexed", val: data ? indexed : "—", color: "#c2410c" },
              { label: "Est. Publication Incentives", val: data ? peso(incentiveTotal) : "—", color: "#0369a1" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-4" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>{s.label}</p>
                <p className={`font-black mt-1 ${typeof s.val === "string" && s.val.startsWith("₱") ? "text-xl font-mono" : "text-3xl"}`} style={{ color: s.color }}>{s.val}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search outputs…" className="pl-7 pr-3 py-1.5 rounded-xl text-xs border outline-none" style={{ ...filterSt, width: "180px" }} />
              </div>
              <select value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value as OutputFamily | "all")} className={filterCls} style={filterSt}>
                <option value="all">All Families</option>
                {(Object.entries(FAMILY_META) as [OutputFamily, (typeof FAMILY_META)[OutputFamily]][]).map(([k, m]) => (
                  <option key={k} value={k}>{m.icon} {m.label}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusKey | "all")} className={filterCls} style={filterSt}>
                <option value="all">All Statuses</option>
                {(Object.entries(STATUS_META) as [StatusKey, (typeof STATUS_META)[StatusKey]][]).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={filterCls} style={filterSt}>
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_code}</option>
                ))}
              </select>
              <span className="text-xs self-center" style={{ color: "#94a3b8" }}>{filtered.length} outputs</span>
            </div>
            {canReport && (
              <button onClick={() => setShowRegister(true)} disabled={projects.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                Register Output
              </button>
            )}
          </div>

          {data === null ? (
            <SkeletonRows />
          ) : filtered.length === 0 ? (
            <NoActualData message={items.length === 0 ? "No actual data" : "No outputs match your filters."} hint={items.length === 0 && canReport ? 'Click "Register Output" to record the first one.' : undefined} />
          ) : familyFilter === "all" ? (
            <div className="space-y-6">
              {(Object.keys(FAMILY_META) as OutputFamily[]).map((f) => {
                const group = filtered.filter((o) => o.family === f);
                if (group.length === 0) return null;
                const fm = FAMILY_META[f];
                return (
                  <div key={f}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{fm.icon}</span>
                      <p className="font-black text-sm" style={{ color: fm.color }}>{fm.label}</p>
                      <span className="text-xs ml-auto shrink-0" style={{ color: "#94a3b8" }}>{group.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{group.map(card)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map(card)}</div>
          )}
        </>
      )}

      {selected && (
        <OutputDetailModal
          key={`${selected.key}-${selected.ip?.status}-${selected.ip?.incentive_claimed}-${selected.exp?.manual_actual_count}`}
          item={selected}
          projectLabel={projectLabel(selected.project)}
          nameOf={nameOf}
          senseName={senseName}
          canReport={canReport}
          onClose={() => setSelectedKey(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
      {showRegister && (
        <RegisterOutputModal
          projects={projects}
          senses={senses}
          userPk={user?.pk ?? 0}
          onClose={() => setShowRegister(false)}
          onSaved={() => {
            setShowRegister(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

export default function OutputsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Research Outputs">
        <OutputsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
