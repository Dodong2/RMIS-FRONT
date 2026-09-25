import { useEffect, useState } from "react";
import { outputsApi } from "../../lib/outputsApi";
import { researchApi } from "../../lib/researchApi";
import { errorMessage } from "../../lib/errorMessage";
import { notify } from "../../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../../lib/protoStyles";
import { FAMILY_META, INDEXING_LABELS, IP_TYPE_LABELS, PUBLICATION_TYPE_LABELS, type OutputFamily } from "../../lib/outputsMeta";
import type { IndexingTier, IPType, OutcomeKind, PublicationType, SenseRankedPublisher } from "../../types/outputs";
import type { Project, Study } from "../../types/research";
import { Field, ProtoModal } from "../common/proto";

const today = () => new Date().toLocaleDateString("en-CA");

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "#334155" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function RegisterOutputModal({
  projects,
  senses,
  userPk,
  onClose,
  onSaved,
}: {
  projects: Project[];
  senses: SenseRankedPublisher[];
  userPk: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [family, setFamily] = useState<OutputFamily>("publication");
  const [project, setProject] = useState(projects[0] ? String(projects[0].id) : "");
  const [studies, setStudies] = useState<Study[]>([]);
  const [f, setF] = useState<Record<string, string>>({ published_on: today(), kind: "outcome", target_count: "1", manual_actual_count: "0" });
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!project) return;
    researchApi
      .getStudies(Number(project))
      .then((s) => active && setStudies(s))
      .catch(() => active && setStudies([]));
    return () => {
      active = false;
    };
  }, [project]);

  const v = (k: string) => f[k] ?? "";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const flag = (k: string) => !!flags[k];
  const setFlag = (k: string) => (val: boolean) => setFlags((p) => ({ ...p, [k]: val }));
  const bad = (k: string) => attempted && !v(k).trim();
  const study = v("study") ? Number(v("study")) : null;

  const required: Record<OutputFamily, string[]> = {
    publication: ["title", "publication_type", "published_on"],
    ip: ["title", "ip_type"],
    technology: ["description", "target_count"],
    partnership: ["description", "target_count"],
    outcome_impact: ["kind", "description"],
  };

  const save = async () => {
    setAttempted(true);
    if (!project || required[family].some((k) => !v(k).trim())) {
      notify.error("Fill in the required fields.");
      return;
    }
    setSaving(true);
    try {
      const pid = Number(project);
      if (family === "publication")
        await outputsApi.createPublication({
          project: pid,
          study,
          lead_author: userPk,
          title: v("title").trim(),
          publication_type: v("publication_type") as PublicationType,
          indexing_tier: (v("indexing_tier") as IndexingTier) || undefined,
          impact_factor: v("impact_factor") || undefined,
          h_index: v("h_index") || undefined,
          sense_publisher: v("sense_publisher") ? Number(v("sense_publisher")) : null,
          has_isbn: flag("has_isbn"),
          is_lspu_published: flag("is_lspu_published"),
          is_thesis_derived: flag("is_thesis_derived"),
          is_supervised_approved_thesis: flag("is_supervised_approved_thesis"),
          publisher_name: v("publisher_name") || undefined,
          doi_or_isbn: v("doi_or_isbn") || undefined,
          published_on: v("published_on"),
        });
      if (family === "ip")
        await outputsApi.createIPRecord({
          project: pid,
          study,
          creator: userPk,
          co_creators: v("co_creators") || undefined,
          title: v("title").trim(),
          ip_type: v("ip_type") as IPType,
          trl: v("trl") ? Number(v("trl")) : undefined,
          is_commercialization_intended: flag("is_commercialization_intended"),
          is_adopted_by_community: flag("is_adopted_by_community"),
          adoption_moa_reference: v("adoption_moa_reference") || undefined,
          registration_number: v("registration_number") || undefined,
          registered_on: v("registered_on") || undefined,
        });
      if (family === "technology" || family === "partnership")
        await outputsApi.createExpectedOutput({
          project: pid,
          category: family === "technology" ? "products" : "places_partnerships",
          description: v("description").trim(),
          target_count: Number(v("target_count")),
          manual_actual_count: Number(v("manual_actual_count") || 0),
        });
      if (family === "outcome_impact")
        await outputsApi.createOutcome({
          project: pid,
          kind: v("kind") as OutcomeKind,
          description: v("description").trim(),
          observed_on: v("observed_on") || null,
          evidence: v("evidence") || undefined,
        });
      notify.success(`${FAMILY_META[family].label.replace(/s$/, "")} registered.`);
      onSaved();
    } catch (err) {
      notify.error(errorMessage(err, "Could not register this output."));
    } finally {
      setSaving(false);
    }
  };

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
      title="Register Output"
      subtitle="Publications · IP · Technologies · Partnerships · Outcomes & Impacts"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {saving ? "Registering…" : "Register Output"}
          </button>
        </>
      }
    >
      <div>
        <label className="label-field">Output Family</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
          {(Object.entries(FAMILY_META) as [OutputFamily, (typeof FAMILY_META)[OutputFamily]][]).map(([k, m]) => (
            <button
              key={k}
              onClick={() => {
                setFamily(k);
                setAttempted(false);
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all"
              style={{ background: family === k ? m.bg : "#f8fafc", color: m.color, border: `1.5px solid ${family === k ? m.color + "40" : "#e2e8f0"}` }}
            >
              <span className="text-base">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Project" required>
        <select className={INPUT_CLS} style={invalidStyle(attempted && !project)} value={project} onChange={(e) => {
          setProject(e.target.value);
          setF((p) => ({ ...p, study: "" }));
        }}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>
          ))}
        </select>
      </Field>

      {family === "publication" && (
        <>
          {studyField}
          <Field label="Title" required>
            <input className={INPUT_CLS} style={invalidStyle(bad("title"))} value={v("title")} onChange={set("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publication Type" required>
              <select className={INPUT_CLS} style={invalidStyle(bad("publication_type"))} value={v("publication_type")} onChange={set("publication_type")}>
                <option value="">Select type</option>
                {Object.entries(PUBLICATION_TYPE_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Date Published" required>
              <input type="date" className={INPUT_CLS} style={invalidStyle(bad("published_on"))} value={v("published_on")} onChange={set("published_on")} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Indexing Tier">
              <select className={INPUT_CLS} style={INPUT_STYLE} value={v("indexing_tier")} onChange={set("indexing_tier")}>
                <option value="">Not applicable</option>
                {Object.entries(INDEXING_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Impact Factor (ISI)">
              <input type="number" step="0.001" min="0" className={INPUT_CLS} style={INPUT_STYLE} value={v("impact_factor")} onChange={set("impact_factor")} />
            </Field>
            <Field label="H-Index (Scopus)">
              <input type="number" step="0.01" min="0" className={INPUT_CLS} style={INPUT_STYLE} value={v("h_index")} onChange={set("h_index")} />
            </Field>
          </div>
          <Field label="SENSE-Ranked Publisher (books)">
            <select className={INPUT_CLS} style={INPUT_STYLE} value={v("sense_publisher")} onChange={set("sense_publisher")}>
              <option value="">Not applicable</option>
              {senses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publisher Name">
              <input className={INPUT_CLS} style={INPUT_STYLE} value={v("publisher_name")} onChange={set("publisher_name")} />
            </Field>
            <Field label="DOI / ISBN">
              <input className={INPUT_CLS} style={INPUT_STYLE} value={v("doi_or_isbn")} onChange={set("doi_or_isbn")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Check label="Has ISBN" checked={flag("has_isbn")} onChange={setFlag("has_isbn")} />
            <Check label="LSPU-Published" checked={flag("is_lspu_published")} onChange={setFlag("is_lspu_published")} />
            <Check label="Thesis-Derived" checked={flag("is_thesis_derived")} onChange={setFlag("is_thesis_derived")} />
            <Check label="Supervised & Approved Thesis" checked={flag("is_supervised_approved_thesis")} onChange={setFlag("is_supervised_approved_thesis")} />
          </div>
          <p className="text-xs" style={{ color: "#94a3b8" }}>You are recorded as lead author. The R&D incentive is computed by the server per the Manual's Article V.</p>
        </>
      )}

      {family === "ip" && (
        <>
          {studyField}
          <Field label="Title" required>
            <input className={INPUT_CLS} style={invalidStyle(bad("title"))} value={v("title")} onChange={set("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IP Type" required>
              <select className={INPUT_CLS} style={invalidStyle(bad("ip_type"))} value={v("ip_type")} onChange={set("ip_type")}>
                <option value="">Select type</option>
                {Object.entries(IP_TYPE_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="TRL (1-9)">
              <input type="number" min="1" max="9" className={INPUT_CLS} style={INPUT_STYLE} value={v("trl")} onChange={set("trl")} />
            </Field>
          </div>
          <Field label="Co-Creators">
            <input className={INPUT_CLS} style={INPUT_STYLE} value={v("co_creators")} onChange={set("co_creators")} placeholder="Comma-separated names" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration Number">
              <input className={INPUT_CLS} style={INPUT_STYLE} value={v("registration_number")} onChange={set("registration_number")} />
            </Field>
            <Field label="Date Registered">
              <input type="date" className={INPUT_CLS} style={INPUT_STYLE} value={v("registered_on")} onChange={set("registered_on")} />
            </Field>
          </div>
          <Field label="Adoption MOA Reference">
            <input className={INPUT_CLS} style={INPUT_STYLE} value={v("adoption_moa_reference")} onChange={set("adoption_moa_reference")} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Check label="Commercialization Intended" checked={flag("is_commercialization_intended")} onChange={setFlag("is_commercialization_intended")} />
            <Check label="Adopted by a Recipient Community" checked={flag("is_adopted_by_community")} onChange={setFlag("is_adopted_by_community")} />
          </div>
        </>
      )}

      {(family === "technology" || family === "partnership") && (
        <>
          <Field label={family === "technology" ? "Technology / Product" : "Partnership / Place"} required>
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={invalidStyle(bad("description"))} value={v("description")} onChange={set("description")} placeholder={family === "technology" ? "e.g. Mobile soil-testing kit prototype" : "e.g. MOA with Municipal Agriculture Office"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target Count" required>
              <input type="number" min="1" className={INPUT_CLS} style={invalidStyle(bad("target_count"))} value={v("target_count")} onChange={set("target_count")} />
            </Field>
            <Field label="Achieved So Far">
              <input type="number" min="0" className={INPUT_CLS} style={INPUT_STYLE} value={v("manual_actual_count")} onChange={set("manual_actual_count")} />
            </Field>
          </div>
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            Recorded as a 6Ps expected output ({family === "technology" ? "Products" : "Places and Partnerships"}) and counted in Expected vs Actual.
          </p>
        </>
      )}

      {family === "outcome_impact" && (
        <>
          <Field label="Kind" required>
            <select className={INPUT_CLS} style={invalidStyle(bad("kind"))} value={v("kind")} onChange={set("kind")}>
              <option value="outcome">📈 Project Outcome</option>
              <option value="impact">🌱 Societal Impact</option>
            </select>
          </Field>
          <Field label="Description" required>
            <textarea rows={3} className={INPUT_CLS + " resize-none"} style={invalidStyle(bad("description"))} value={v("description")} onChange={set("description")} />
          </Field>
          <Field label="Observed On">
            <input type="date" className={INPUT_CLS} style={INPUT_STYLE} value={v("observed_on")} onChange={set("observed_on")} />
          </Field>
          <Field label="Evidence">
            <textarea rows={2} className={INPUT_CLS + " resize-none"} style={INPUT_STYLE} value={v("evidence")} onChange={set("evidence")} placeholder="Where this is documented (report, MOA, news, etc.)" />
          </Field>
        </>
      )}
    </ProtoModal>
  );
}
