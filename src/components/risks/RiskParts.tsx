import { useEffect, useState, type ReactNode } from "react";
import { riskApi } from "../../lib/riskApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../../lib/protoStyles";
import { CAT_META, IMP_LABELS, LEVEL_META, LH_LABELS, STATUS_META, levelOf } from "../../lib/riskMeta";
import type { ProjectRisk, RiskCategory, RiskLevel, RiskRegisterStatus, RiskUpdate } from "../../types/risk";
import type { Project } from "../../types/research";
import { Field, ProtoModal, SkeletonRows } from "../common/proto";

const fmtDate = (iso: string) => iso.slice(0, 10);

export function LevelBadge({ level }: { level: RiskLevel }) {
  const m = LEVEL_META[level];
  return <span className="px-2 py-0.5 rounded-full text-xs font-black" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}

export function StatusBadge({ status }: { status: RiskRegisterStatus }) {
  const m = STATUS_META[status];
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}

export function CatChip({ category }: { category: RiskCategory }) {
  const m = CAT_META[category];
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: m.bg, color: m.color }}>{m.icon} {m.label}</span>;
}

export function RiskHeatMap({ risks }: { risks: ProjectRisk[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Risk Heat Map — Likelihood × Impact</p>
      <div className="inline-block">
        <div className="flex">
          <div className="w-20 shrink-0" />
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-11 text-center text-xs font-semibold" style={{ color: "#94a3b8", fontSize: "9px" }}>{IMP_LABELS[i].slice(0, 4)}</div>
            ))}
          </div>
        </div>
        <div className="flex items-start">
          <div className="flex flex-col gap-1 w-20 shrink-0">
            {[5, 4, 3, 2, 1].map((l) => (
              <div key={l} className="h-11 flex items-center justify-end pr-2 text-xs font-semibold" style={{ color: "#94a3b8", fontSize: "9px" }}>
                {LH_LABELS[l].slice(0, 7)}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((l) => (
              <div key={l} className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => {
                  const cellRisks = risks.filter((r) => r.likelihood === l && r.impact === i);
                  return (
                    <div key={i} className="w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5" style={{ background: LEVEL_META[levelOf(l * i)].heat }} title={cellRisks.map((r) => `R-${r.id}`).join(", ")}>
                      {cellRisks.length > 0 && (
                        <>
                          <span className="text-sm font-black" style={{ color: "#1e293b" }}>{cellRisks.length}</span>
                          <span className="max-w-full truncate px-0.5" style={{ fontSize: "8px", color: "#475569" }}>{cellRisks.map((r) => r.id).join(",")}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex mt-2">
          <div className="w-20 shrink-0" />
          <p className="text-xs text-center w-full font-semibold" style={{ color: "#94a3b8" }}>← Impact →</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {(["low", "medium", "high", "critical"] as RiskLevel[]).map((k) => {
          const m = LEVEL_META[k];
          return (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: m.bg, border: `1px solid ${m.color}40` }} />
              <span className="text-xs font-semibold" style={{ color: m.color }}>{m.label} ({m.range})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RiskCard({ risk, nameOf, canManage, onView, onUpdate }: { risk: ProjectRisk; nameOf: (id: number) => string; canManage: boolean; onView: () => void; onUpdate: () => void }) {
  const lm = LEVEL_META[risk.level];
  return (
    <div className="rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer" style={{ background: "white", border: `1.5px solid ${lm.color}30` }} onClick={onView}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ background: lm.bg }}>
          <p className="text-lg font-black leading-none" style={{ color: lm.color }}>{risk.score}</p>
          <p style={{ fontSize: "8px", color: lm.color, fontWeight: 700 }}>/25</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold line-clamp-2" style={{ color: "#0d2a5e" }}>{risk.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <LevelBadge level={risk.level} />
            <CatChip category={risk.category} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: "5px", background: "#e2e8f0" }}>
          <div className="h-full rounded-full" style={{ width: `${(risk.score / 25) * 100}%`, background: lm.color }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "#f8fafc" }}>
          <p style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 700 }}>LIKELIHOOD</p>
          <p className="text-xs font-black" style={{ color: "#0891b2" }}>{risk.likelihood} – {LH_LABELS[risk.likelihood]}</p>
        </div>
        <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "#f8fafc" }}>
          <p style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 700 }}>IMPACT</p>
          <p className="text-xs font-black" style={{ color: "#7c3aed" }}>{risk.impact} – {IMP_LABELS[risk.impact]}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs truncate font-semibold" style={{ color: "#334155" }}>{nameOf(risk.owner)}</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>Risk Owner</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={risk.status} />
          <p className="text-xs" style={{ color: "#94a3b8", fontSize: "9px" }}>Updated {fmtDate(risk.updated_at)}</p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: "#f1f5f9" }}>
        <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
          Mitigation: <span style={{ fontWeight: 700, color: risk.mitigation ? "#059669" : "#dc2626" }}>{risk.mitigation ? "Defined" : "Not yet defined"}</span>
        </p>
        {canManage && (
          <button onClick={(e) => { e.stopPropagation(); onUpdate(); }} className="text-xs px-2.5 py-1 rounded-lg font-bold shrink-0" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
            Update
          </button>
        )}
      </div>
    </div>
  );
}

