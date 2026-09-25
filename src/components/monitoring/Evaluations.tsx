import { useEffect, useState } from "react";
import { monitoringApi } from "../../lib/monitoringApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../../lib/protoStyles";
import type { EvaluationCriterion, EvaluationOutcome, EvaluationScore, ProjectEvaluation } from "../../types/monitoring";
import { NoActualData } from "../common/NoActualData";
import { Field, ProtoModal, SkeletonRows, TableHead } from "../common/proto";

const OUTCOME_META: Record<EvaluationOutcome, { label: string; bg: string; text: string; icon: string }> = {
  pending: { label: "Scheduled", bg: "#e0f2fe", text: "#0369a1", icon: "📋" },
  passed: { label: "Passed", bg: "#d1fae5", text: "#166534", icon: "✅" },
  conditional: { label: "Conditional", bg: "#fef3c7", text: "#92400e", icon: "⚠️" },
  failed: { label: "Failed", bg: "#fee2e2", text: "#991b1b", icon: "⛔" },
};

const scoreColor = (s: number) => (s >= 80 ? "#059669" : s >= 60 ? "#f59e0b" : "#ef4444");

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: "6px", background: "#f1f5f9" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: scoreColor(score) }} />
      </div>
      <span className="text-xs font-black w-12 text-right" style={{ color: scoreColor(score) }}>{score}/100</span>
    </div>
  );
}

