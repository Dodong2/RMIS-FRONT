import { useEffect, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { forecastingApi } from "../lib/forecastingApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type { ForecastRun, ForecastStatus } from "../types/forecasting";
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

const FORECAST_ROLE_CODES = ["system_admin", "drd", "vprei", "finance_budget"];
const FORECASTABLE_FUNDING_TYPES = ["institutional", "externally_funded"];

const STATUS_LABELS: Record<ForecastStatus, string> = {
  success: "Success",
  insufficient_data: "Insufficient Data",
  failed: "Failed",
};

const peso = (amount: string | number) =>
  `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const monthLabel = (period: string) =>
  new Date(period).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const chartConfig: ChartConfig = {
  predicted: { label: "Predicted Disbursement", color: "var(--color-cyan)" },
};

function EndLabel(props: Record<string, unknown> & { total: number }) {
  const { x, y, index, value, total } = props;
  if (
    typeof index !== "number" ||
    index !== total - 1 ||
    (typeof x !== "number" && typeof x !== "string") ||
    (typeof y !== "number" && typeof y !== "string")
  ) {
    return null;
  }
  return (
    <text x={x} y={Number(y) - 12} textAnchor="middle" className="fill-foreground text-xs font-medium">
      {peso(Number(value))}
    </text>
  );
}

function ForecastChart({ run }: { run: ForecastRun }) {
  const rows = run.forecasts.map((f) => ({
    period: monthLabel(f.period),
    predicted: Number(f.predicted_amount),
    lower: Number(f.lower_bound),
    upper: Number(f.upper_bound),
  }));

  if (rows.length === 0) {
    return <EmptyState icon={<TrendingUp className="size-7" />} title="No monthly forecast points" />;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <ComposedChart data={rows} margin={{ top: 24, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="period" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `₱${(v / 1000).toLocaleString()}K`}
          width={64}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (name === "predicted" ? peso(Number(value)) : undefined)}
            />
          }
        />
        <Area
          dataKey={(d: { lower: number; upper: number }) => [d.lower, d.upper]}
          stroke="none"
          fill="var(--color-predicted)"
          fillOpacity={0.12}
          isAnimationActive={false}
        />
        <Line
          dataKey="predicted"
          stroke="var(--color-predicted)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-predicted)" }}
          isAnimationActive={false}
          label={(props) => <EndLabel {...props} total={rows.length} />}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

function ForecastContent() {
  const { user } = useAuth();
  const canRunForecast = !!user?.role && FORECAST_ROLE_CODES.includes(user.role.code);

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState("");

  const [runs, setRuns] = useState<ForecastRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoadingProjects(true);
      try {
        const all = await researchApi.getProjects();
        setProjects(all.filter((p) => FORECASTABLE_FUNDING_TYPES.includes(p.funding_type)));
      } catch {
        notify.error("Could not load projects. Check your connection and refresh.");
      } finally {
        setIsLoadingProjects(false);
      }
    })();
  }, []);

  const loadRuns = async (projectId: number) => {
    setIsLoadingRuns(true);
    try {
      const data = await forecastingApi.getRuns({ project: projectId });
      setRuns(data);
      setSelectedRunId(data[0]?.id ?? null);
    } catch (err) {
      notify.error(errorMessage(err, "Could not load forecast history."));
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const handleSelectProject = async (value: string) => {
    setSelectedProject(value);
    await loadRuns(Number(value));
  };

  const handleRunForecast = async () => {
    setIsRunning(true);
    try {
      const run = await forecastingApi.triggerRun(Number(selectedProject));
      setRuns((prev) => [run, ...prev]);
      setSelectedRunId(run.id);
      if (run.status === "success") {
        notify.success(run.is_overrun_risk ? "Forecast complete — overrun risk flagged." : "Forecast complete.");
      } else if (run.status === "insufficient_data") {
        notify.warning(run.error_message);
      } else {
        notify.error(run.error_message || "The forecast fit failed.");
      }
    } catch (err) {
      notify.error(errorMessage(err, "Could not run a forecast for this project."));
    } finally {
      setIsRunning(false);
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  return (
    <div>
      <PageHeader
        title="Budget Forecast"
        description="ARIMA-based 3-month disbursement forecast against a project's certified budget. Institutional and externally-funded projects only (Core-Funded is out of this module's scope) — needs at least 6 months of disbursement history to fit a model."
      />

      <Card className="mb-6 flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="sm:w-96">
          <FieldLabel required>Project</FieldLabel>
          <Select value={selectedProject} onValueChange={handleSelectProject} disabled={isLoadingProjects}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.length === 0 && (
                <EmptyOption message="No institutional or externally-funded projects registered yet" />
              )}
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.project_code} — {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canRunForecast && selectedProject && (
          <Button size="sm" onClick={handleRunForecast} disabled={isRunning}>
            <TrendingUp className="size-4" />
            {isRunning ? "Running..." : "Run New Forecast"}
          </Button>
        )}
      </Card>

      {!selectedProject ? (
        <EmptyState
          icon={<TrendingUp className="size-7" />}
          title="Select a project"
          description="Choose an institutional or externally-funded project above to view or run its budget forecast."
        />
      ) : isLoadingRuns ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="size-7" />}
          title="No forecasts run for this project yet"
          description={canRunForecast ? "Run one above." : "Only DRD, VPREI, Budget Officer, or System Admin can run one."}
        />
      ) : (
        <div className="space-y-6">
          {selectedRun && (
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-navy">
                    Run from {new Date(selectedRun.run_at).toLocaleString()}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedRun.months_of_history} months of history
                    {selectedRun.arima_order && ` · ARIMA order ${selectedRun.arima_order}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRun.is_overrun_risk && (
                    <Badge variant="destructive">
                      <AlertTriangle className="size-3" />
                      Overrun Risk
                    </Badge>
                  )}
                  <Badge variant={selectedRun.status === "success" ? "outline" : "secondary"}>
                    {STATUS_LABELS[selectedRun.status]}
                  </Badge>
                </div>
              </div>

              {selectedRun.status !== "success" ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {selectedRun.error_message || "This run did not produce a forecast."}
                </p>
              ) : (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Approved Budget</p>
                      <p className="mt-1 text-sm font-medium text-navy">
                        {selectedRun.approved_budget_total ? peso(selectedRun.approved_budget_total) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Actual to Date</p>
                      <p className="mt-1 text-sm font-medium text-navy">
                        {selectedRun.actual_to_date ? peso(selectedRun.actual_to_date) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Projected at Horizon</p>
                      <p className={`mt-1 text-sm font-medium ${selectedRun.is_overrun_risk ? "text-destructive" : "text-navy"}`}>
                        {selectedRun.projected_total_at_horizon ? peso(selectedRun.projected_total_at_horizon) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">MAE</p>
                      <p className="mt-1 text-sm font-medium text-navy">
                        {selectedRun.mae ? peso(selectedRun.mae) : "Not backtested"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RMSE</p>
                      <p className="mt-1 text-sm font-medium text-navy">
                        {selectedRun.rmse ? peso(selectedRun.rmse) : "Not backtested"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">MAPE</p>
                      <p className="mt-1 text-sm font-medium text-navy">
                        {selectedRun.mape ? `${selectedRun.mape}%` : "Not backtested"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ForecastChart run={selectedRun} />
                  </div>
                </>
              )}
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-navy">Run History</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>History</TableHead>
                  <TableHead>Overrun Risk</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} className={r.id === selectedRunId ? "bg-secondary/40" : undefined}>
                    <TableCell className="font-medium">{new Date(r.run_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "success" ? "outline" : "secondary"}>{STATUS_LABELS[r.status]}</Badge>
                    </TableCell>
                    <TableCell>{r.months_of_history} mo.</TableCell>
                    <TableCell>
                      {r.status === "success" ? (
                        r.is_overrun_risk ? (
                          <Badge variant="destructive">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedRunId(r.id)} disabled={r.id === selectedRunId}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function BudgetForecastPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Budget Forecast">
        <ForecastContent />
      </AppShell>
    </ProtectedRoute>
  );
}
