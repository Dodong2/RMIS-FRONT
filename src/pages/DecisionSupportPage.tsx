import { useEffect, useMemo, useState } from "react";
import { decisionSupportApi } from "../lib/decisionSupportApi";
import { researchApi } from "../lib/researchApi";
import { authApi } from "../lib/authApi";
import { errorMessage } from "../lib/errorMessage";
import { notify } from "../lib/notify";
import { PROJECT_STATUS_LABELS } from "../lib/projectStatus";
import { BTN_GHOST_STYLE, INPUT_CLS, INPUT_STYLE, invalidStyle } from "../lib/protoStyles";
import type {
  AHPMatrixRun,
  CriterionMetricKey,
  DecisionCriterion,
  DecisionRecord,
  FundingDecision,
  FundingRecommendationRun,
  ProjectScore,
  SensitivityAnalysisResult,
} from "../types/decisionSupport";
import type { Project } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { Field, Pill, ProtoModal, SkeletonRows } from "../components/common/proto";
import { NoActualData } from "../components/common/NoActualData";

const DSS_ROLE_CODES = ["system_admin", "drd", "vprei"];
const DECISION_ROLE_CODES = ["system_admin", "drd", "vprei", "university_admin"];

type IndicatorDomain = "budget" | "performance" | "outputs" | "compliance" | "risk";
type ScoreGrade = "excellent" | "good" | "average" | "poor" | "critical";

const DOMAIN_META: Record<IndicatorDomain, { label: string; color: string; bg: string; icon: string }> = {
  budget: { label: "Budget", color: "#0891b2", bg: "#e0f2fe", icon: "💰" },
  performance: { label: "Performance", color: "#7c3aed", bg: "#ede9fe", icon: "🎯" },
  outputs: { label: "Outputs", color: "#059669", bg: "#d1fae5", icon: "📄" },
  compliance: { label: "Compliance", color: "#f59e0b", bg: "#fef3c7", icon: "✅" },
  risk: { label: "Risk", color: "#dc2626", bg: "#fee2e2", icon: "⚠️" },
};

const METRIC_META: Record<CriterionMetricKey, { label: string; domain: IndicatorDomain; formula: string }> = {
  output_score: { label: "Research Output Volume", domain: "outputs", formula: "publications + IP records + creative works" },
  compliance_score: { label: "Compliance Completeness", domain: "compliance", formula: "approved ethics reviews / all ethics reviews (0.5 if none)" },
  budget_utilization_pct: { label: "Budget Utilization %", domain: "budget", formula: "disbursed / current budget's line-item total × 100" },
  monitoring_health: { label: "Monitoring/Reporting Health", domain: "performance", formula: "on track = 1, notify Dean/RIUH = 0.5, terminate recommended = 0" },
  renewal_eligible: { label: "Renewal Eligibility", domain: "performance", formula: "1 if renewal-eligible, else 0" },
  overrun_risk_inverse: { label: "Forecast Overrun-Risk (inverse)", domain: "budget", formula: "latest forecast: overrun risk = 0, none = 1 (0.5 if no forecast)" },
  risk_score_inverse: { label: "Project Risk Score (inverse)", domain: "risk", formula: "25 − project risk score (5×5 likelihood × impact)" },
};

const GRADE_META: Record<ScoreGrade, { label: string; color: string; bg: string }> = {
  excellent: { label: "Excellent", color: "#059669", bg: "#d1fae5" },
  good: { label: "Good", color: "#0891b2", bg: "#e0f2fe" },
  average: { label: "Average", color: "#f59e0b", bg: "#fef3c7" },
  poor: { label: "Poor", color: "#ea580c", bg: "#ffedd5" },
  critical: { label: "Critical", color: "#dc2626", bg: "#fee2e2" },
};

const DECISION_META: Record<FundingDecision, { label: string; color: string; bg: string }> = {
  fund: { label: "Fund", color: "#059669", bg: "#d1fae5" },
  defer: { label: "Defer", color: "#f59e0b", bg: "#fef3c7" },
  decline: { label: "Decline", color: "#dc2626", bg: "#fee2e2" },
};

const FUNDING_TYPE_LABELS: Record<string, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const SAATY_SCALE: { value: string; numeric: number; label: string }[] = [
  { value: "1/9", numeric: 1 / 9, label: "1/9 — Column extremely more important" },
  { value: "1/7", numeric: 1 / 7, label: "1/7 — Column very strongly more important" },
  { value: "1/5", numeric: 1 / 5, label: "1/5 — Column strongly more important" },
  { value: "1/3", numeric: 1 / 3, label: "1/3 — Column moderately more important" },
  { value: "1", numeric: 1, label: "1 — Equal importance" },
  { value: "3", numeric: 3, label: "3 — Row moderately more important" },
  { value: "5", numeric: 5, label: "5 — Row strongly more important" },
  { value: "7", numeric: 7, label: "7 — Row very strongly more important" },
  { value: "9", numeric: 9, label: "9 — Row extremely more important" },
];

const saatyValueFor = (numeric: number) => SAATY_SCALE.find((s) => Math.abs(s.numeric - numeric) < 1e-6)?.value ?? "1";

const to100 = (v: number) => Math.round(v * 100);
const peso = (n: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(n));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

function scoreToGrade(score: number): ScoreGrade {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "average";
  if (score >= 35) return "poor";
  return "critical";
}

function GradeBadge({ grade }: { grade: ScoreGrade }) {
  const m = GRADE_META[grade];
  return <span className="px-2 py-0.5 rounded-full text-xs font-black" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}