function EvalDetailModal({
  ev,
  criteria,
  canEvaluate,
  onClose,
  onChanged,
}: {
  ev: ProjectEvaluation;
  criteria: EvaluationCriterion[];
  canEvaluate: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"criteria" | "findings">("criteria");
  const [scores, setScores] = useState<EvaluationScore[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { score: string; remarks: string }>>({});
  const [outcome, setOutcome] = useState<EvaluationOutcome>(ev.outcome);
  const [remarks, setRemarks] = useState(ev.remarks);
  const [busy, setBusy] = useState(false);
  const [scoresKey, setScoresKey] = useState(0);
  const om = OUTCOME_META[ev.outcome];
  const active = criteria.filter((c) => c.is_active);
  const weightTotal = active.reduce((s, c) => s + c.weight, 0);

  useEffect(() => {
    let alive = true;
    monitoringApi
      .getScores(ev.id)
      .then((s) => alive && setScores(s))
      .catch(() => alive && setScores([]));
    return () => {
      alive = false;
    };
  }, [ev.id, scoresKey]);

  const saveScore = async (criterion: number) => {
    const d = drafts[criterion];
    if (!d || d.score === "" || Number(d.score) < 0 || Number(d.score) > 100) {
      notify.error("Score must be between 0 and 100.");
      return;
    }
    setBusy(true);
    try {
      await monitoringApi.saveScore(ev.id, { criterion, score: d.score, remarks: d.remarks });
      notify.success("Score saved.");
      setDrafts((x) => {
        const next = { ...x };
        delete next[criterion];
        return next;
      });
      setScoresKey((k) => k + 1);
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not save this score."));
    } finally {
      setBusy(false);
    }
  };

  const saveFindings = async () => {
    setBusy(true);
    try {
      await monitoringApi.updateEvaluation(ev.id, { outcome, remarks });
      notify.success("Evaluation updated.");
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the evaluation."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProtoModal
      width="max-w-2xl"
      onClose={onClose}
      title={
        <>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0891b2" }}>📋 Year {ev.project_year} Evaluation</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: om.bg, color: om.text }}>{om.label}</span>
          </div>
          <p className="text-white font-black text-lg">Annual Project Evaluation</p>
          <p className="text-xs mt-0.5 font-normal" style={{ color: "rgba(168,196,232,0.5)" }}>
            {ev.evaluated_at ? `Evaluated ${ev.evaluated_at.slice(0, 10)}` : `Scheduled ${ev.scheduled_date}`}
          </p>
          {ev.weighted_score !== null && (
            <div className="mt-3 flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div>
                <p className="text-xs font-normal" style={{ color: "rgba(168,196,232,0.5)" }}>Weighted Score</p>
                <p className="text-3xl font-black" style={{ color: ev.weighted_score >= 80 ? "#4ade80" : ev.weighted_score >= 60 ? "#fbbf24" : "#f87171" }}>{ev.weighted_score.toFixed(1)}</p>
              </div>
              <div className="flex-1">
                <div className="w-full rounded-full overflow-hidden" style={{ height: "8px", background: "rgba(255,255,255,0.1)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, ev.weighted_score)}%`, background: ev.weighted_score >= 80 ? "#4ade80" : ev.weighted_score >= 60 ? "#fbbf24" : "#f87171" }} />
                </div>
                <p className="text-xs mt-1 font-bold" style={{ color: "rgba(168,196,232,0.6)" }}>out of 100</p>
              </div>
            </div>
          )}
        </>
      }
    >
      <div className="flex border-b -mx-6 -mt-6 mb-2 px-2" style={{ borderColor: "#e2e8f0" }}>
        {(
          [
            ["criteria", "Evaluation Criteria & Scores"],
            ["findings", "Findings & Outcome"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-5 py-3 text-xs font-semibold border-b-2 transition-all" style={{ borderBottomColor: tab === k ? "#0891b2" : "transparent", color: tab === k ? "#0891b2" : "#64748b" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "criteria" && (
        <div className="space-y-4">
          {ev.panel_members && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Evaluation Panel</p>
              <div className="flex flex-wrap gap-2">
                {ev.panel_members.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean).map((p) => (
                  <span key={p} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#e0eaf7", color: "#0d2a5e" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {active.length === 0 ? (
            <NoActualData message="No active evaluation criteria" hint="The evaluation panel defines the rubric in the Evaluation Rubric tab." />
          ) : scores === null ? (
            <SkeletonRows />
          ) : (
            <>
              {weightTotal !== 100 && (
                <div className="rounded-xl px-4 py-2.5 text-xs font-bold" style={{ background: "#fee2e2", color: "#991b1b" }}>
                  Active criteria weights total {weightTotal}%, not 100%. Scores can't be saved until the rubric is fixed.
                </div>
              )}
              <div className="space-y-3">
                {active.map((c) => {
                  const s = scores.find((x) => x.criterion === c.id);
                  const d = drafts[c.id];
                  return (
                    <div key={c.id} className="rounded-2xl p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="flex items-center justify-between mb-0.5 gap-2">
                        <p className="text-xs font-black" style={{ color: "#0d2a5e" }}>{c.name}</p>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: "#e2e8f0", color: "#64748b" }}>Weight: {c.weight}%</span>
                      </div>
                      {c.description && <p className="text-xs mb-2" style={{ color: "#64748b" }}>{c.description}</p>}
                      {s ? <ScoreBar score={Number(s.score)} /> : <p className="text-xs" style={{ color: "#94a3b8" }}>— not yet scored</p>}
                      {s?.remarks && <p className="text-xs leading-relaxed mt-2 pt-2 border-t" style={{ color: "#334155", borderColor: "#e2e8f0" }}>{s.remarks}</p>}
                      {canEvaluate && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-20 px-2 py-1.5 rounded-lg border text-xs outline-none"
                            style={INPUT_STYLE}
                            placeholder="0–100"
                            value={d?.score ?? ""}
                            onChange={(e) => setDrafts((x) => ({ ...x, [c.id]: { score: e.target.value, remarks: x[c.id]?.remarks ?? s?.remarks ?? "" } }))}
                          />
                          <input
                            className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg border text-xs outline-none"
                            style={INPUT_STYLE}
                            placeholder="Findings for this criterion"
                            value={d?.remarks ?? s?.remarks ?? ""}
                            onChange={(e) => setDrafts((x) => ({ ...x, [c.id]: { score: x[c.id]?.score ?? (s ? String(Number(s.score)) : ""), remarks: e.target.value } }))}
                          />
                          <button disabled={busy || !d} onClick={() => saveScore(c.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                            {s ? "Update" : "Score"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {ev.weighted_score === null && <p className="text-xs" style={{ color: "#94a3b8" }}>The weighted score appears once every active criterion is scored.</p>}
            </>
          )}
        </div>
      )}

      {tab === "findings" && (
        <div className="space-y-4">
          {canEvaluate ? (
            <>
              <Field label="Outcome">
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(Object.keys(OUTCOME_META) as EvaluationOutcome[]).map((o) => (
                    <button key={o} onClick={() => setOutcome(o)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold" style={{ background: outcome === o ? OUTCOME_META[o].bg : "#f8fafc", color: OUTCOME_META[o].text, border: `1.5px solid ${outcome === o ? OUTCOME_META[o].text + "40" : "#e2e8f0"}` }}>
                      {OUTCOME_META[o].icon} {o === "pending" ? "Pending" : OUTCOME_META[o].label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Overall Findings & Recommendations">
                <textarea rows={4} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Field>
              <button disabled={busy || (outcome === ev.outcome && remarks === ev.remarks)} onClick={saveFindings} className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                Save Findings
              </button>
            </>
          ) : ev.remarks ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Overall Findings</p>
              <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{ev.remarks}</p>
            </div>
          ) : (
            <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc" }}>
              <p className="text-sm" style={{ color: "#94a3b8" }}>Evaluation findings not yet recorded</p>
            </div>
          )}
        </div>
      )}
    </ProtoModal>
  );
}

export function EvaluationsPanel({ project, canEvaluate, reloadKey, onChanged }: { project: number; canEvaluate: boolean; reloadKey: number; onChanged: () => void }) {
  const [evals, setEvals] = useState<ProjectEvaluation[] | null>(null);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ project_year: "1", scheduled_date: "", panel_members: "" });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([monitoringApi.getEvaluations({ project }), monitoringApi.getCriteria()])
      .then(([e, c]) => {
        if (!alive) return;
        setEvals(e);
        setCriteria(c);
      })
      .catch(() => alive && setEvals([]));
    return () => {
      alive = false;
    };
  }, [project, reloadKey]);

  const schedule = async () => {
    setAttempted(true);
    if (!form.project_year || !form.scheduled_date) {
      notify.error("Project year and scheduled date are required.");
      return;
    }
    setSaving(true);
    try {
      await monitoringApi.createEvaluation({ project, project_year: Number(form.project_year), scheduled_date: form.scheduled_date, panel_members: form.panel_members || undefined });
      notify.success("Evaluation scheduled.");
      setShowNew(false);
      setAttempted(false);
      setForm({ project_year: "1", scheduled_date: "", panel_members: "" });
      onChanged();
    } catch (err) {
      notify.error(errorMessage(err, "Could not schedule the evaluation."));
    } finally {
      setSaving(false);
    }
  };

  const selected = evals?.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      {canEvaluate && (
        <div className="flex justify-end">
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            Schedule Evaluation
          </button>
        </div>
      )}
      {evals === null ? (
        <SkeletonRows />
      ) : evals.length === 0 ? (
        <div className="text-center py-10 rounded-2xl" style={{ background: "#f8fafc" }}>
          <p className="text-sm" style={{ color: "#94a3b8" }}>No evaluations scheduled for this project.</p>
        </div>
      ) : (
        evals.map((ev) => {
          const om = OUTCOME_META[ev.outcome];
          const panel = ev.panel_members.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
          return (
            <div
              key={ev.id}
              className="rounded-2xl p-4 cursor-pointer transition-all"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
              onClick={() => setSelectedId(ev.id)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#0891b2")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: om.bg }}>{om.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#e0f2fe", color: "#0891b2" }}>Year {ev.project_year} Evaluation</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: om.bg, color: om.text }}>{om.label}</span>
                  </div>
                  <p className="text-xs" style={{ color: "#0d2a5e" }}>{ev.evaluated_at ? `Evaluated ${ev.evaluated_at.slice(0, 10)}` : `Scheduled ${ev.scheduled_date}`}</p>
                  {panel.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                      Panel: {panel.slice(0, 2).join("; ")}
                      {panel.length > 2 ? ` +${panel.length - 2}` : ""}
                    </p>
                  )}
                </div>
                {ev.weighted_score !== null && (
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black" style={{ color: scoreColor(ev.weighted_score) }}>{ev.weighted_score.toFixed(1)}</p>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>/ 100</p>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {selected && (
        <EvalDetailModal
          key={`${selected.id}-${selected.outcome}-${selected.weighted_score}`}
          ev={selected}
          criteria={criteria}
          canEvaluate={canEvaluate}
          onClose={() => setSelectedId(null)}
          onChanged={onChanged}
        />
      )}
      {showNew && (
        <ProtoModal
          title="Schedule Evaluation"
          width="max-w-md"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
              <button onClick={schedule} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
                {saving ? "Scheduling…" : "Schedule"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project Year" required>
              <input type="number" min="1" className={INPUT_CLS} style={invalidStyle(attempted && !form.project_year)} value={form.project_year} onChange={(e) => setForm((f) => ({ ...f, project_year: e.target.value }))} />
            </Field>
            <Field label="Scheduled Date" required>
              <input type="date" className={INPUT_CLS} style={invalidStyle(attempted && !form.scheduled_date)} value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
            </Field>
          </div>
          <Field label="Panel Members">
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={form.panel_members} onChange={(e) => setForm((f) => ({ ...f, panel_members: e.target.value }))} placeholder="Comma-separated names" />
          </Field>
        </ProtoModal>
      )}
    </div>
  );
}

export function RubricPanel({ canEvaluate }: { canEvaluate: boolean }) {
  const [criteria, setCriteria] = useState<EvaluationCriterion[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ name: "", description: "", weight: "" });
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    monitoringApi
      .getCriteria()
      .then((c) => alive && setCriteria(c))
      .catch(() => alive && setCriteria([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      notify.success(ok);
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the rubric."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setAttempted(true);
    if (!form.name.trim() || !Number(form.weight)) {
      notify.error("Name and weight are required.");
      return;
    }
    if (await run(() => monitoringApi.createCriterion({ name: form.name.trim(), description: form.description || undefined, weight: Number(form.weight) }), "Criterion added.")) {
      setForm({ name: "", description: "", weight: "" });
      setAttempted(false);
    }
  };

  const total = (criteria ?? []).filter((c) => c.is_active).reduce((s, c) => s + c.weight, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: total === 100 ? "#d1fae5" : "#fef3c7" }}>
        <div>
          <p className="text-xs font-black" style={{ color: total === 100 ? "#166534" : "#92400e" }}>Active criteria weight total</p>
          <p className="text-xs mt-0.5" style={{ color: total === 100 ? "#166534" : "#92400e" }}>
            {total === 100 ? "Rubric is valid — panel members can score evaluations." : "Must total exactly 100% before any evaluation can be scored."}
          </p>
        </div>
        <p className="text-3xl font-black font-mono" style={{ color: total === 100 ? "#059669" : "#d97706" }}>{total}%</p>
      </div>

      {criteria === null ? (
        <SkeletonRows />
      ) : criteria.length === 0 ? (
        <NoActualData message="No evaluation criteria yet" hint={canEvaluate ? "Add the panel's rubric lines below." : undefined} />
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <table className="w-full text-sm">
            <TableHead cols={["Criterion", "Description", "Weight", "Active"]} />
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: "#f1f5f9", opacity: c.is_active ? 1 : 0.55 }}>
                  <td className="px-4 py-3 text-xs font-bold" style={{ color: "#0d2a5e" }}>{c.name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#64748b" }}>{c.description || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {canEvaluate ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" min="0" max="100" className="w-16 px-2 py-1 rounded-lg border text-xs outline-none" style={INPUT_STYLE} value={weights[c.id] ?? String(c.weight)} onChange={(e) => setWeights((w) => ({ ...w, [c.id]: e.target.value }))} />
                        <span style={{ color: "#94a3b8" }}>%</span>
                        {weights[c.id] !== undefined && weights[c.id] !== String(c.weight) && (
                          <button
                            disabled={busy}
                            onClick={async () => {
                              if (await run(() => monitoringApi.updateCriterion(c.id, { weight: Number(weights[c.id]) }), "Weight updated."))
                                setWeights((w) => {
                                  const next = { ...w };
                                  delete next[c.id];
                                  return next;
                                });
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-bold"
                            style={{ background: "#e0f2fe", color: "#0369a1" }}
                          >
                            Save
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono font-bold" style={{ color: "#0d2a5e" }}>{c.weight}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {canEvaluate ? (
                      <input type="checkbox" checked={c.is_active} disabled={busy} onChange={() => run(() => monitoringApi.updateCriterion(c.id, { is_active: !c.is_active }), c.is_active ? "Criterion deactivated." : "Criterion activated.")} />
                    ) : c.is_active ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEvaluate && (
        <div className="rounded-2xl p-4 flex flex-wrap items-end gap-3" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <Field label="Criterion" className="w-56">
            <input className={INPUT_CLS} style={invalidStyle(attempted && !form.name.trim())} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Technical accomplishment" />
          </Field>
          <Field label="Description" className="flex-1 min-w-[200px]">
            <input className={INPUT_CLS} style={INPUT_STYLE} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Weight (%)" className="w-28">
            <input type="number" min="1" max="100" className={INPUT_CLS} style={invalidStyle(attempted && !Number(form.weight))} value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
          </Field>
          <button onClick={add} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            + Add Criterion
          </button>
        </div>
      )}
    </div>
  );
}