function LevelPreview({ likelihood, impact, prefix }: { likelihood: number; impact: number; prefix: string }) {
  const lm = LEVEL_META[levelOf(likelihood * impact)];
  return (
    <div className="w-full rounded-xl px-4 py-3 text-center" style={{ background: lm.bg }}>
      <p className="text-xs font-semibold mb-0.5" style={{ color: lm.color }}>{prefix}</p>
      <p className="text-lg font-black" style={{ color: lm.color }}>{lm.label}</p>
      <p className="text-xs" style={{ color: lm.color }}>Score: {likelihood * impact} · {lm.action}</p>
    </div>
  );
}

function Slider({ label, value, labels, onChange, low, high }: { label: string; value: number; labels: Record<number, string>; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div>
      <label className="label-field">
        {label} · <strong>{value} – {labels[value]}</strong>
      </label>
      <input type="range" min={1} max={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full mt-1" />
      <div className="flex justify-between mt-0.5">
        <span className="text-xs" style={{ color: "#94a3b8" }}>{low}</span>
        <span className="text-xs" style={{ color: "#94a3b8" }}>{high}</span>
      </div>
    </div>
  );
}

export function IdentifyRiskModal({
  projects,
  defaultProject,
  ownerOptions,
  currentUserId,
  onSaved,
  onClose,
}: {
  projects: Project[];
  defaultProject: number | null;
  ownerOptions: (projectId: number) => { id: number; label: string }[];
  currentUserId: number | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [project, setProject] = useState<number | "">(defaultProject ?? projects[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RiskCategory>("schedule");
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [owner, setOwner] = useState<number | "">(currentUserId ?? "");
  const [mitigation, setMitigation] = useState("");
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const owners = project === "" ? [] : ownerOptions(project);
  const valid = project !== "" && owner !== "" && description.trim() !== "";

  const save = async () => {
    setTried(true);
    if (!valid) return;
    setSaving(true);
    try {
      await riskApi.createRisk({ project, description: description.trim(), category, likelihood, impact, owner, mitigation: mitigation.trim() });
      notify.success("Risk identified and added to the register.");
      onSaved();
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not register the risk."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Identify Risk"
      subtitle="Register a new risk · classify · assess · assign an owner"
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {saving ? "Saving…" : "Identify Risk"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Project" required className="col-span-2">
          <select value={project} onChange={(e) => setProject(e.target.value ? Number(e.target.value) : "")} className={INPUT_CLS} style={invalidStyle(tried && project === "")}>
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Risk Description" required className="col-span-2">
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLS + " resize-none"} style={invalidStyle(tried && !description.trim())} placeholder="Describe the risk event and its potential consequences…" />
        </Field>
        <Field label="Risk Category" required>
          <select value={category} onChange={(e) => setCategory(e.target.value as RiskCategory)} className={INPUT_CLS} style={INPUT_STYLE}>
            {(Object.keys(CAT_META) as RiskCategory[]).map((k) => (
              <option key={k} value={k}>{CAT_META[k].icon} {CAT_META[k].label}</option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <LevelPreview likelihood={likelihood} impact={impact} prefix="Computed Risk Level" />
        </div>
        <Slider label="Likelihood" value={likelihood} labels={LH_LABELS} onChange={setLikelihood} low="Rare" high="Almost Certain" />
        <Slider label="Impact" value={impact} labels={IMP_LABELS} onChange={setImpact} low="Negligible" high="Catastrophic" />
        <Field label="Risk Owner" required className="col-span-2">
          <select value={owner} onChange={(e) => setOwner(e.target.value ? Number(e.target.value) : "")} className={INPUT_CLS} style={invalidStyle(tried && owner === "")}>
            <option value="">Select the owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Mitigation Actions" className="col-span-2">
          <textarea rows={3} value={mitigation} onChange={(e) => setMitigation(e.target.value)} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} placeholder="Specific actions to reduce likelihood or impact…" />
        </Field>
      </div>
    </ProtoModal>
  );
}

export function UpdateRiskModal({ risk, onSaved, onClose }: { risk: ProjectRisk; onSaved: () => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<RiskRegisterStatus>(risk.status);
  const [likelihood, setLikelihood] = useState(risk.likelihood);
  const [impact, setImpact] = useState(risk.impact);
  const [mitigation, setMitigation] = useState(risk.mitigation);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const save = async () => {
    setTried(true);
    if (!note.trim()) return;
    setSaving(true);
    try {
      const reassessed = likelihood !== risk.likelihood || impact !== risk.impact;
      if (reassessed || mitigation.trim() !== risk.mitigation) {
        await riskApi.updateRisk(risk.id, { likelihood, impact, mitigation: mitigation.trim() });
      }
      const suffix = reassessed ? ` [Re-assessed L${risk.likelihood}×I${risk.impact} → L${likelihood}×I${impact}]` : "";
      await riskApi.addUpdate(risk.id, { note: note.trim() + suffix, new_status: status !== risk.status ? status : "" });
      notify.success("Risk updated.");
      onSaved();
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the risk."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Update Risk"
      subtitle={<span className="line-clamp-1">R-{risk.id} · {risk.description}</span>}
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {saving ? "Saving…" : "Save Update"}
          </button>
        </>
      }
    >
      <div className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Re-assess</p>
        <div className="grid grid-cols-2 gap-4">
          <Slider label="Likelihood" value={likelihood} labels={LH_LABELS} onChange={setLikelihood} low="Rare" high="Almost Certain" />
          <Slider label="Impact" value={impact} labels={IMP_LABELS} onChange={setImpact} low="Negligible" high="Catastrophic" />
        </div>
        <div className="mt-3">
          <LevelPreview likelihood={likelihood} impact={impact} prefix="Updated Level" />
        </div>
      </div>
      <Field label="Risk Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as RiskRegisterStatus)} className={INPUT_CLS} style={INPUT_STYLE}>
          {(Object.keys(STATUS_META) as RiskRegisterStatus[]).map((k) => (
            <option key={k} value={k}>{STATUS_META[k].label}</option>
          ))}
        </select>
      </Field>
      <Field label="Mitigation Actions">
        <textarea rows={3} value={mitigation} onChange={(e) => setMitigation(e.target.value)} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} />
      </Field>
      <Field label="Update Note" required>
        <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_CLS + " resize-none"} style={invalidStyle(tried && !note.trim())} placeholder="Latest risk status, actions taken, observed changes…" />
      </Field>
    </ProtoModal>
  );
}

export function RiskDetailModal({
  risk,
  projectLabel,
  nameOf,
  canManage,
  onUpdate,
  onClose,
}: {
  risk: ProjectRisk;
  projectLabel: string;
  nameOf: (id: number) => string;
  canManage: boolean;
  onUpdate: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"detail" | "history">("detail");
  const [updates, setUpdates] = useState<RiskUpdate[] | null>(null);
  const lm = LEVEL_META[risk.level];

  useEffect(() => {
    let alive = true;
    riskApi
      .getUpdates(risk.id)
      .then((u) => alive && setUpdates(u))
      .catch(() => alive && setUpdates([]));
    return () => {
      alive = false;
    };
  }, [risk.id]);

  const box = (label: string, body: ReactNode) => (
    <div className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>{label}</p>
      {body}
    </div>
  );

  return (
    <ProtoModal
      title={
        <div className="flex items-start justify-between gap-4">
          <span className="line-clamp-2">{risk.description}</span>
          <span className="text-right shrink-0">
            <span className="block text-3xl font-black text-white leading-none">{risk.score}</span>
            <span className="block text-xs font-normal text-white/50">Risk Score</span>
          </span>
        </div>
      }
      subtitle={`R-${risk.id} · ${projectLabel} · Identified ${fmtDate(risk.created_at)}`}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Close</button>
          {canManage && (
            <button onClick={onUpdate} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a5e" }}>Update Risk</button>
          )}
        </>
      }
    >
      <div className="flex border-b -mx-6 -mt-6 mb-2 px-2" style={{ borderColor: "#e2e8f0" }}>
        {(
          [
            ["detail", "Risk Profile"],
            ["history", "Update History"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
            {l}
          </button>
        ))}
      </div>
      {tab === "detail" && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Risk Level", val: lm.label, color: lm.color, bg: lm.bg },
              { label: "Score", val: `${risk.score}/25`, color: lm.color, bg: lm.bg },
              { label: "Likelihood", val: `${risk.likelihood} – ${LH_LABELS[risk.likelihood]}`, color: "#0891b2", bg: "#e0f2fe" },
              { label: "Impact", val: `${risk.impact} – ${IMP_LABELS[risk.impact]}`, color: "#7c3aed", bg: "#ede9fe" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                <p className="text-sm font-black leading-tight" style={{ color: s.color }}>{s.val}</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: s.color }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <CatChip category={risk.category} />
            <StatusBadge status={risk.status} />
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#f1f5f9", color: lm.color }}>Action: {lm.action}</span>
          </div>
          {box("Description", <p className="text-sm" style={{ color: "#334155" }}>{risk.description}</p>)}
          {box(
            "Risk Owner",
            <>
              <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{nameOf(risk.owner)}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>Registered by {nameOf(risk.created_by)}</p>
            </>,
          )}
          {box("Mitigation Actions", <p className="text-sm whitespace-pre-line" style={{ color: "#334155" }}>{risk.mitigation || "Not yet defined."}</p>)}
        </>
      )}
      {tab === "history" &&
        (updates === null ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Update History · {updates.length + 1} entries</p>
            {[
              ...updates.map((u) => ({ id: `u${u.id}`, date: u.created_at, by: u.author_email, note: u.note, status: u.new_status })),
              { id: "identified", date: risk.created_at, by: nameOf(risk.created_by), note: "Risk identified and registered.", status: "" as const },
            ].map((u, i, all) => (
              <div key={u.id} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-3 h-3 rounded-full mt-1" style={{ background: i === 0 ? "#0d2a5e" : "#e2e8f0", border: "2px solid #0d2a5e" }} />
                  {i < all.length - 1 && <div className="w-0.5 flex-1 my-1" style={{ background: "#e2e8f0", minHeight: "16px" }} />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-xs font-mono font-bold" style={{ color: "#0d2a5e" }}>{fmtDate(u.date)}</p>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>by {u.by}</p>
                    {u.status && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: STATUS_META[u.status].bg, color: STATUS_META[u.status].color }}>→ {STATUS_META[u.status].label}</span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "#334155" }}>{u.note}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
    </ProtoModal>
  );
}
