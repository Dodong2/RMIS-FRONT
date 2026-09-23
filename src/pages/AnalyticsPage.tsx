import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, FileDown, Target } from "lucide-react";
import { dashboardApi } from "../lib/dashboardApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type {
  AppendixEEntry,
  AppendixFExport,
  AppendixGExport,
  BudgetDashboard,
  ComplianceDashboard,
  OutputDashboard,
  PlanningMetric,
  PlanningTarget,
  PlanningTargetComparison,
  ProjectDashboard,
  REIThrustAlignment,
} from "../types/dashboard";
import type { FundingType, Project } from "../types/research";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { notify } from "../lib/notify";

const MANAGE_TARGET_ROLE_CODES = ["system_admin", "riuh", "drd", "vprei"];

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  journal_article: "Journal Article",
  book: "Book",
  book_chapter: "Book Chapter",
  conference_proceeding: "Conference Proceeding",
  instructional_material: "Instructional Material",
};

const IP_STATUS_LABELS: Record<string, string> = {
  disclosed: "Disclosed",
  filed: "Filed",
  registered: "Registered",
  adopted: "Adopted by Community",
};

const ETHICS_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  conditional: "Conditionally Approved",
  revision_required: "Revision Required",
  rejected: "Rejected",
};

const COI_STATUS_LABELS: Record<string, string> = {
  disclosed: "Disclosed",
  under_review: "Under Review",
  resolved: "Resolved",
};

const MISCONDUCT_STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  under_investigation: "Under Investigation",
  upheld: "Upheld",
  dismissed: "Dismissed",
};

const PLANNING_METRIC_LABELS: Record<PlanningMetric, string> = {
  completed_projects: "Completed Projects",
  publications: "Publications",
  ip_disclosures: "IP Disclosures",
  budget_utilization_pct: "Budget Utilization %",
};