function DomainChip({ domain }: { domain: IndicatorDomain }) {
  const m = DOMAIN_META[domain];
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: m.bg, color: m.color }}>{m.icon} {m.label}</span>;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: "6px", background: "#e2e8f0" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-bold w-8 text-right shrink-0" style={{ color }}>{value}</span>
    </div>
  );
}

function DecisionPill({ decision }: { decision: FundingDecision }) {
  const m = DECISION_META[decision];
  return <Pill bg={m.bg} color={m.color}>{m.label}</Pill>;
}

function DefineIndicatorModal({ onCreated, onClose }: { onCreated: (c: DecisionCriterion) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [metricKey, setMetricKey] = useState<CriterionMetricKey | "">("");
  const [description, setDescription] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setAttempted(true);
    if (!name.trim() || !metricKey) return;
    setIsSaving(true);
    try {
      const created = await decisionSupportApi.createCriterion({ name: name.trim(), metric_key: metricKey, description: description.trim() });
      onCreated(created);
      notify.success("Indicator added.");
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not add this indicator."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Define Decision Indicator — DSS-01"
      subtitle="Add a new measurable criterion that AHP models can weigh"
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {isSaving ? "Adding…" : "Add Indicator"}
          </button>
        </>
      }
    >
      <Field label="Indicator Name" required>
        <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} style={invalidStyle(attempted && !name.trim())} placeholder="e.g. Output Volume" />
      </Field>
      <Field label="Measured From" required>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value as CriterionMetricKey)} className={INPUT_CLS} style={invalidStyle(attempted && !metricKey)}>
          <option value="">Select a metric</option>
          {(Object.keys(METRIC_META) as CriterionMetricKey[]).map((k) => (
            <option key={k} value={k}>{DOMAIN_META[METRIC_META[k].domain].icon} {METRIC_META[k].label}</option>
          ))}
        </select>
      </Field>
      {metricKey && (
        <div className="rounded-lg px-3 py-2 text-xs font-mono" style={{ background: "#f1f5f9", color: "#64748b" }}>{METRIC_META[metricKey].formula}</div>
      )}
      <Field label="Description">
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} placeholder="What does this indicator measure?" />
      </Field>
    </ProtoModal>
  );
}

