import { useEffect, useState } from "react";
import { complianceApi } from "../../lib/complianceApi";
import { researchApi } from "../../lib/researchApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../../lib/protoStyles";
import type {
  AIUseDeclaration,
  COIStatus,
  ConflictOfInterestDisclosure,
  EthicsReviewBody,
  EthicsReviewReference,
  EthicsReviewStatus,
  MisconductCaseReference,
  MisconductCaseStatus,
  MisconductCaseType,
  SimilarityCheckRecord,
  SimilarityDocumentType,
} from "../../types/compliance";
import type { Project, Study } from "../../types/research";
import { NoActualData } from "../common/NoActualData";
import { Field, Pill, ProtoModal, SkeletonRows, TableHead } from "../common/proto";

const REVIEW_BODY_LABELS: Record<EthicsReviewBody, string> = {
  trc: "Technical Review Committee",
  integrity_review: "Research Integrity Review",
  external_review: "External Review Body",
};

const REVIEW_STATUS_META: Record<EthicsReviewStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#f1f5f9", color: "#475569" },
  approved: { label: "Approved", bg: "#d1fae5", color: "#166534" },
  conditional: { label: "Conditionally Approved", bg: "#fef3c7", color: "#92400e" },
  revision_required: { label: "Revision Required", bg: "#fff7ed", color: "#c2410c" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};

const DOC_TYPE_LABELS: Record<SimilarityDocumentType, string> = {
  published_article: "Article for Publication",
  thesis_dissertation: "Thesis/Dissertation",
  other: "Other",
};

const COI_STATUS_META: Record<COIStatus, { label: string; bg: string; color: string }> = {
  disclosed: { label: "Disclosed", bg: "#e0f2fe", color: "#0369a1" },
  under_review: { label: "Under Review", bg: "#fef3c7", color: "#92400e" },
  resolved: { label: "Resolved", bg: "#d1fae5", color: "#166534" },
};

const CASE_TYPE_LABELS: Record<MisconductCaseType, string> = {
  plagiarism: "Plagiarism",
  fabrication: "Fabrication",
  falsification: "Falsification",
  other: "Other",
};

const MISCONDUCT_STATUS_META: Record<MisconductCaseStatus, { label: string; bg: string; color: string }> = {
  reported: { label: "Reported", bg: "#e0f2fe", color: "#0369a1" },
  under_investigation: { label: "Under Investigation", bg: "#fef3c7", color: "#92400e" },
  upheld: { label: "Upheld", bg: "#fee2e2", color: "#991b1b" },
  dismissed: { label: "Dismissed", bg: "#f1f5f9", color: "#64748b" },
};