const SECTIONS = [
  { key: "projects", label: "Projects" },
  { key: "budget", label: "Budget" },
  { key: "compliance", label: "Compliance" },
  { key: "outputs", label: "Outputs" },
  { key: "rei", label: "REI Thrust Alignment" },
  { key: "planning", label: "Planning Targets" },
  { key: "exports", label: "Data Exports" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const humanize = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const peso = (amount: number) => `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Single-measure count-by-category — one accent color throughout, since the
 * x-axis labels (not color) carry each category's identity here. */
function CountBarChart({
  data,
  labelFor = humanize,
  emptyMessage,
}: {
  data: Record<string, number>;
  labelFor?: (key: string) => string;
  emptyMessage: string;
}) {
  const rows = Object.entries(data)
    .map(([key, value]) => ({ key, label: labelFor(key), value }))
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) {
    return <EmptyState icon={<BarChart3 className="size-7" />} title={emptyMessage} />;
  }

  const config: ChartConfig = { value: { label: "Count", color: "var(--color-cyan)" } };
  const style: CSSProperties = { height: Math.max(140, rows.length * 40) };

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={style}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={150} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={24}>
          <LabelList dataKey="value" position="right" className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function UtilizationMeter({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <p className="text-sm text-muted-foreground">No certified budget yet.</p>;
  }
  const over = pct > 100;
  const clamped = Math.min(pct, 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Utilization</span>
        <span className={over ? "font-medium text-destructive" : "font-medium text-navy"}>{pct}%</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${over ? "bg-destructive" : "bg-cyan"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/** pct_of_target is the one measure that's comparable across metrics of
 * different units (counts vs. a percentage) — color marks status (reserved,
 * never decorative), and the value is always direct-labeled so color is
 * never the only signal. */
function PlanningComparisonChart({ rows }: { rows: PlanningTargetComparison[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={<Target className="size-7" />} title="No planning targets for this year" />;
  }

  const chartRows = rows.map((r) => {
    const pct = r.pct_of_target;
    const status = pct === null ? "unknown" : pct >= 100 ? "good" : pct >= 50 ? "warning" : "critical";
    const fill =
      status === "good"
        ? "var(--color-success)"
        : status === "warning"
          ? "var(--color-warning)"
          : status === "critical"
            ? "var(--color-destructive)"
            : "var(--color-muted-foreground)";
    return {
      key: `${r.metric}-${r.campus}-${r.target_year}`,
      label: `${PLANNING_METRIC_LABELS[r.metric]}${r.campus ? ` · ${r.campus}` : ""}`,
      value: pct ?? 0,
      fill,
    };
  });

  const config: ChartConfig = { value: { label: "% of Target" } };
  const style: CSSProperties = { height: Math.max(140, chartRows.length * 40) };

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={style}>
      <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={190} />
        <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => `${value}%`} />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
          <LabelList dataKey="value" position="right" formatter={(v) => `${v ?? 0}%`} className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function AnalyticsContent() {
  const { user } = useAuth();
  const canManageTargets = !!user?.role && MANAGE_TARGET_ROLE_CODES.includes(user.role.code);

  const [section, setSection] = useState<SectionKey>("projects");
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectDash, setProjectDash] = useState<ProjectDashboard | null>(null);
  const [projectCampus, setProjectCampus] = useState("");
  const [projectFundingType, setProjectFundingType] = useState("");
  const [isLoadingProjectDash, setIsLoadingProjectDash] = useState(false);

  const [budgetDash, setBudgetDash] = useState<BudgetDashboard | null>(null);
  const [budgetCampus, setBudgetCampus] = useState("");
  const [isLoadingBudgetDash, setIsLoadingBudgetDash] = useState(false);

  const [complianceDash, setComplianceDash] = useState<ComplianceDashboard | null>(null);
  const [isLoadingComplianceDash, setIsLoadingComplianceDash] = useState(false);

  const [outputDash, setOutputDash] = useState<OutputDashboard | null>(null);
  const [outputYear, setOutputYear] = useState("");
  const [isLoadingOutputDash, setIsLoadingOutputDash] = useState(false);

  const [reiDash, setReiDash] = useState<REIThrustAlignment | null>(null);
  const [isLoadingReiDash, setIsLoadingReiDash] = useState(false);

  const [planningTargets, setPlanningTargets] = useState<PlanningTarget[]>([]);
  const [planningComparison, setPlanningComparison] = useState<PlanningTargetComparison[]>([]);
  const [planningYear, setPlanningYear] = useState("");
  const [isLoadingPlanning, setIsLoadingPlanning] = useState(false);
  const emptyTargetForm = { metric: "", campus: "", target_year: String(new Date().getFullYear()), target_value: "" };
  const [targetForm, setTargetForm] = useState(emptyTargetForm);
  const [attemptedTarget, setAttemptedTarget] = useState(false);
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  const [exportProject, setExportProject] = useState("");
  const [appendixE, setAppendixE] = useState<AppendixEEntry[]>([]);
  const [appendixF, setAppendixF] = useState<AppendixFExport | null>(null);
  const [isLoadingEF, setIsLoadingEF] = useState(false);
  const [exportCampus, setExportCampus] = useState("");
  const [exportYear, setExportYear] = useState("");
  const [appendixG, setAppendixG] = useState<AppendixGExport | null>(null);
  const [isLoadingG, setIsLoadingG] = useState(false);

  const loadProjectDash = async () => {
    setIsLoadingProjectDash(true);
    try {
      setProjectDash(
        await dashboardApi.getProjectDashboard({
          campus: projectCampus || undefined,
          funding_type: projectFundingType || undefined,
        }),
      );
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the projects dashboard."));
    } finally {
      setIsLoadingProjectDash(false);
    }
  };

  const loadBudgetDash = async () => {
    setIsLoadingBudgetDash(true);
    try {
      setBudgetDash(await dashboardApi.getBudgetDashboard({ campus: budgetCampus || undefined }));
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the budget dashboard."));
    } finally {
      setIsLoadingBudgetDash(false);
    }
  };

  const loadComplianceDash = async () => {
    setIsLoadingComplianceDash(true);
    try {
      setComplianceDash(await dashboardApi.getComplianceDashboard());
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the compliance dashboard."));
    } finally {
      setIsLoadingComplianceDash(false);
    }
  };

  const loadOutputDash = async () => {
    setIsLoadingOutputDash(true);
    try {
      setOutputDash(await dashboardApi.getOutputDashboard({ year: outputYear ? Number(outputYear) : undefined }));
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the outputs dashboard."));
    } finally {
      setIsLoadingOutputDash(false);
    }
  };

  const loadReiDash = async () => {
    setIsLoadingReiDash(true);
    try {
      setReiDash(await dashboardApi.getREIThrustAlignment());
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the REI thrust alignment report."));
    } finally {
      setIsLoadingReiDash(false);
    }
  };

  const loadPlanning = async () => {
    setIsLoadingPlanning(true);
    try {
      const [targets, comparison] = await Promise.all([
        dashboardApi.getPlanningTargets(),
        dashboardApi.getPlanningTargetComparison({ year: planningYear ? Number(planningYear) : undefined }),
      ]);
      setPlanningTargets(targets);
      setPlanningComparison(comparison);
    } catch (err) {
      notify.error(errorMessage(err, "Could not load planning targets."));
    } finally {
      setIsLoadingPlanning(false);
    }
  };

  const loadAppendixEF = async (projectId: number) => {
    setIsLoadingEF(true);
    try {
      const [e, f] = await Promise.all([dashboardApi.getAppendixE(projectId), dashboardApi.getAppendixF(projectId)]);
      setAppendixE(e);
      setAppendixF(f);
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the export data."));
    } finally {
      setIsLoadingEF(false);
    }
  };

  const loadAppendixG = async () => {
    setIsLoadingG(true);
    try {
      setAppendixG(
        await dashboardApi.getAppendixG({
          campus: exportCampus || undefined,
          year: exportYear ? Number(exportYear) : undefined,
        }),
      );
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the accomplishment report summary."));
    } finally {
      setIsLoadingG(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setProjects(await researchApi.getProjects());
      } catch {
        notify.error("Could not load projects.");
      }
      await loadProjectDash();
      await loadAppendixG();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSection = async (key: SectionKey) => {
    setSection(key);
    if (key === "budget" && !budgetDash) await loadBudgetDash();
    if (key === "compliance" && !complianceDash) await loadComplianceDash();
    if (key === "outputs" && !outputDash) await loadOutputDash();
    if (key === "rei" && !reiDash) await loadReiDash();
    if (key === "planning" && planningTargets.length === 0) await loadPlanning();
  };

  const handleSelectExportProject = async (value: string) => {
    setExportProject(value);
    if (value) await loadAppendixEF(Number(value));
  };

  const handleAddTarget = async () => {
    setAttemptedTarget(true);
    if (!targetForm.metric || !targetForm.target_year || !targetForm.target_value) {
      notify.error("Metric, target year, and target value are required.");
      return;
    }
    setIsSavingTarget(true);
    try {
      await dashboardApi.createPlanningTarget({
        metric: targetForm.metric as PlanningMetric,
        campus: targetForm.campus || undefined,
        target_year: Number(targetForm.target_year),
        target_value: targetForm.target_value,
      });
      setAttemptedTarget(false);
      notify.success("Planning target set.");
      setTargetForm(emptyTargetForm);
      await loadPlanning();
    } catch (err) {
      notify.error(errorMessage(err, "Could not set this planning target."));
    } finally {
      setIsSavingTarget(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Analytics and Institutional Reporting"
        description="Institution-wide dashboards computed live from what RMIS already tracks, plus Planning Office target comparisons and the Appendix E/F/G data exports (structured data only — PDF/DOCX rendering is a later module)."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={section === s.key ? "default" : "outline"}
            onClick={() => handleSelectSection(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {section === "projects" && (
        <>
          <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
            <div className="w-48">
              <FieldLabel>Campus</FieldLabel>
              <Input
                value={projectCampus}
                onChange={(e) => setProjectCampus(e.target.value)}
                placeholder="All campuses"
              />
            </div>
            <div className="w-64">
              <FieldLabel>Funding Type</FieldLabel>
              <Select value={projectFundingType} onValueChange={setProjectFundingType}>
                <SelectTrigger>
                  <SelectValue placeholder="All funding types" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FUNDING_LABELS) as FundingType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {FUNDING_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={loadProjectDash} disabled={isLoadingProjectDash}>
              {isLoadingProjectDash ? "Loading..." : "Apply Filters"}
            </Button>
          </Card>

          {projectDash && (
            <div className="space-y-6">
              <StatTile label="Total Projects" value={String(projectDash.total_projects)} />
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">By Status</h3>
                  <CountBarChart data={projectDash.by_status} emptyMessage="No projects match these filters" />
                </Card>
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">By Funding Type</h3>
                  <CountBarChart
                    data={projectDash.by_funding_type}
                    labelFor={(k) => FUNDING_LABELS[k as FundingType] ?? humanize(k)}
                    emptyMessage="No projects match these filters"
                  />
                </Card>
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">By Campus</h3>
                  <CountBarChart data={projectDash.by_campus} emptyMessage="No campus recorded yet" />
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {section === "budget" && (
        <>
          <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
            <div className="w-48">
              <FieldLabel>Campus</FieldLabel>
              <Input value={budgetCampus} onChange={(e) => setBudgetCampus(e.target.value)} placeholder="All campuses" />
            </div>
            <Button size="sm" onClick={loadBudgetDash} disabled={isLoadingBudgetDash}>
              {isLoadingBudgetDash ? "Loading..." : "Apply Filters"}
            </Button>
          </Card>

          {budgetDash && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Projects with a Certified Budget" value={String(budgetDash.project_count)} />
              <StatTile label="Total Approved" value={peso(budgetDash.total_approved)} />
              <StatTile label="Total Actual (Disbursed)" value={peso(budgetDash.total_actual)} />
              <Card className="p-4 sm:col-span-2 lg:col-span-1">
                <UtilizationMeter pct={budgetDash.utilization_pct} />
              </Card>
            </div>
          )}
        </>
      )}

      {section === "compliance" && (
        <div className="space-y-6">
          {isLoadingComplianceDash || !complianceDash ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <StatTile label="AI Use Declarations" value={String(complianceDash.ai_use_declarations)} />
                <StatTile
                  label="Similarity Checks Within Threshold"
                  value={`${complianceDash.similarity_checks.within_threshold} / ${complianceDash.similarity_checks.total}`}
                  hint={`${complianceDash.similarity_checks.over_threshold} over threshold`}
                />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Ethics Reviews by Status</h3>
                  <CountBarChart
                    data={complianceDash.ethics_reviews_by_status}
                    labelFor={(k) => ETHICS_STATUS_LABELS[k] ?? humanize(k)}
                    emptyMessage="No ethics reviews recorded yet"
                  />
                </Card>
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">COI Disclosures by Status</h3>
                  <CountBarChart
                    data={complianceDash.coi_disclosures_by_status}
                    labelFor={(k) => COI_STATUS_LABELS[k] ?? humanize(k)}
                    emptyMessage="No COI disclosures recorded yet"
                  />
                </Card>
                <Card className="p-4 lg:col-span-2">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Misconduct Cases by Status</h3>
                  <CountBarChart
                    data={complianceDash.misconduct_cases_by_status}
                    labelFor={(k) => MISCONDUCT_STATUS_LABELS[k] ?? humanize(k)}
                    emptyMessage="No misconduct cases recorded"
                  />
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {section === "outputs" && (
        <>
          <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
            <div className="w-40">
              <FieldLabel>Year</FieldLabel>
              <Input
                type="number"
                value={outputYear}
                onChange={(e) => setOutputYear(e.target.value)}
                placeholder="All years"
              />
            </div>
            <Button size="sm" onClick={loadOutputDash} disabled={isLoadingOutputDash}>
              {isLoadingOutputDash ? "Loading..." : "Apply Filters"}
            </Button>
          </Card>

          {outputDash && (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-3">
                <StatTile label="Creative Works" value={String(outputDash.creative_works_count)} />
                <StatTile
                  label="Estimated Publication Incentives"
                  value={peso(outputDash.total_estimated_publication_incentive)}
                  hint="Per the Manual's Article V incentive tables"
                />
                <StatTile label="IP Records Incentive-Eligible" value={String(outputDash.ip_incentive_eligible_count)} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Publications by Type</h3>
                  <CountBarChart
                    data={outputDash.publications_by_type}
                    labelFor={(k) => PUBLICATION_TYPE_LABELS[k] ?? humanize(k)}
                    emptyMessage="No publications recorded yet"
                  />
                </Card>
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">IP Records by Status</h3>
                  <CountBarChart
                    data={outputDash.ip_records_by_status}
                    labelFor={(k) => IP_STATUS_LABELS[k] ?? humanize(k)}
                    emptyMessage="No IP records logged yet"
                  />
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {section === "rei" && (
        <div className="space-y-6">
          {isLoadingReiDash || !reiDash ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <StatTile label="Projects With No REI Thrust Recorded" value={String(reiDash.unaligned_count)} />
              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-navy">Projects by REI Thrust</h3>
                <CountBarChart data={reiDash.by_thrust} emptyMessage="No REI thrust recorded on any project yet" />
              </Card>
            </>
          )}
        </div>
      )}

      {section === "planning" && (
        <>
          {canManageTargets && (
            <Card className="mb-6 p-4">
              <h3 className="mb-3 text-sm font-semibold text-navy">Set a Planning Target</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <FieldLabel required>Metric</FieldLabel>
                  <Select value={targetForm.metric} onValueChange={(v) => setTargetForm((f) => ({ ...f, metric: v }))}>
                    <SelectTrigger aria-invalid={attemptedTarget && !targetForm.metric}>
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PLANNING_METRIC_LABELS) as PlanningMetric[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {PLANNING_METRIC_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Campus</FieldLabel>
                  <Input
                    value={targetForm.campus}
                    onChange={(e) => setTargetForm((f) => ({ ...f, campus: e.target.value }))}
                    placeholder="Institution-wide"
                  />
                </div>
                <div>
                  <FieldLabel required>Target Year</FieldLabel>
                  <Input
                    aria-invalid={attemptedTarget && !targetForm.target_year}
                    type="number"
                    value={targetForm.target_year}
                    onChange={(e) => setTargetForm((f) => ({ ...f, target_year: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel required>Target Value</FieldLabel>
                  <Input
                    aria-invalid={attemptedTarget && !targetForm.target_value}
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetForm.target_value}
                    onChange={(e) => setTargetForm((f) => ({ ...f, target_value: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={handleAddTarget} disabled={isSavingTarget}>
                  {isSavingTarget ? "Saving..." : "Set Target"}
                </Button>
              </div>
            </Card>
          )}

          <Card className="mb-6 overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-navy">All Planning Targets</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>Metric</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Target Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPlanning ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-4 text-center text-sm text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : planningTargets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0">
                      <EmptyState icon={<Target className="size-7" />} title="No planning targets set yet" />
                    </TableCell>
                  </TableRow>
                ) : (
                  planningTargets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{PLANNING_METRIC_LABELS[t.metric]}</TableCell>
                      <TableCell>{t.campus || "Institution-wide"}</TableCell>
                      <TableCell>{t.target_year}</TableCell>
                      <TableCell>{t.target_value}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-semibold text-navy">Actual vs. Target</h3>
              <div className="flex items-end gap-3">
                <div className="w-32">
                  <FieldLabel>Year</FieldLabel>
                  <Input type="number" value={planningYear} onChange={(e) => setPlanningYear(e.target.value)} placeholder="All years" />
                </div>
                <Button size="sm" variant="outline" onClick={loadPlanning} disabled={isLoadingPlanning}>
                  {isLoadingPlanning ? "Loading..." : "Apply"}
                </Button>
              </div>
            </div>
            <PlanningComparisonChart rows={planningComparison} />
          </Card>
        </>
      )}

      {section === "exports" && (
        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-navy">Appendix E / F — Per-Project Reports</h3>
            <div className="w-96">
              <FieldLabel>Project</FieldLabel>
              <Select value={exportProject} onValueChange={handleSelectExportProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 && <EmptyOption message="No projects registered yet" />}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.project_code} — {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {exportProject && !isLoadingEF && (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Appendix E — Midterm Progress Reports</h4>
                  {appendixE.length === 0 ? (
                    <EmptyState icon={<FileDown className="size-6" />} title="No midterm reports submitted for this project" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                          <TableHead>Year</TableHead>
                          <TableHead>Narrative</TableHead>
                          <TableHead>Expenditure Summary</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appendixE.map((r) => (
                          <TableRow key={r.project_year}>
                            <TableCell className="font-medium">Y{r.project_year}</TableCell>
                            <TableCell className="max-w-sm truncate">{r.narrative || "—"}</TableCell>
                            <TableCell className="max-w-sm truncate">{r.expenditure_summary || "—"}</TableCell>
                            <TableCell>{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Appendix F — Terminal Report</h4>
                  {!appendixF ? (
                    <EmptyState icon={<FileDown className="size-6" />} title="No terminal report submitted for this project" />
                  ) : (
                    <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground">Narrative</p>
                        <p className="mt-1 text-sm">{appendixF.narrative || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Submitted</p>
                        <p className="mt-1 text-sm">{new Date(appendixF.submitted_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Certification</p>
                        <Badge variant="outline" className="mt-1">
                          {appendixF.is_certified ? "Certified" : "Awaiting Certification"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-navy">Appendix G — R&D Accomplishment Report</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-48">
                <FieldLabel>Campus</FieldLabel>
                <Input value={exportCampus} onChange={(e) => setExportCampus(e.target.value)} placeholder="Institution-wide" />
              </div>
              <div className="w-40">
                <FieldLabel>Year</FieldLabel>
                <Input type="number" value={exportYear} onChange={(e) => setExportYear(e.target.value)} placeholder="All years" />
              </div>
              <Button size="sm" variant="outline" onClick={loadAppendixG} disabled={isLoadingG}>
                {isLoadingG ? "Loading..." : "Apply"}
              </Button>
            </div>
            {appendixG && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatTile label="Completed Projects" value={String(appendixG.completed_projects)} />
                <StatTile label="Publications" value={String(appendixG.publications)} />
                <StatTile label="IP Records" value={String(appendixG.ip_records)} />
                <StatTile label="Creative Works" value={String(appendixG.creative_works)} />
                <StatTile label="Monthly Reports Submitted" value={String(appendixG.monthly_reports_submitted)} />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Analytics">
        <AnalyticsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
