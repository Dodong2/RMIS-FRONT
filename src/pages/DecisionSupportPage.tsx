import { useEffect, useMemo, useState } from "react";
import { Compass, Scale, TrendingUp } from "lucide-react";
import { decisionSupportApi } from "../lib/decisionSupportApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type {
  AHPMatrixRun,
  CriterionMetricKey,
  DecisionCriterion,
  FundingRecommendationRun,
  SensitivityAnalysisResult,
} from "../types/decisionSupport";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { EmptyOption } from "../components/common/EmptyOption";
import { FieldLabel } from "../components/common/FieldLabel";
import { EmptyState, PageHeader } from "../components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "../lib/notify";

const DSS_ROLE_CODES = ["system_admin", "drd", "vprei"];

const METRIC_LABELS: Record<CriterionMetricKey, string> = {
  output_score: "Research Output Volume",
  compliance_score: "Compliance Completeness",
  budget_utilization_pct: "Budget Utilization %",
  monitoring_health: "Monitoring/Reporting Health",
  renewal_eligible: "Renewal Eligibility",
  overrun_risk_inverse: "Forecast Overrun-Risk (inverse)",
  risk_score_inverse: "Project Risk Score (inverse)",
};

const METRIC_OPTIONS = Object.entries(METRIC_LABELS) as [CriterionMetricKey, string][];

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

