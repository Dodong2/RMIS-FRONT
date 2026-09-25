import { useState } from "react";
import { monitoringApi } from "../../lib/monitoringApi";
import { riskApi } from "../../lib/riskApi";
import { reportErrorMessage } from "../../lib/reportsApi";
import { runServerReport, type ReportParams } from "../../lib/reportRunner";
import { errorMessage } from "../../lib/errorMessage";
import { exportPdf, exportXlsx, type ExportDoc } from "../../lib/exportFiles";
import { notify } from "../../lib/notify";
import { INPUT_CLS, INPUT_STYLE, invalidStyle } from "../../lib/protoStyles";
import { DOMAIN_META, FORMAT_META, FUNDING_TYPE_LABELS, PARAM_LABELS, STATUS_LABELS, type CatalogFormat, type ReportDefinition, type ReportParam } from "../../lib/reportCatalog";
import { CAT_META, STATUS_META as RISK_STATUS_META, LEVEL_META } from "../../lib/riskMeta";
import type { Project } from "../../types/research";
import { Field, ProtoModal } from "../common/proto";

type Params = ReportParams;

const OUTCOME_LABELS: Record<string, string> = { pending: "Pending", passed: "Passed", conditional: "Conditional", failed: "Failed" };

async function runClientReport(def: ReportDefinition, p: Params, format: CatalogFormat, projects: Project[]) {
  const project = p.project ? Number(p.project) : undefined;
  const code = (id: number) => projects.find((x) => x.id === id)?.project_code ?? `Project #${id}`;
  const scope = project ? code(project) : "All projects";
  let doc: ExportDoc;
  if (def.id === "risk_register") {
    const risks = await riskApi.getRegister({ project });
    doc = {
      title: def.name,
      scope,
      sections: [
        {
          heading: `Risk Register (${risks.length})`,
          head: ["ID", "Project", "Risk", "Category", "L", "I", "Score", "Level", "Owner", "Status", "Mitigation", "Updated"],
          body: risks.map((r) => [`R-${r.id}`, code(r.project), r.description, CAT_META[r.category].label, r.likelihood, r.impact, r.score, LEVEL_META[r.level].label, r.owner_email, RISK_STATUS_META[r.status].label, r.mitigation || "—", r.updated_at.slice(0, 10)]),
        },
      ],
    };
  } else {
    const evals = await monitoringApi.getEvaluations({ project });
    doc = {
      title: def.name,
      scope,
      sections: [
        {
          heading: `Evaluations (${evals.length})`,
          head: ["Project", "Year", "Scheduled", "Panel", "Outcome", "Weighted Score", "Evaluated", "Remarks"],
          body: evals.map((e) => [code(e.project), e.project_year, e.scheduled_date, e.panel_members || "—", OUTCOME_LABELS[e.outcome] ?? e.outcome, e.weighted_score ?? "—", e.evaluated_at?.slice(0, 10) ?? "—", e.remarks || "—"]),
        },
      ],
    };
  }
  if (format === "pdf") exportPdf(doc);
  else exportXlsx(doc);
}

export function GenerateReportModal({ def, initial, projects, onGenerated, onClose }: { def: ReportDefinition; initial?: Params; projects: Project[]; onGenerated: () => void; onClose: () => void }) {
  const [params, setParams] = useState<Params>(initial ?? {});
  const [format, setFormat] = useState<CatalogFormat>(def.formats[0]);
  const [generating, setGenerating] = useState(false);
  const [tried, setTried] = useState(false);
  const dm = DOMAIN_META[def.domain];

  const campuses = [...new Set(projects.map((p) => p.campus).filter(Boolean))].sort();
  const thrusts = [...new Set(projects.map((p) => p.rei_thrust).filter(Boolean))].sort();
  const missing = def.required.filter((k) => !params[k]);
  const set = (k: ReportParam, v: string) => setParams((cur) => ({ ...cur, [k]: v }));

  const generate = async () => {
    setTried(true);
    if (missing.length) return;
    setGenerating(true);
    try {
      if (def.source === "server") await runServerReport(def.id, params, format);
      else await runClientReport(def, params, format, projects);
      notify.success(`${def.name} generated.`);
      onGenerated();
    } catch (err) {
      notify.error(def.source === "server" ? await reportErrorMessage(err, "Could not generate the report.") : errorMessage(err, "Could not generate the report."));
    } finally {
      setGenerating(false);
    }
  };

  const select = (k: ReportParam, options: [string, string][], allLabel: string) => (
    <select value={params[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={INPUT_CLS} style={invalidStyle(tried && missing.includes(k))}>
      <option value="">{allLabel}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );

  const control = (k: ReportParam) => {
    switch (k) {
      case "project":
        return select(k, projects.map((p) => [String(p.id), `${p.project_code} — ${p.title}`]), def.required.includes("project") ? "Select a project" : "All projects");
      case "campus":
        return select(k, campuses.map((c) => [c, c]), "All campuses");
      case "funding_type":
        return select(k, Object.entries(FUNDING_TYPE_LABELS), "All funding types");
      case "status":
        return select(k, Object.entries(STATUS_LABELS), "All statuses");
      case "rei_thrust":
        return select(k, thrusts.map((t) => [t, t]), "All REI thrusts");
      case "year":
        return <input type="number" min={2000} max={2100} value={params.year ?? ""} onChange={(e) => set("year", e.target.value)} placeholder="All years" className={INPUT_CLS} style={INPUT_STYLE} />;
    }
  };

  return (
    <ProtoModal
      title={
        <div className="flex items-start gap-3">
          <span className="text-2xl">{def.icon}</span>
          <span>{def.name}</span>
        </div>
      }
      subtitle={def.description}
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
          <button onClick={generate} disabled={generating} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #0d2a5e, #0891b2)" }}>
            {generating ? (
              <>
                <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" /><path d="M4 12a8 8 0 018-8" stroke="white" strokeWidth="4" strokeLinecap="round" /></svg> Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                Generate &amp; Download {FORMAT_META[format].label}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: dm.bg, color: dm.color }}>{dm.icon} {dm.label} Report</span>
        <span className="text-xs" style={{ color: "#94a3b8" }}>
          {def.source === "server" ? "Generated by the server and recorded in the generation log" : "Built in your browser from live data (not recorded in the generation log)"}
        </span>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#94a3b8" }}>Report Parameters</p>
        <div className="grid grid-cols-2 gap-4">
          {def.params.map((k) => (
            <Field key={k} label={PARAM_LABELS[k]} required={def.required.includes(k)} className={k === "project" ? "col-span-2" : ""}>
              {control(k)}
            </Field>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>Export Format</p>
        <div className="flex gap-2">
          {def.formats.map((f) => {
            const fm = FORMAT_META[f];
            return (
              <button key={f} onClick={() => setFormat(f)} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all" style={{ background: format === f ? fm.bg : "#f8fafc", color: fm.color, border: `1.5px solid ${format === f ? fm.color + "40" : "#e2e8f0"}` }}>
                {fm.label}
              </button>
            );
          })}
        </div>
      </div>
    </ProtoModal>
  );
}