const SECTIONS = [
  { key: "reviews", label: "Review References", icon: "🔍" },
  { key: "similarity", label: "Similarity Checks", icon: "📑" },
  { key: "ai", label: "AI Use Declarations", icon: "🤖" },
  { key: "coi", label: "COI Disclosures", icon: "⚖️" },
  { key: "misconduct", label: "Misconduct Cases", icon: "🚩" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];
type VerifyKind = "ethics-reviews" | "similarity-checks" | "ai-declarations" | "coi-disclosures";

const today = () => new Date().toLocaleDateString("en-CA");

const INLINE_SELECT = "px-2 py-1 rounded-lg border text-xs font-semibold outline-none";

function Verified({ at, canVerify, busy, onVerify }: { at: string | null; canVerify: boolean; busy: boolean; onVerify: () => void }) {
  if (at) return <Pill bg="#d1fae5" color="#166534">✓ Verified {at.slice(0, 10)}</Pill>;
  if (canVerify)
    return (
      <button className="px-2.5 py-1 rounded-lg text-xs font-bold disabled:opacity-60" style={{ background: "#e0f2fe", color: "#0369a1" }} disabled={busy} onClick={onVerify}>
        Verify
      </button>
    );
  return <Pill>Unverified</Pill>;
}

function AddRecordModal({
  section,
  project,
  studies,
  userPk,
  onClose,
  onSaved,
}: {
  section: SectionKey;
  project: number;
  studies: Study[];
  userPk: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({ checked_on: today(), declared_on: today(), disclosed_on: today(), reported_on: today() });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const v = (k: string) => f[k] ?? "";
  const bad = (k: string) => attempted && !v(k).trim();
  const study = v("study") ? Number(v("study")) : null;
  const pct = v("ai_content_pct");
  const pctBad = pct !== "" && (Number(pct) < 0 || Number(pct) > 100);

  const required: Record<SectionKey, string[]> = {
    reviews: ["review_body"],
    similarity: ["document_type", "similarity_index", "checked_on"],
    ai: ["tool_name", "purpose", "extent", "declared_on"],
    coi: ["description", "disclosed_on"],
    misconduct: ["subject_name", "case_type", "referred_to", "reported_on"],
  };

  const save = async () => {
    setAttempted(true);
    if (required[section].some((k) => !v(k).trim()) || pctBad) {
      notify.error("Fill in the required fields.");
      return;
    }
    setSaving(true);
    try {
      if (section === "reviews")
        await complianceApi.createEthicsReview({
          project,
          study,
          review_body: v("review_body"),
          reference_number: v("reference_number") || undefined,
          decision_date: v("decision_date") || null,
          remarks: v("remarks") || undefined,
        });
      if (section === "similarity")
        await complianceApi.createSimilarityCheck({
          project,
          study,
          document_type: v("document_type"),
          document_title: v("document_title") || undefined,
          similarity_index: v("similarity_index"),
          software_used: v("software_used") || undefined,
          checked_on: v("checked_on"),
        });
      if (section === "ai")
        await complianceApi.createAIDeclaration({
          project,
          study,
          tool_name: v("tool_name").trim(),
          purpose: v("purpose").trim(),
          extent: v("extent").trim(),
          ai_content_pct: pct === "" ? null : pct,
          declared_on: v("declared_on"),
        });
      if (section === "coi")
        await complianceApi.createCOIDisclosure({
          project,
          discloser: userPk,
          description: v("description").trim(),
          mitigation_measures: v("mitigation_measures") || undefined,
          disclosed_on: v("disclosed_on"),
        });
      if (section === "misconduct")
        await complianceApi.createMisconductCase({
          project,
          subject_name: v("subject_name").trim(),
          case_type: v("case_type"),
          referred_to: v("referred_to").trim(),
          remarks: v("remarks") || undefined,
          reported_on: v("reported_on"),
        });
      notify.success("Record saved.");
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not save this record."));
    } finally {
      setSaving(false);
    }
  };

  const meta = SECTIONS.find((s) => s.key === section)!;
  const studyField = (
    <Field label="Study (optional)">
      <select className={INPUT_CLS} style={INPUT_STYLE} value={v("study")} onChange={set("study")}>
        <option value="">Whole project</option>
        {studies.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
    </Field>
  );

  return (
    <ProtoModal
      title={`${meta.icon} New ${meta.label.replace(/s$/, "")}`}
      subtitle="Logged against the selected project"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Saving…" : "Save Record"}
          </button>
        </>
      }
    >
      {section === "reviews" && (
        <>
          {studyField}
          <Field label="Review Body" required>
            <select className={INPUT_CLS} style={invalidStyle(bad("review_body"))} value={v("review_body")} onChange={set("review_body")}>
              <option value="">Select body</option>
              {(Object.keys(REVIEW_BODY_LABELS) as EthicsReviewBody[]).map((b) => (
                <option key={b} value={b}>{REVIEW_BODY_LABELS[b]}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reference Number">
              <input className={INPUT_CLS} style={INPUT_STYLE} value={v("reference_number")} onChange={set("reference_number")} />
            </Field>
            <Field label="Decision Date">
              <input type="date" className={INPUT_CLS} style={INPUT_STYLE} value={v("decision_date")} onChange={set("decision_date")} />
            </Field>
          </div>
          <Field label="Remarks">
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={v("remarks")} onChange={set("remarks")} />
          </Field>
        </>
      )}
      {section === "similarity" && (
        <>
          {studyField}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Document Type" required>
              <select className={INPUT_CLS} style={invalidStyle(bad("document_type"))} value={v("document_type")} onChange={set("document_type")}>
                <option value="">Select type</option>
                {(Object.keys(DOC_TYPE_LABELS) as SimilarityDocumentType[]).map((t) => (
                  <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Similarity Index (%)" required>
              <input type="number" min="0" max="100" step="0.01" className={INPUT_CLS} style={invalidStyle(bad("similarity_index"))} value={v("similarity_index")} onChange={set("similarity_index")} />
            </Field>
          </div>
          <Field label="Document Title">
            <input className={INPUT_CLS} style={INPUT_STYLE} value={v("document_title")} onChange={set("document_title")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Software Used">
              <input className={INPUT_CLS} style={INPUT_STYLE} value={v("software_used")} onChange={set("software_used")} placeholder="e.g. Turnitin" />
            </Field>
            <Field label="Date Checked" required>
              <input type="date" className={INPUT_CLS} style={invalidStyle(bad("checked_on"))} value={v("checked_on")} onChange={set("checked_on")} />
            </Field>
          </div>
        </>
      )}
      {section === "ai" && (
        <>
          {studyField}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tool Name" required>
              <input className={INPUT_CLS} style={invalidStyle(bad("tool_name"))} value={v("tool_name")} onChange={set("tool_name")} placeholder="e.g. ChatGPT, Grammarly" />
            </Field>
            <Field label="Date Declared" required>
              <input type="date" className={INPUT_CLS} style={invalidStyle(bad("declared_on"))} value={v("declared_on")} onChange={set("declared_on")} />
            </Field>
          </div>
          <Field label="Purpose" required>
            <input className={INPUT_CLS} style={invalidStyle(bad("purpose"))} value={v("purpose")} onChange={set("purpose")} placeholder="e.g. grammar editing, data analysis" />
          </Field>
          <Field label="Extent of Use" required>
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={invalidStyle(bad("extent"))} value={v("extent")} onChange={set("extent")} placeholder="Describe how and where AI was used" />
          </Field>
          <Field label="AI-Generated Content (%) — optional">
            <input type="number" min="0" max="100" step="0.01" className={INPUT_CLS} style={invalidStyle(attempted && pctBad)} value={pct} onChange={set("ai_content_pct")} placeholder="0–100" />
          </Field>
        </>
      )}
      {section === "coi" && (
        <>
          <Field label="Description" required>
            <textarea rows={3} className={INPUT_CLS + " resize-none"} style={invalidStyle(bad("description"))} value={v("description")} onChange={set("description")} />
          </Field>
          <Field label="Mitigation Measures">
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={v("mitigation_measures")} onChange={set("mitigation_measures")} />
          </Field>
          <Field label="Date Disclosed" required>
            <input type="date" className={INPUT_CLS} style={invalidStyle(bad("disclosed_on"))} value={v("disclosed_on")} onChange={set("disclosed_on")} />
          </Field>
        </>
      )}
      {section === "misconduct" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject Name" required>
              <input className={INPUT_CLS} style={invalidStyle(bad("subject_name"))} value={v("subject_name")} onChange={set("subject_name")} />
            </Field>
            <Field label="Case Type" required>
              <select className={INPUT_CLS} style={invalidStyle(bad("case_type"))} value={v("case_type")} onChange={set("case_type")}>
                <option value="">Select type</option>
                {(Object.keys(CASE_TYPE_LABELS) as MisconductCaseType[]).map((c) => (
                  <option key={c} value={c}>{CASE_TYPE_LABELS[c]}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referred To" required>
              <input className={INPUT_CLS} style={invalidStyle(bad("referred_to"))} value={v("referred_to")} onChange={set("referred_to")} placeholder="e.g. Dean, Research Chairperson" />
            </Field>
            <Field label="Date Reported" required>
              <input type="date" className={INPUT_CLS} style={invalidStyle(bad("reported_on"))} value={v("reported_on")} onChange={set("reported_on")} />
            </Field>
          </div>
          <Field label="Remarks">
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={v("remarks")} onChange={set("remarks")} />
          </Field>
        </>
      )}
    </ProtoModal>
  );
}

export function IntegrityRecords({ projects, canEncode, canManage, userPk }: { projects: Project[]; canEncode: boolean; canManage: boolean; userPk: number }) {
  const [project, setProject] = useState("");
  const [section, setSection] = useState<SectionKey>("reviews");
  const [studies, setStudies] = useState<Study[]>([]);
  const [reviews, setReviews] = useState<EthicsReviewReference[]>([]);
  const [similarity, setSimilarity] = useState<SimilarityCheckRecord[]>([]);
  const [ai, setAi] = useState<AIUseDeclaration[]>([]);
  const [coi, setCoi] = useState<ConflictOfInterestDisclosure[]>([]);
  const [misconduct, setMisconduct] = useState<MisconductCaseReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!project) return;
    const id = Number(project);
    researchApi
      .getStudies(id)
      .then((s) => active && setStudies(s))
      .catch(() => active && setStudies([]));
    return () => {
      active = false;
    };
  }, [project]);

  useEffect(() => {
    let active = true;
    if (!project) return;
    const id = Number(project);
    const load: Record<SectionKey, () => Promise<void>> = {
      reviews: () => complianceApi.getEthicsReviews({ project: id }).then((r) => void (active && setReviews(r))),
      similarity: () => complianceApi.getSimilarityChecks({ project: id }).then((r) => void (active && setSimilarity(r))),
      ai: () => complianceApi.getAIDeclarations({ project: id }).then((r) => void (active && setAi(r))),
      coi: () => complianceApi.getCOIDisclosures({ project: id }).then((r) => void (active && setCoi(r))),
      misconduct: () => complianceApi.getMisconductCases({ project: id }).then((r) => void (active && setMisconduct(r))),
    };
    load[section]()
      .catch(() => active && notify.error("Could not load records for this section."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [project, section, reloadKey]);

  const verify = async (kind: VerifyKind, id: number) => {
    setBusy(`${kind}-${id}`);
    try {
      await complianceApi.verifyRecord(kind, id);
      notify.success("Record verified.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not verify this record."));
    } finally {
      setBusy(null);
    }
  };

  const patch = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error(errorMessage(err, "Could not update the status."));
    }
  };

  const canAdd = section === "reviews" || section === "similarity" ? canEncode : section === "misconduct" ? canManage : true;
  const rows = { reviews, similarity, ai, coi, misconduct }[section];
  const td = "px-4 py-3 text-xs";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[280px] flex-1 max-w-md">
          <label className="label-field">Project</label>
          <select
            className={INPUT_CLS}
            style={INPUT_STYLE}
            value={project}
            onChange={(e) => {
              setLoading(true);
              setProject(e.target.value);
            }}
          >
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
            ))}
          </select>
        </div>
        {project && canAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0d2a5e" }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            New {SECTIONS.find((s) => s.key === section)!.label.replace(/s$/, "")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              if (project) setLoading(true);
              setSection(s.key);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={section === s.key ? { background: "#0d2a5e", color: "white" } : { background: "white", color: "#64748b", border: "1px solid #e2e8f0" }}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {!project ? (
        <NoActualData message="Select a project" hint="Choose a project above to view or log its integrity records." />
      ) : loading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <NoActualData />
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ background: "white", border: "1px solid #e2e8f0" }}>
          <table className="w-full text-sm">
            {section === "reviews" && (
              <>
                <TableHead cols={["Review Body", "Reference No.", "Status", "Decision Date", "Remarks", "Verification"]} />
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " font-bold"} style={{ color: "#0d2a5e" }}>{REVIEW_BODY_LABELS[r.review_body]}</td>
                      <td className={td + " mono"} style={{ color: "#334155" }}>{r.reference_number || "—"}</td>
                      <td className={td}>
                        {canEncode ? (
                          <select className={INLINE_SELECT} style={{ borderColor: "#e2e8f0", background: REVIEW_STATUS_META[r.status].bg, color: REVIEW_STATUS_META[r.status].color }} value={r.status} onChange={(e) => patch(() => complianceApi.updateEthicsReview(r.id, { status: e.target.value }))}>
                            {Object.entries(REVIEW_STATUS_META).map(([k, m]) => (
                              <option key={k} value={k}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          <Pill bg={REVIEW_STATUS_META[r.status].bg} color={REVIEW_STATUS_META[r.status].color}>{REVIEW_STATUS_META[r.status].label}</Pill>
                        )}
                      </td>
                      <td className={td + " mono"} style={{ color: "#64748b" }}>{r.decision_date || "—"}</td>
                      <td className={td} style={{ color: "#64748b" }}>{r.remarks || "—"}</td>
                      <td className={td}><Verified at={r.verified_at} canVerify={canManage} busy={busy === `ethics-reviews-${r.id}`} onVerify={() => verify("ethics-reviews", r.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {section === "similarity" && (
              <>
                <TableHead cols={["Document", "Type", "Similarity Index", "Software", "Date Checked", "Verification"]} />
                <tbody>
                  {similarity.map((s) => (
                    <tr key={s.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " font-bold"} style={{ color: "#0d2a5e" }}>{s.document_title || "—"}</td>
                      <td className={td} style={{ color: "#334155" }}>{DOC_TYPE_LABELS[s.document_type]}</td>
                      <td className={td}>
                        <span className="mono font-bold mr-2" style={{ color: s.is_within_threshold ? "#059669" : "#dc2626" }}>{s.similarity_index}%</span>
                        {s.is_within_threshold ? <Pill bg="#d1fae5" color="#166534">Within threshold</Pill> : <Pill bg="#fee2e2" color="#991b1b">Exceeds threshold</Pill>}
                      </td>
                      <td className={td} style={{ color: "#64748b" }}>{s.software_used || "—"}</td>
                      <td className={td + " mono"} style={{ color: "#64748b" }}>{s.checked_on}</td>
                      <td className={td}><Verified at={s.verified_at} canVerify={canManage} busy={busy === `similarity-checks-${s.id}`} onVerify={() => verify("similarity-checks", s.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {section === "ai" && (
              <>
                <TableHead cols={["Tool", "Purpose", "Extent", "AI Content", "Date", "Verification"]} />
                <tbody>
                  {ai.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " font-bold"} style={{ color: "#0d2a5e" }}>{a.tool_name}</td>
                      <td className={td} style={{ color: "#334155" }}>{a.purpose}</td>
                      <td className={td + " max-w-[240px]"} style={{ color: "#64748b" }}>{a.extent}</td>
                      <td className={td + " whitespace-nowrap"}>
                        {a.ai_content_pct === null ? (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        ) : (
                          <>
                            <span className="mono font-bold mr-2" style={{ color: a.exceeds_ai_threshold ? "#dc2626" : "#334155" }}>{Number(a.ai_content_pct)}%</span>
                            {a.exceeds_ai_threshold && <Pill bg="#fee2e2" color="#991b1b">Over 20% AI</Pill>}
                          </>
                        )}
                      </td>
                      <td className={td + " mono"} style={{ color: "#64748b" }}>{a.declared_on}</td>
                      <td className={td}><Verified at={a.verified_at} canVerify={canManage} busy={busy === `ai-declarations-${a.id}`} onVerify={() => verify("ai-declarations", a.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {section === "coi" && (
              <>
                <TableHead cols={["Description", "Mitigation", "Status", "Date Disclosed", "Verification"]} />
                <tbody>
                  {coi.map((c) => (
                    <tr key={c.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " font-bold max-w-[280px]"} style={{ color: "#0d2a5e" }}>{c.description}</td>
                      <td className={td + " max-w-[240px]"} style={{ color: "#64748b" }}>{c.mitigation_measures || "—"}</td>
                      <td className={td}>
                        {canManage ? (
                          <select className={INLINE_SELECT} style={{ borderColor: "#e2e8f0", background: COI_STATUS_META[c.status].bg, color: COI_STATUS_META[c.status].color }} value={c.status} onChange={(e) => patch(() => complianceApi.updateCOIDisclosure(c.id, { status: e.target.value }))}>
                            {Object.entries(COI_STATUS_META).map(([k, m]) => (
                              <option key={k} value={k}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          <Pill bg={COI_STATUS_META[c.status].bg} color={COI_STATUS_META[c.status].color}>{COI_STATUS_META[c.status].label}</Pill>
                        )}
                      </td>
                      <td className={td + " mono"} style={{ color: "#64748b" }}>{c.disclosed_on}</td>
                      <td className={td}><Verified at={c.verified_at} canVerify={canManage} busy={busy === `coi-disclosures-${c.id}`} onVerify={() => verify("coi-disclosures", c.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {section === "misconduct" && (
              <>
                <TableHead cols={["Subject", "Case Type", "Referred To", "Status", "Reported On"]} />
                <tbody>
                  {misconduct.map((c) => (
                    <tr key={c.id} className="border-t" style={{ borderColor: "#f1f5f9" }}>
                      <td className={td + " font-bold"} style={{ color: "#0d2a5e" }}>{c.subject_name || `User #${c.subject}`}</td>
                      <td className={td} style={{ color: "#334155" }}>{CASE_TYPE_LABELS[c.case_type]}</td>
                      <td className={td} style={{ color: "#64748b" }}>{c.referred_to}</td>
                      <td className={td}>
                        {canManage ? (
                          <select className={INLINE_SELECT} style={{ borderColor: "#e2e8f0", background: MISCONDUCT_STATUS_META[c.status].bg, color: MISCONDUCT_STATUS_META[c.status].color }} value={c.status} onChange={(e) => patch(() => complianceApi.updateMisconductCase(c.id, { status: e.target.value }))}>
                            {Object.entries(MISCONDUCT_STATUS_META).map(([k, m]) => (
                              <option key={k} value={k}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          <Pill bg={MISCONDUCT_STATUS_META[c.status].bg} color={MISCONDUCT_STATUS_META[c.status].color}>{MISCONDUCT_STATUS_META[c.status].label}</Pill>
                        )}
                      </td>
                      <td className={td + " mono"} style={{ color: "#64748b" }}>{c.reported_on}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}

      {showAdd && project && (
        <AddRecordModal
          section={section}
          project={Number(project)}
          studies={studies}
          userPk={userPk}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