const saatyValueFor = (numeric: number) =>
  SAATY_SCALE.find((s) => s.numeric === numeric)?.value ?? "1";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const SECTIONS = [
  { key: "criteria", label: "Criteria" },
  { key: "ahp", label: "AHP Weighting" },
  { key: "recommendations", label: "Funding Recommendations" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function CriteriaTab({
  canManage,
  criteria,
  onCreated,
}: {
  canManage: boolean;
  criteria: DecisionCriterion[];
  onCreated: (c: DecisionCriterion) => void;
}) {
  const [name, setName] = useState("");
  const [metricKey, setMetricKey] = useState<CriterionMetricKey | "">("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !metricKey) return;
    setIsSaving(true);
    try {
      const created = await decisionSupportApi.createCriterion({
        name: name.trim(),
        metric_key: metricKey,
        description: description.trim(),
      });
      onCreated(created);
      setName("");
      setMetricKey("");
      setDescription("");
      notify.success("Criterion added.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not add this criterion."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {canManage && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Add a Decision Criterion</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel required>Name</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Output Volume" />
            </div>
            <div>
              <FieldLabel required>Metric</FieldLabel>
              <Select value={metricKey} onValueChange={(v) => setMetricKey(v as CriterionMetricKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a metric" />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <Button className="mt-3" size="sm" onClick={handleCreate} disabled={isSaving || !name.trim() || !metricKey}>
            {isSaving ? "Adding..." : "Add Criterion"}
          </Button>
        </Card>
      )}

      {criteria.length === 0 ? (
        <EmptyState icon={<Scale className="size-7" />} title="No criteria defined yet" />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                <TableHead>Name</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{METRIC_LABELS[c.metric_key]}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "outline" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function AHPTab({
  canManage,
  criteria,
  ahpRuns,
  setAhpRuns,
}: {
  canManage: boolean;
  criteria: DecisionCriterion[];
  ahpRuns: AHPMatrixRun[];
  setAhpRuns: (updater: (prev: AHPMatrixRun[]) => AHPMatrixRun[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCriteriaIds, setNewCriteriaIds] = useState<number[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [comparisons, setComparisons] = useState<Record<string, string>>({});
  const [isFinalizing, setIsFinalizing] = useState(false);

  const criteriaById = useMemo(() => new Map(criteria.map((c) => [c.id, c])), [criteria]);
  const selectedRun = ahpRuns.find((r) => r.id === selectedRunId) ?? null;

  const runCriteria = useMemo(
    () => (selectedRun ? selectedRun.criteria.map((id) => criteriaById.get(id)).filter((c): c is DecisionCriterion => !!c) : []),
    [selectedRun, criteriaById],
  );

  const pairs = useMemo(() => {
    const result: { row: DecisionCriterion; col: DecisionCriterion }[] = [];
    for (let i = 0; i < runCriteria.length; i++) {
      for (let j = i + 1; j < runCriteria.length; j++) {
        result.push({ row: runCriteria[i], col: runCriteria[j] });
      }
    }
    return result;
  }, [runCriteria]);

  const selectRun = (run: AHPMatrixRun) => {
    setSelectedRunId(run.id);
    const runCriteriaIds = run.criteria;
    const initial: Record<string, string> = {};
    for (let i = 0; i < runCriteriaIds.length; i++) {
      for (let j = i + 1; j < runCriteriaIds.length; j++) {
        const rowId = runCriteriaIds[i];
        const colId = runCriteriaIds[j];
        const key = `${rowId}-${colId}`;
        const existing = run.comparisons.find((c) => c.criterion_row === rowId && c.criterion_col === colId);
        initial[key] = existing ? saatyValueFor(existing.value) : "1";
      }
    }
    setComparisons(initial);
  };

  const toggleCriterion = (id: number) => {
    setNewCriteriaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateRun = async () => {
    if (!newLabel.trim() || newCriteriaIds.length === 0) return;
    setIsCreating(true);
    try {
      const run = await decisionSupportApi.createAHPRun({ label: newLabel.trim(), criteria: newCriteriaIds });
      setAhpRuns((prev) => [run, ...prev]);
      selectRun(run);
      setNewLabel("");
      setNewCriteriaIds([]);
      notify.success("AHP run created. Fill in the pairwise comparisons below.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not create this AHP run."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedRun) return;
    setIsFinalizing(true);
    try {
      if (pairs.length > 0) {
        const payload = pairs.map(({ row, col }) => {
          const key = `${row.id}-${col.id}`;
          const numeric = SAATY_SCALE.find((s) => s.value === comparisons[key])?.numeric ?? 1;
          return { criterion_row: row.id, criterion_col: col.id, value: numeric };
        });
        await decisionSupportApi.submitComparisons(selectedRun.id, payload);
      }
      const finalized = await decisionSupportApi.finalizeAHPRun(selectedRun.id);
      setAhpRuns((prev) => prev.map((r) => (r.id === finalized.id ? finalized : r)));
      notify.success(
        finalized.is_consistent
          ? "Weights finalized — consistency ratio is acceptable."
          : "Weights finalized, but the consistency ratio exceeds 0.10. Reconsider your comparisons before using this run.",
      );
    } catch (err) {
      notify.error(errorMessage(err, "Could not finalize this AHP run."));
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div>
      {canManage && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">New AHP Weighting Run</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel required>Label</FieldLabel>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. 2026 Funding Cycle" />
            </div>
            <div>
              <FieldLabel required>Criteria to weigh</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {criteria.filter((c) => c.is_active).map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={newCriteriaIds.includes(c.id) ? "default" : "outline"}
                    onClick={() => toggleCriterion(c.id)}
                  >
                    {c.name}
                  </Button>
                ))}
                {criteria.filter((c) => c.is_active).length === 0 && (
                  <p className="text-xs text-muted-foreground">Add criteria in the Criteria tab first.</p>
                )}
              </div>
            </div>
          </div>
          <Button
            className="mt-3"
            size="sm"
            onClick={handleCreateRun}
            disabled={isCreating || !newLabel.trim() || newCriteriaIds.length === 0}
          >
            {isCreating ? "Creating..." : "Create Run"}
          </Button>
        </Card>
      )}

      {ahpRuns.length === 0 ? (
        <EmptyState icon={<Scale className="size-7" />} title="No AHP runs yet" />
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>Label</TableHead>
                  <TableHead>Criteria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Consistency Ratio</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ahpRuns.map((r) => (
                  <TableRow key={r.id} className={r.id === selectedRunId ? "bg-secondary/40" : undefined}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>{r.criteria.length}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "finalized" ? "outline" : "secondary"}>
                        {r.status === "finalized" ? "Finalized" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.consistency_ratio === null ? (
                        "—"
                      ) : (
                        <span className={r.is_consistent ? "text-navy" : "text-destructive"}>
                          {r.consistency_ratio.toFixed(4)} {r.is_consistent ? "" : "(inconsistent)"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectRun(r)}
                        disabled={r.id === selectedRunId}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {selectedRun && (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-navy">{selectedRun.label}</h3>

              {selectedRun.status === "finalized" ? (
                <div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Consistency Ratio: {selectedRun.consistency_ratio?.toFixed(4)} —{" "}
                    {selectedRun.is_consistent ? "acceptable (≤ 0.10)" : "exceeds 0.10, not usable for a recommendation run"}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Criterion</TableHead>
                        <TableHead>Weight</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runCriteria
                        .slice()
                        .sort((a, b) => (selectedRun.weights[String(b.id)] ?? 0) - (selectedRun.weights[String(a.id)] ?? 0))
                        .map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell>{pct(selectedRun.weights[String(c.id)] ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : pairs.length === 0 ? (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Only one criterion in this run — no pairwise comparison needed.
                  </p>
                  {canManage && (
                    <Button size="sm" onClick={handleFinalize} disabled={isFinalizing}>
                      {isFinalizing ? "Finalizing..." : "Finalize Weights"}
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    For each pair, choose which criterion matters more and by how much (Saaty 1–9 scale).
                  </p>
                  <div className="space-y-3">
                    {pairs.map(({ row, col }) => {
                      const key = `${row.id}-${col.id}`;
                      return (
                        <div key={key} className="flex flex-wrap items-center gap-3">
                          <span className="w-40 shrink-0 text-sm font-medium text-navy">{row.name}</span>
                          <span className="text-xs text-muted-foreground">vs.</span>
                          <span className="w-40 shrink-0 text-sm font-medium text-navy">{col.name}</span>
                          <div className="w-72">
                            <Select
                              value={comparisons[key] ?? "1"}
                              onValueChange={(v) => setComparisons((prev) => ({ ...prev, [key]: v }))}
                              disabled={!canManage}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SAATY_SCALE.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {canManage && (
                    <Button className="mt-4" size="sm" onClick={handleFinalize} disabled={isFinalizing}>
                      {isFinalizing ? "Finalizing..." : "Finalize Weights"}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationsTab({
  canManage,
  criteria,
  ahpRuns,
  projects,
  runs,
  setRuns,
}: {
  canManage: boolean;
  criteria: DecisionCriterion[];
  ahpRuns: AHPMatrixRun[];
  projects: Project[];
  runs: FundingRecommendationRun[];
  setRuns: (updater: (prev: FundingRecommendationRun[]) => FundingRecommendationRun[]) => void;
}) {
  const usableAhpRuns = ahpRuns.filter((r) => r.status === "finalized" && r.is_consistent);
  const criteriaById = useMemo(() => new Map(criteria.map((c) => [c.id, c])), [criteria]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const ahpRunsById = useMemo(() => new Map(ahpRuns.map((r) => [r.id, r])), [ahpRuns]);

  const [label, setLabel] = useState("");
  const [ahpRunId, setAhpRunId] = useState("");
  const [fundingType, setFundingType] = useState("");
  const [campus, setCampus] = useState("");
  const [isTriggering, setIsTriggering] = useState(false);

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  const [sensCriterion, setSensCriterion] = useState("");
  const [sensDelta, setSensDelta] = useState("0.1");
  const [sensResult, setSensResult] = useState<SensitivityAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleTrigger = async () => {
    if (!ahpRunId) return;
    setIsTriggering(true);
    try {
      const run = await decisionSupportApi.triggerRecommendationRun({
        ahp_run: Number(ahpRunId),
        label: label.trim() || undefined,
        funding_type: fundingType || undefined,
        campus: campus.trim() || undefined,
      });
      setRuns((prev) => [run, ...prev]);
      setSelectedRunId(run.id);
      setSensResult(null);
      setLabel("");
      notify.success("Funding recommendation ranked.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not run this recommendation."));
    } finally {
      setIsTriggering(false);
    }
  };

  const runAhpRun = selectedRun ? ahpRunsById.get(selectedRun.ahp_run) : null;
  const runCriteria = useMemo(
    () =>
      runAhpRun
        ? runAhpRun.criteria
            .map((id) => criteriaById.get(id))
            .filter((c): c is DecisionCriterion => !!c)
            .sort((a, b) => (runAhpRun.weights[String(b.id)] ?? 0) - (runAhpRun.weights[String(a.id)] ?? 0))
        : [],
    [runAhpRun, criteriaById],
  );

  const handleAnalyze = async () => {
    if (!selectedRun || !sensCriterion) return;
    setIsAnalyzing(true);
    try {
      const result = await decisionSupportApi.getSensitivity(selectedRun.id, Number(sensCriterion), Number(sensDelta));
      setSensResult(result);
    } catch (err) {
      notify.error(errorMessage(err, "Could not run sensitivity analysis."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div>
      {canManage && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Run a Funding Recommendation</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <FieldLabel required>AHP Run</FieldLabel>
              <Select value={ahpRunId} onValueChange={setAhpRunId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a finalized run" />
                </SelectTrigger>
                <SelectContent>
                  {usableAhpRuns.length === 0 && (
                    <EmptyOption message="No finalized, consistent AHP run available yet" />
                  )}
                  {usableAhpRuns.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Label</FieldLabel>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <FieldLabel>Funding Type</FieldLabel>
              <Select value={fundingType} onValueChange={(v) => setFundingType(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All funding types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All funding types</SelectItem>
                  {Object.entries(FUNDING_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Campus</FieldLabel>
              <Input value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <Button className="mt-3" size="sm" onClick={handleTrigger} disabled={isTriggering || !ahpRunId}>
            <TrendingUp className="size-4" />
            {isTriggering ? "Ranking..." : "Run Recommendation"}
          </Button>
        </Card>
      )}

      {runs.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-7" />}
          title="No funding recommendation runs yet"
          description={canManage ? "Run one above once you have a finalized AHP weighting." : "Only DRD, VPREI, or System Admin can run one."}
        />
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>Label</TableHead>
                  <TableHead>AHP Run</TableHead>
                  <TableHead>Filters</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} className={r.id === selectedRunId ? "bg-secondary/40" : undefined}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>{ahpRunsById.get(r.ahp_run)?.label ?? `Run #${r.ahp_run}`}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[FUNDING_TYPE_LABELS[r.funding_type_filter], r.campus_filter].filter(Boolean).join(" · ") || "None"}
                    </TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRunId(r.id);
                          setSensResult(null);
                        }}
                        disabled={r.id === selectedRunId}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {selectedRun && (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border p-4">
                <h3 className="text-sm font-semibold text-navy">{selectedRun.label} — Ranked Projects</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Project</TableHead>
                    {runCriteria.map((c) => (
                      <TableHead key={c.id} title={METRIC_LABELS[c.metric_key]}>
                        {c.name}
                      </TableHead>
                    ))}
                    <TableHead>Composite Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRun.scores.map((s) => {
                    const project = projectsById.get(s.project);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.rank}</TableCell>
                        <TableCell>{project ? `${project.project_code} — ${project.title}` : `Project #${s.project}`}</TableCell>
                        {runCriteria.map((c) => (
                          <TableCell key={c.id} className="text-muted-foreground">
                            {s.normalized_scores[String(c.id)] !== undefined
                              ? pct(s.normalized_scores[String(c.id)])
                              : "—"}
                          </TableCell>
                        ))}
                        <TableCell className="font-medium text-navy">{s.composite_score.toFixed(4)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="border-t border-border p-4">
                <h4 className="mb-3 text-sm font-semibold text-navy">Sensitivity Analysis</h4>
                <p className="mb-3 text-xs text-muted-foreground">
                  See how the ranking would change if one criterion's weight shifted, without re-running the full scoring.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-64">
                    <FieldLabel>Criterion</FieldLabel>
                    <Select value={sensCriterion} onValueChange={setSensCriterion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a criterion" />
                      </SelectTrigger>
                      <SelectContent>
                        {runCriteria.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <FieldLabel>Weight Delta</FieldLabel>
                    <Input
                      type="number"
                      step="0.05"
                      min="-1"
                      max="1"
                      value={sensDelta}
                      onChange={(e) => setSensDelta(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={handleAnalyze} disabled={isAnalyzing || !sensCriterion}>
                    {isAnalyzing ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>

                {sensResult && (
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Original Rank</TableHead>
                        <TableHead>Adjusted Rank</TableHead>
                        <TableHead>Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sensResult.results.map((r) => {
                        const project = projectsById.get(r.project);
                        return (
                          <TableRow key={r.project}>
                            <TableCell>{project ? `${project.project_code} — ${project.title}` : `Project #${r.project}`}</TableCell>
                            <TableCell>{r.original_rank}</TableCell>
                            <TableCell>{r.adjusted_rank}</TableCell>
                            <TableCell>
                              {r.rank_change === 0 ? (
                                <span className="text-muted-foreground">No change</span>
                              ) : r.rank_change > 0 ? (
                                <Badge variant="outline">Up {r.rank_change}</Badge>
                              ) : (
                                <Badge variant="destructive">Down {Math.abs(r.rank_change)}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionSupportContent() {
  const { user } = useAuth();
  const canManage = !!user?.role && DSS_ROLE_CODES.includes(user.role.code);

  const [section, setSection] = useState<SectionKey>("criteria");
  const [isLoading, setIsLoading] = useState(true);

  const [criteria, setCriteria] = useState<DecisionCriterion[]>([]);
  const [ahpRuns, setAhpRuns] = useState<AHPMatrixRun[]>([]);
  const [recommendationRuns, setRecommendationRuns] = useState<FundingRecommendationRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [c, a, r, p] = await Promise.all([
          decisionSupportApi.getCriteria(),
          decisionSupportApi.getAHPRuns(),
          decisionSupportApi.getRecommendationRuns(),
          researchApi.getProjects(),
        ]);
        setCriteria(c);
        setAhpRuns(a);
        setRecommendationRuns(r);
        setProjects(p);
      } catch {
        notify.error("Could not load decision support data. Check your connection and refresh.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Decision Support"
        description="AHP-weighted, WSM-scored funding recommendations across active projects. Criteria are drawn from data RMIS already tracks (outputs, compliance, budget, monitoring, renewal eligibility, forecast risk)."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={section === s.key ? "default" : "outline"}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {section === "criteria" && (
            <CriteriaTab
              canManage={canManage}
              criteria={criteria}
              onCreated={(c) => setCriteria((prev) => [...prev, c])}
            />
          )}
          {section === "ahp" && (
            <AHPTab canManage={canManage} criteria={criteria} ahpRuns={ahpRuns} setAhpRuns={setAhpRuns} />
          )}
          {section === "recommendations" && (
            <RecommendationsTab
              canManage={canManage}
              criteria={criteria}
              ahpRuns={ahpRuns}
              projects={projects}
              runs={recommendationRuns}
              setRuns={setRecommendationRuns}
            />
          )}
        </>
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