function NewModelModal({ criteria, onCreated, onClose }: { criteria: DecisionCriterion[]; onCreated: (r: AHPMatrixRun) => void; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [ids, setIds] = useState<number[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const active = criteria.filter((c) => c.is_active);

  const toggle = (id: number) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    setAttempted(true);
    if (!label.trim() || ids.length === 0) return;
    setIsSaving(true);
    try {
      const run = await decisionSupportApi.createAHPRun({ label: label.trim(), criteria: ids });
      onCreated(run);
      notify.success("Model created. Set its weights with the pairwise comparisons.");
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not create this model."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtoModal
      title="New DSS Model"
      subtitle="An AHP weighting run over a set of indicators"
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {isSaving ? "Creating…" : "Create Model"}
          </button>
        </>
      }
    >
      <Field label="Model Name" required>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT_CLS} style={invalidStyle(attempted && !label.trim())} placeholder="e.g. 2026 Funding Cycle" />
      </Field>
      <Field label="Indicators to Weigh" required>
        {active.length === 0 ? (
          <p className="text-xs" style={{ color: "#94a3b8" }}>Define an indicator first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((c) => {
              const on = ids.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: on ? "#0d2a5e" : "#f8fafc", color: on ? "white" : "#475569", border: `1.5px solid ${on ? "#0d2a5e" : attempted && ids.length === 0 ? "#dc2626" : "#e2e8f0"}` }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </Field>
    </ProtoModal>
  );
}

function PairwiseModal({
  run,
  runCriteria,
  onFinalized,
  onClose,
}: {
  run: AHPMatrixRun;
  runCriteria: DecisionCriterion[];
  onFinalized: (r: AHPMatrixRun) => void;
  onClose: () => void;
}) {
  const pairs = useMemo(() => {
    const out: { row: DecisionCriterion; col: DecisionCriterion }[] = [];
    for (let i = 0; i < runCriteria.length; i++) for (let j = i + 1; j < runCriteria.length; j++) out.push({ row: runCriteria[i], col: runCriteria[j] });
    return out;
  }, [runCriteria]);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const { row, col } of pairs) {
      const existing = run.comparisons.find((c) => c.criterion_row === row.id && c.criterion_col === col.id);
      const reverse = run.comparisons.find((c) => c.criterion_row === col.id && c.criterion_col === row.id);
      init[`${row.id}-${col.id}`] = existing ? saatyValueFor(existing.value) : reverse ? saatyValueFor(1 / reverse.value) : "1";
    }
    return init;
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleFinalize = async () => {
    setIsSaving(true);
    try {
      if (pairs.length > 0) {
        await decisionSupportApi.submitComparisons(
          run.id,
          pairs.map(({ row, col }) => ({
            criterion_row: row.id,
            criterion_col: col.id,
            value: SAATY_SCALE.find((s) => s.value === values[`${row.id}-${col.id}`])?.numeric ?? 1,
          })),
        );
      }
      const finalized = await decisionSupportApi.finalizeAHPRun(run.id);
      onFinalized(finalized);
      if (finalized.is_consistent) notify.success("Weights finalized — consistency ratio is acceptable.");
      else notify.error("Weights finalized, but the consistency ratio exceeds 0.10. This model can't be used to run the DSS.");
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not finalize these weights."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Assign Weights — DSS-02"
      subtitle={`${run.label} · pairwise comparison, Saaty 1–9 scale`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={handleFinalize} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {isSaving ? "Finalizing…" : "Finalize Weights"}
          </button>
        </>
      }
    >
      {pairs.length === 0 ? (
        <p className="text-sm" style={{ color: "#64748b" }}>Only one indicator in this model, so no comparison is needed. It gets 100% of the weight.</p>
      ) : (
        <>
          <p className="text-xs" style={{ color: "#64748b" }}>For each pair, pick which indicator matters more and by how much. Finalizing computes the weights and the consistency ratio (must be ≤ 0.10).</p>
          <div className="space-y-2">
            {pairs.map(({ row, col }) => {
              const key = `${row.id}-${col.id}`;
              return (
                <div key={key} className="rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <p className="text-xs font-bold" style={{ color: "#0d2a5e" }}>
                    {row.name} <span className="font-normal" style={{ color: "#94a3b8" }}>vs.</span> {col.name}
                  </p>
                  <select value={values[key] ?? "1"} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE}>
                    {SAATY_SCALE.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ProtoModal>
  );
}

function ScoreDetailModal({
  score,
  project,
  runCriteria,
  weights,
  modelLabel,
  decision,
  canDecide,
  onDecide,
  onClose,
}: {
  score: ProjectScore;
  project: Project | undefined;
  runCriteria: DecisionCriterion[];
  weights: Record<string, number>;
  modelLabel: string;
  decision: DecisionRecord | undefined;
  canDecide: boolean;
  onDecide: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"breakdown" | "radar">("breakdown");
  const total = to100(score.composite_score);
  const gm = GRADE_META[scoreToGrade(total)];

  return (
    <ProtoModal
      title={project?.title ?? `Project #${score.project}`}
      subtitle={`${project?.project_code ?? ""} · ${modelLabel} · DSS Score ${total}/100`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Close</button>
          {canDecide && (
            <button onClick={onDecide} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#0d2a5e" }}>
              {decision ? "Update Decision — DSS-05" : "Record Decision — DSS-05"}
            </button>
          )}
        </>
      }
    >
      <div className="flex border-b -mt-2" style={{ borderColor: "#e2e8f0" }}>
        {(
          [
            ["breakdown", "Score Breakdown"],
            ["radar", "Indicator Radar"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "DSS Score", val: `${total}/100`, color: gm.color, bg: gm.bg },
          { label: "Grade", val: gm.label, color: gm.color, bg: gm.bg },
          { label: "Rank", val: `#${score.rank}`, color: "#0d2a5e", bg: "#e0eaf7" },
          { label: "Decision", val: decision ? DECISION_META[decision.decision].label : "Pending", color: decision ? DECISION_META[decision.decision].color : "#64748b", bg: decision ? DECISION_META[decision.decision].bg : "#f1f5f9" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
            <p className="text-lg font-black" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {tab === "breakdown" && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Per-Indicator Scores — DSS-03</p>
          {runCriteria.map((c) => {
            const meta = METRIC_META[c.metric_key];
            const dm = DOMAIN_META[meta.domain];
            const norm = score.normalized_scores[String(c.id)] ?? 0;
            const w = weights[String(c.id)] ?? 0;
            const raw = score.raw_scores[String(c.id)];
            return (
              <div key={c.id} className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DomainChip domain={meta.domain} />
                    <p className="text-xs font-bold" style={{ color: "#334155" }}>{c.name}</p>
                  </div>
                  <span className="text-xs font-mono font-black shrink-0" style={{ color: dm.color }}>+{(norm * w * 100).toFixed(1)} pts</span>
                </div>
                <ScoreBar value={to100(norm)} color={dm.color} />
                <div className="flex justify-between gap-2 mt-1.5">
                  <p className="text-xs" style={{ color: "#94a3b8" }}>raw value {raw === undefined ? "—" : Number(raw.toFixed(2))}</p>
                  <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>weight {(w * 100).toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "radar" && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Domain Radar — DSS-04</p>
          {(Object.keys(DOMAIN_META) as IndicatorDomain[]).map((domain) => {
            const inDomain = runCriteria.filter((c) => METRIC_META[c.metric_key].domain === domain);
            if (inDomain.length === 0) return null;
            const avg = Math.round(inDomain.reduce((s, c) => s + to100(score.normalized_scores[String(c.id)] ?? 0), 0) / inDomain.length);
            const dm = DOMAIN_META[domain];
            return (
              <div key={domain} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-32 shrink-0">
                  <span>{dm.icon}</span>
                  <p className="text-xs font-semibold" style={{ color: "#334155" }}>{dm.label}</p>
                </div>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: "10px", background: "#e2e8f0" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: avg >= 70 ? dm.color : avg >= 40 ? "#f59e0b" : "#dc2626" }} />
                </div>
                <span className="text-sm font-black w-8 shrink-0 text-right" style={{ color: dm.color }}>{avg}</span>
              </div>
            );
          })}
        </div>
      )}
    </ProtoModal>
  );
}

function RecordDecisionModal({
  runId,
  score,
  project,
  existing,
  onSaved,
  onClose,
}: {
  runId: number;
  score: ProjectScore;
  project: Project | undefined;
  existing: DecisionRecord | undefined;
  onSaved: (d: DecisionRecord) => void;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<FundingDecision>(existing?.decision ?? "fund");
  const [amount, setAmount] = useState(existing?.indicative_amount ?? "");
  const [rationale, setRationale] = useState(existing?.rationale ?? "");
  const [reference, setReference] = useState(existing?.reference_number ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const total = to100(score.composite_score);
  const grade = scoreToGrade(total);
  const dm = DECISION_META[decision];

  const handleSave = async () => {
    if (!rationale.trim()) return;
    setIsSaving(true);
    try {
      const saved = await decisionSupportApi.recordDecision(runId, {
        project: score.project,
        decision,
        indicative_amount: decision === "fund" && amount.trim() ? amount.trim() : null,
        rationale: rationale.trim(),
        reference_number: reference.trim(),
      });
      onSaved(saved);
      notify.success("Decision recorded.");
      onClose();
    } catch (err) {
      notify.error(errorMessage(err, "Could not record this decision."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtoModal
      title="Record Decision — DSS-05"
      subtitle={`${project?.project_code ?? `Project #${score.project}`} · DSS Score: ${total}/100`}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={BTN_GHOST_STYLE}>Cancel</button>
          <button onClick={handleSave} disabled={!rationale.trim() || isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
            {isSaving ? "Saving…" : "Record Decision"}
          </button>
        </>
      }
    >
      <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div className="text-center">
          <p className="text-3xl font-black" style={{ color: GRADE_META[grade].color }}>{total}</p>
          <p className="text-xs font-bold" style={{ color: "#94a3b8" }}>DSS Score</p>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>{project?.title ?? `Project #${score.project}`}</p>
          <GradeBadge grade={grade} />
          <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Rank #{score.rank}</p>
        </div>
      </div>
      <Field label="Management Decision" required>
        <select value={decision} onChange={(e) => setDecision(e.target.value as FundingDecision)} className={INPUT_CLS} style={INPUT_STYLE}>
          {(Object.keys(DECISION_META) as FundingDecision[]).map((k) => (
            <option key={k} value={k}>{DECISION_META[k].label}</option>
          ))}
        </select>
        <div className="mt-2 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: dm.bg, color: dm.color }}>Selected: {dm.label}</div>
      </Field>
      {decision === "fund" && (
        <Field label="Indicative Amount (₱, optional)">
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} placeholder="Entered by the decider, not computed" />
        </Field>
      )}
      <Field label="Rationale / Decision Basis" required>
        <textarea rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} placeholder="Document the reasoning behind this decision, including key score drivers…" />
      </Field>
      <Field label="Reference No. (optional)">
        <input value={reference} onChange={(e) => setReference(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} placeholder="e.g. BOR Resolution No. 2026-014" />
      </Field>
      {existing && <p className="text-xs" style={{ color: "#94a3b8" }}>This replaces the decision already recorded for this project on this run.</p>}
    </ProtoModal>
  );
}

function DecisionSupportContent() {
  const { user } = useAuth();
  const roleCode = user?.role?.code ?? "";
  const canManage = DSS_ROLE_CODES.includes(roleCode);
  const canDecide = DECISION_ROLE_CODES.includes(roleCode);

  const [isLoading, setIsLoading] = useState(true);
  const [criteria, setCriteria] = useState<DecisionCriterion[]>([]);
  const [ahpRuns, setAhpRuns] = useState<AHPMatrixRun[]>([]);
  const [recRuns, setRecRuns] = useState<FundingRecommendationRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [activeModelId, setActiveModelId] = useState<number | null>(null);
  const [activeRecId, setActiveRecId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "indicators" | "decisions">("results");
  const [decisionState, setDecisionState] = useState<{ runId: number | null; list: DecisionRecord[] }>({ runId: null, list: [] });

  const [fundingType, setFundingType] = useState("");
  const [campus, setCampus] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const [showDefineInd, setShowDefineInd] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [detailScore, setDetailScore] = useState<ProjectScore | null>(null);
  const [decideScore, setDecideScore] = useState<ProjectScore | null>(null);

  const [sensCriterion, setSensCriterion] = useState("");
  const [sensDelta, setSensDelta] = useState("0.1");
  const [sensResult, setSensResult] = useState<SensitivityAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([decisionSupportApi.getCriteria(), decisionSupportApi.getAHPRuns(), decisionSupportApi.getRecommendationRuns(), researchApi.getProjects()])
      .then(([c, a, r, p]) => {
        if (!alive) return;
        setCriteria(c);
        setAhpRuns(a);
        setRecRuns(r);
        setProjects(p);
        const firstUsable = a.find((x) => x.status === "finalized" && x.is_consistent) ?? a[0];
        if (firstUsable) {
          setActiveModelId(firstUsable.id);
          setActiveRecId(r.find((x) => x.ahp_run === firstUsable.id)?.id ?? null);
        }
      })
      .catch(() => alive && notify.error("Could not load decision support data. Check your connection and refresh."))
      .finally(() => alive && setIsLoading(false));
    if (roleCode === "system_admin") {
      authApi.getUsers().then((u) => alive && setUsers(u)).catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [roleCode]);

  useEffect(() => {
    if (activeRecId === null) return;
    let alive = true;
    decisionSupportApi
      .getDecisions(activeRecId)
      .then((d) => alive && setDecisionState({ runId: activeRecId, list: d }))
      .catch((err) => alive && notify.error(errorMessage(err, "Could not load decision records.")));
    return () => {
      alive = false;
    };
  }, [activeRecId]);

  const criteriaById = useMemo(() => new Map(criteria.map((c) => [c.id, c])), [criteria]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const campuses = useMemo(() => [...new Set(projects.map((p) => p.campus).filter(Boolean))].sort(), [projects]);

  const activeModel = ahpRuns.find((r) => r.id === activeModelId) ?? null;
  const modelUsable = !!activeModel && activeModel.status === "finalized" && !!activeModel.is_consistent;
  const weights = useMemo(() => activeModel?.weights ?? {}, [activeModel]);
  const runCriteria = useMemo(() => {
    if (!activeModel) return [];
    const list = activeModel.criteria.map((id) => criteriaById.get(id)).filter((c): c is DecisionCriterion => !!c);
    return activeModel.status === "finalized" ? list.sort((a, b) => (weights[String(b.id)] ?? 0) - (weights[String(a.id)] ?? 0)) : list;
  }, [activeModel, criteriaById, weights]);

  const modelRecRuns = recRuns.filter((r) => r.ahp_run === activeModelId);
  const activeRec = recRuns.find((r) => r.id === activeRecId) ?? null;
  const scores = activeRec ? [...activeRec.scores].sort((a, b) => a.rank - b.rank) : [];
  const decisions = useMemo(() => (decisionState.runId === activeRecId ? decisionState.list : []), [decisionState, activeRecId]);
  const decisionByProject = useMemo(() => new Map(decisions.map((d) => [d.project, d])), [decisions]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const selectModel = (id: number) => {
    setActiveModelId(id);
    setActiveRecId(recRuns.find((r) => r.ahp_run === id)?.id ?? null);
    setSensResult(null);
    setSensCriterion("");
  };

  const selectRec = (id: number | null) => {
    setActiveRecId(id);
    setSensResult(null);
  };

  const handleRun = async () => {
    if (!activeModel) return;
    setIsRunning(true);
    try {
      const run = await decisionSupportApi.triggerRecommendationRun({
        ahp_run: activeModel.id,
        funding_type: fundingType || undefined,
        campus: campus || undefined,
      });
      setRecRuns((prev) => [run, ...prev]);
      selectRec(run.id);
      setActiveTab("results");
      notify.success("Projects scored and ranked.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not run the DSS."));
    } finally {
      setIsRunning(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeRec || !sensCriterion) return;
    setIsAnalyzing(true);
    try {
      setSensResult(await decisionSupportApi.getSensitivity(activeRec.id, Number(sensCriterion), Number(sensDelta)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not run sensitivity analysis."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deciderName = (id: number) => {
    if (id === user?.pk) return "You";
    return usersById.get(id)?.email ?? `User #${id}`;
  };

  const totals = scores.map((s) => to100(s.composite_score));
  const topScore = totals.length ? Math.max(...totals) : null;
  const avgScore = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
  const attentionCount = totals.filter((t) => t < 50).length;

  const selCls = "px-3 py-2 rounded-xl border text-xs outline-none";
  const selSt = { borderColor: "#e2e8f0", background: "white", color: "#334155" };

  if (isLoading) {
    return (
      <div className="rounded-2xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
        <SkeletonRows rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {scores.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Projects Scored", val: String(scores.length), color: "#0d2a5e", bg: "#e0eaf7" },
            { label: "Highest Score", val: `${topScore}/100`, color: "#059669", bg: "#d1fae5" },
            { label: "Portfolio Avg", val: `${avgScore}/100`, color: "#0891b2", bg: "#e0f2fe" },
            { label: "Need Attention", val: String(attentionCount), color: attentionCount > 0 ? "#dc2626" : "#64748b", bg: attentionCount > 0 ? "#fee2e2" : "#f1f5f9" },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl p-4" style={{ background: k.bg }}>
              <p className="text-2xl font-black" style={{ color: k.color }}>{k.val}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: k.color }}>{k.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "white", border: "1px solid #e2e8f0", minHeight: "490px" }}>
            <div className="px-5 py-4 border-b shrink-0 flex items-start justify-between gap-2" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
              <div>
                <p className="font-bold text-sm" style={{ color: "#0d2a5e" }}>DSS Models</p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>AHP-weighted indicator sets</p>
              </div>
              {canManage && (
                <button onClick={() => setShowNewModel(true)} className="text-xs px-2.5 py-1 rounded-lg font-bold shrink-0" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                  + New
                </button>
              )}
            </div>
            <div className="p-3 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: "360px" }}>
              {ahpRuns.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: "#94a3b8" }}>
                  No models yet.{canManage ? " Create one with “+ New”." : ""}
                </p>
              )}
              {ahpRuns.map((m) => {
                const on = m.id === activeModelId;
                return (
                  <button
                    key={m.id}
                    onClick={() => selectModel(m.id)}
                    className="w-full text-left rounded-xl px-3 py-3 transition-all"
                    style={{ background: on ? "#e0eaf7" : "#f8fafc", border: `1.5px solid ${on ? "#0d2a5e40" : "#e2e8f0"}` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-black" style={{ color: "#0d2a5e" }}>{m.label}</p>
                      {on && (
                        <svg width="12" height="12" fill="none" stroke="#0d2a5e" strokeWidth="2.5" viewBox="0 0 24 24" className="shrink-0">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
                      {m.criteria.length} indicators ·{" "}
                      {m.status === "draft" ? (
                        <span style={{ color: "#b45309" }}>draft</span>
                      ) : m.is_consistent ? (
                        <span>CR {m.consistency_ratio?.toFixed(3)}</span>
                      ) : (
                        <span style={{ color: "#dc2626" }}>CR {m.consistency_ratio?.toFixed(3)} · inconsistent</span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
            {canManage && activeModel && (
              <div className="px-4 pb-4 pt-2 space-y-2 border-t" style={{ borderColor: "#f1f5f9" }}>
                {modelUsable && (
                  <>
                    <select value={fundingType} onChange={(e) => setFundingType(e.target.value)} className={selCls + " w-full"} style={selSt}>
                      <option value="">All funding types</option>
                      {Object.entries(FUNDING_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <select value={campus} onChange={(e) => setCampus(e.target.value)} className={selCls + " w-full"} style={selSt}>
                      <option value="">All campuses</option>
                      {campuses.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleRun}
                      disabled={isRunning}
                      className="w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #0d2a5e, #0891b2)" }}
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M5 3l14 9-14 9V3z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {isRunning ? "Scoring…" : "Run DSS — DSS-03"}
                    </button>
                  </>
                )}
                {activeModel.status === "draft" && (
                  <button onClick={() => setShowWeights(true)} className="w-full py-2 rounded-xl text-xs font-bold" style={{ background: "#fef3c7", color: "#b45309" }}>
                    ⚖️ Set Weights — DSS-02
                  </button>
                )}
                {activeModel.status === "finalized" && !activeModel.is_consistent && (
                  <p className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "#fee2e2", color: "#dc2626" }}>
                    CR above 0.10. Create a new model with more consistent comparisons to run the DSS.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "white", border: "1px solid #e2e8f0", minHeight: "490px" }}>
            <div className="flex border-b shrink-0 flex-wrap" style={{ borderColor: "#e2e8f0" }}>
              {(
                [
                  ["results", "Rankings & Scores", "DSS-03/04"],
                  ["indicators", "Indicators & Weights", "DSS-01/02"],
                  ["decisions", "Decision Records", "DSS-05"],
                ] as const
              ).map(([k, l, r]) => (
                <button key={k} onClick={() => setActiveTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: activeTab === k ? "#0891b2" : "transparent", color: activeTab === k ? "#0891b2" : "#64748b" }}>
                  {l} <span className="font-mono opacity-40" style={{ fontSize: "9px" }}>{r}</span>
                </button>
              ))}
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              {activeTab !== "indicators" && modelRecRuns.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs font-semibold" style={{ color: "#64748b" }}>Scoring run</span>
                  <select value={activeRecId ?? ""} onChange={(e) => selectRec(e.target.value ? Number(e.target.value) : null)} className={selCls} style={selSt}>
                    {modelRecRuns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} · {fmtDate(r.created_at)}
                      </option>
                    ))}
                  </select>
                  {activeRec && (
                    <span className="text-xs" style={{ color: "#94a3b8" }}>
                      Filters: {[FUNDING_TYPE_LABELS[activeRec.funding_type_filter], activeRec.campus_filter].filter(Boolean).join(" · ") || "none"}
                    </span>
                  )}
                </div>
              )}

              {activeTab === "results" && (
                <div className="space-y-4">
                  {!activeRec ? (
                    <div className="text-center py-12 rounded-2xl" style={{ background: "#f8fafc" }}>
                      <p className="text-3xl mb-2">🧮</p>
                      <p className="text-sm font-bold" style={{ color: "#64748b" }}>
                        {!activeModel
                          ? "No DSS model yet."
                          : canManage
                            ? modelUsable
                              ? "Click Run DSS to calculate project scores and rankings for this model."
                              : "Finalize this model's weights before running the DSS."
                            : "No scoring run for this model yet. DRD, VPREI, or System Admin can run one."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Project Rankings — DSS-04 · Model: {activeModel?.label}</p>
                      <div className="space-y-3">
                        {scores.map((s) => {
                          const total = to100(s.composite_score);
                          const grade = scoreToGrade(total);
                          const proj = projectsById.get(s.project);
                          const dec = decisionByProject.get(s.project);
                          return (
                            <div key={s.id} className="rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} onClick={() => setDetailScore(s)}>
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-lg" style={{ background: s.rank === 1 ? "#fef3c7" : s.rank === 2 ? "#f1f5f9" : "#f8fafc", color: s.rank === 1 ? "#b45309" : "#64748b" }}>
                                  #{s.rank}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="text-sm font-bold truncate" style={{ color: "#0d2a5e" }}>{proj?.title ?? `Project #${s.project}`}</p>
                                    <GradeBadge grade={grade} />
                                    {dec && <DecisionPill decision={dec.decision} />}
                                  </div>
                                  <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>
                                    {proj?.project_code}
                                    {proj ? ` · ${PROJECT_STATUS_LABELS[proj.status] ?? proj.status}` : ""}
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                                    {runCriteria.map((c) => (
                                      <div key={c.id}>
                                        <p className="text-xs mb-0.5 truncate" style={{ color: "#94a3b8", fontSize: "9px" }}>{c.name}</p>
                                        <ScoreBar value={to100(s.normalized_scores[String(c.id)] ?? 0)} color={DOMAIN_META[METRIC_META[c.metric_key].domain].color} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-3xl font-black" style={{ color: GRADE_META[grade].color }}>{total}</p>
                                  <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>/ 100</p>
                                  {canDecide && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDecideScore(s);
                                      }}
                                      className="mt-2 text-xs px-2.5 py-1 rounded-lg font-bold"
                                      style={{ background: "#e0eaf7", color: "#0d2a5e" }}
                                    >
                                      {dec ? "Update" : "Decide"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Score Comparison Table — DSS-04</p>
                        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ background: "#f8fafc" }}>
                                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wide sticky left-0" style={{ color: "#64748b", background: "#f8fafc" }}>Project</th>
                                {runCriteria.map((c) => (
                                  <th key={c.id} className="px-2 py-2.5 text-center font-bold" style={{ color: DOMAIN_META[METRIC_META[c.metric_key].domain].color, fontSize: "9px", minWidth: "60px" }}>
                                    {c.name}
                                    <br />
                                    <span className="font-normal text-slate-400">{((weights[String(c.id)] ?? 0) * 100).toFixed(1)}%</span>
                                  </th>
                                ))}
                                <th className="px-3 py-2.5 text-center font-bold uppercase tracking-wide" style={{ color: "#0d2a5e" }}>Total</th>
                                <th className="px-3 py-2.5 text-center font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Grade</th>
                                <th className="px-3 py-2.5 text-center font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>Decision</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scores.map((s) => {
                                const total = to100(s.composite_score);
                                const dec = decisionByProject.get(s.project);
                                return (
                                  <tr key={s.id} className="border-t hover:bg-slate-50 cursor-pointer" style={{ borderColor: "#f1f5f9" }} onClick={() => setDetailScore(s)}>
                                    <td className="px-3 py-2 font-semibold sticky left-0 whitespace-nowrap" style={{ color: "#0d2a5e", background: "white" }}>{projectsById.get(s.project)?.project_code ?? `#${s.project}`}</td>
                                    {runCriteria.map((c) => {
                                      const v = to100(s.normalized_scores[String(c.id)] ?? 0);
                                      return (
                                        <td key={c.id} className="px-2 py-2 text-center font-mono font-bold" style={{ color: v >= 70 ? "#059669" : v >= 40 ? "#f59e0b" : "#dc2626" }}>{v}</td>
                                      );
                                    })}
                                    <td className="px-3 py-2 text-center">
                                      <span className="font-black text-sm" style={{ color: GRADE_META[scoreToGrade(total)].color }}>{total}</span>
                                    </td>
                                    <td className="px-3 py-2 text-center"><GradeBadge grade={scoreToGrade(total)} /></td>
                                    <td className="px-3 py-2 text-center">{dec ? <DecisionPill decision={dec.decision} /> : <span style={{ color: "#94a3b8" }}>—</span>}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#94a3b8" }}>Sensitivity Analysis</p>
                        <p className="text-xs mb-3" style={{ color: "#64748b" }}>See how the ranking would shift if one indicator's weight changed. Nothing is saved.</p>
                        <div className="flex flex-wrap items-end gap-3">
                          <Field label="Indicator" className="w-64">
                            <select value={sensCriterion} onChange={(e) => setSensCriterion(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE}>
                              <option value="">Select an indicator</option>
                              {runCriteria.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Weight Delta" className="w-36">
                            <input type="number" step="0.05" min="-1" max="1" value={sensDelta} onChange={(e) => setSensDelta(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} />
                          </Field>
                          <button onClick={handleAnalyze} disabled={isAnalyzing || !sensCriterion} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: "#0d2a5e" }}>
                            {isAnalyzing ? "Analyzing…" : "Analyze"}
                          </button>
                        </div>
                        {sensResult && (
                          <div className="mt-4 overflow-x-auto rounded-xl" style={{ border: "1px solid #e2e8f0", background: "white" }}>
                            <p className="px-3 py-2 text-xs" style={{ color: "#64748b" }}>
                              Weight {(sensResult.old_weight * 100).toFixed(1)}% → {(sensResult.new_weight * 100).toFixed(1)}%, other indicators rescaled
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ background: "#f8fafc" }}>
                                  {["Project", "Original Rank", "Adjusted Rank", "Adjusted Score", "Change"].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sensResult.results.map((r) => (
                                  <tr key={r.project} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                                    <td className="px-3 py-2 font-semibold" style={{ color: "#0d2a5e" }}>{projectsById.get(r.project)?.project_code ?? `#${r.project}`}</td>
                                    <td className="px-3 py-2">#{r.original_rank}</td>
                                    <td className="px-3 py-2">#{r.adjusted_rank}</td>
                                    <td className="px-3 py-2 font-mono">{to100(r.adjusted_composite)}</td>
                                    <td className="px-3 py-2">
                                      {r.rank_change === 0 ? (
                                        <span style={{ color: "#94a3b8" }}>No change</span>
                                      ) : r.rank_change > 0 ? (
                                        <Pill bg="#d1fae5" color="#059669">▲ Up {r.rank_change}</Pill>
                                      ) : (
                                        <Pill bg="#fee2e2" color="#dc2626">▼ Down {Math.abs(r.rank_change)}</Pill>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "indicators" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
                      {activeModel ? `${runCriteria.length} indicators · ${activeModel.label}` : `${criteria.length} indicators defined`}
                    </p>
                    {canManage && (
                      <button onClick={() => setShowDefineInd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>
                        + Define Indicator — DSS-01
                      </button>
                    )}
                  </div>

                  {activeModel?.status === "draft" && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "#fef3c7", color: "#b45309" }}>
                      ⚠️ This model's weights aren't finalized yet — {canManage ? "use “Set Weights” in the model panel." : "DRD, VPREI, or System Admin must finalize them."}
                    </div>
                  )}

                  {activeModel?.status === "finalized" && (
                    <div className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Weight Distribution — DSS-02</p>
                        <Pill bg={activeModel.is_consistent ? "#d1fae5" : "#fee2e2"} color={activeModel.is_consistent ? "#059669" : "#dc2626"}>
                          CR {activeModel.consistency_ratio?.toFixed(4)} · {activeModel.is_consistent ? "consistent" : "inconsistent"}
                        </Pill>
                      </div>
                      <div className="flex h-6 rounded-full overflow-hidden gap-px">
                        {runCriteria.map((c) => (
                          <div key={c.id} className="h-full transition-all" title={`${c.name}: ${((weights[String(c.id)] ?? 0) * 100).toFixed(1)}%`} style={{ width: `${(weights[String(c.id)] ?? 0) * 100}%`, background: DOMAIN_META[METRIC_META[c.metric_key].domain].color }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {runCriteria.map((c) => (
                          <div key={c.id} className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: DOMAIN_META[METRIC_META[c.metric_key].domain].color }} />
                            <span className="text-xs" style={{ color: "#64748b" }}>{c.name} {((weights[String(c.id)] ?? 0) * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(activeModel ? runCriteria : criteria).length === 0 ? (
                    <NoActualData message="No indicators defined yet." hint={canManage ? "Use “+ Define Indicator” to add the first one." : undefined} />
                  ) : (
                    <div className="space-y-3">
                      {(activeModel ? runCriteria : criteria).map((c) => {
                        const meta = METRIC_META[c.metric_key];
                        const w = weights[String(c.id)];
                        return (
                          <div key={c.id} className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <DomainChip domain={meta.domain} />
                                <p className="text-sm font-bold" style={{ color: "#0d2a5e" }}>{c.name}</p>
                                {!c.is_active && <Pill>Inactive</Pill>}
                              </div>
                              {activeModel?.status === "finalized" && w !== undefined && (
                                <div className="shrink-0 text-right">
                                  <p className="text-xl font-black" style={{ color: DOMAIN_META[meta.domain].color }}>{(w * 100).toFixed(1)}%</p>
                                  <p className="text-xs" style={{ color: "#94a3b8" }}>weight</p>
                                </div>
                              )}
                            </div>
                            {c.description && <p className="text-xs mb-2" style={{ color: "#64748b" }}>{c.description}</p>}
                            <div className="rounded-lg px-3 py-2 text-xs font-mono" style={{ background: "#f1f5f9", color: "#64748b" }}>
                              {meta.label}: {meta.formula}
                            </div>
                            <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>↑ Higher value = better score (min-max normalized across the scored projects)</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeModel && criteria.length > runCriteria.length && (
                    <p className="text-xs" style={{ color: "#94a3b8" }}>
                      Not in this model: {criteria.filter((c) => !activeModel.criteria.includes(c.id)).map((c) => c.name).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {activeTab === "decisions" && (
                <div className="space-y-3">
                  {!activeRec ? (
                    <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc" }}>
                      <p className="text-sm" style={{ color: "#94a3b8" }}>No scoring run for this model yet. Decisions are recorded against a run's rankings.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
                        {decisions.length} recorded decision{decisions.length !== 1 ? "s" : ""} — DSS-05
                      </p>
                      {decisions.length === 0 && (
                        <NoActualData message="No decisions recorded on this run yet." hint={canDecide ? "Record one from the Rankings & Scores tab." : "The University President, DRD, or VPREI records decisions."} />
                      )}
                      {decisions.map((d) => {
                        const sc = activeRec.scores.find((s) => s.project === d.project);
                        const total = sc ? to100(sc.composite_score) : null;
                        const proj = projectsById.get(d.project);
                        return (
                          <div key={d.id} className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>{proj?.project_code ?? `Project #${d.project}`}</span>
                                  <DecisionPill decision={d.decision} />
                                </div>
                                {proj && <p className="text-xs font-semibold" style={{ color: "#334155" }}>{proj.title}</p>}
                                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                                  Decided by {deciderName(d.decided_by)} · {fmtDate(d.decided_at)}
                                </p>
                              </div>
                              {total !== null && (
                                <div className="text-right shrink-0">
                                  <p className="text-2xl font-black" style={{ color: GRADE_META[scoreToGrade(total)].color }}>{total}</p>
                                  <p className="text-xs" style={{ color: "#94a3b8" }}>DSS Score</p>
                                </div>
                              )}
                            </div>
                            <p className="text-sm" style={{ color: "#334155" }}>{d.rationale || "—"}</p>
                            {(d.indicative_amount || d.reference_number) && (
                              <div className="mt-2 pt-2 border-t flex flex-wrap gap-x-6 gap-y-1" style={{ borderColor: "#e2e8f0" }}>
                                {d.indicative_amount && (
                                  <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                                    Indicative amount: <span style={{ color: "#334155" }}>{peso(d.indicative_amount)}</span>
                                  </p>
                                )}
                                {d.reference_number && (
                                  <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>
                                    Reference: <span style={{ color: "#334155" }}>{d.reference_number}</span>
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDefineInd && <DefineIndicatorModal onCreated={(c) => setCriteria((prev) => [...prev, c])} onClose={() => setShowDefineInd(false)} />}

      {showNewModel && (
        <NewModelModal
          criteria={criteria}
          onCreated={(r) => {
            setAhpRuns((prev) => [r, ...prev]);
            selectModel(r.id);
          }}
          onClose={() => setShowNewModel(false)}
        />
      )}

      {showWeights && activeModel && (
        <PairwiseModal
          run={activeModel}
          runCriteria={runCriteria}
          onFinalized={(r) => setAhpRuns((prev) => prev.map((x) => (x.id === r.id ? r : x)))}
          onClose={() => setShowWeights(false)}
        />
      )}

      {detailScore && activeRec && (
        <ScoreDetailModal
          score={detailScore}
          project={projectsById.get(detailScore.project)}
          runCriteria={runCriteria}
          weights={weights}
          modelLabel={activeModel?.label ?? ""}
          decision={decisionByProject.get(detailScore.project)}
          canDecide={canDecide}
          onDecide={() => {
            setDecideScore(detailScore);
            setDetailScore(null);
          }}
          onClose={() => setDetailScore(null)}
        />
      )}

      {decideScore && activeRec && (
        <RecordDecisionModal
          runId={activeRec.id}
          score={decideScore}
          project={projectsById.get(decideScore.project)}
          existing={decisionByProject.get(decideScore.project)}
          onSaved={(d) => setDecisionState((prev) => ({ runId: activeRec.id, list: [...prev.list.filter((x) => x.project !== d.project), d] }))}
          onClose={() => setDecideScore(null)}
        />
      )}
    </div>
  );
}

export default function DecisionSupportPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Decision Support">
        <DecisionSupportContent />
      </AppShell>
    </ProtectedRoute>
  );
}
