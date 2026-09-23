import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { riskApi } from "../lib/riskApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type {
  ProjectRiskFlags,
  ProjectRiskStatus,
  RiskDashboard,
  RiskLevel,
} from "../types/risk";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
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

const FUNDING_TYPE_LABELS: Record<string, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const RISK_LEVEL_CLASS: Record<RiskLevel, string> = {
  low: "text-success",
  medium: "text-warning",
  high: "text-destructive",
};

const FLAG_LABELS: Record<keyof ProjectRiskFlags, string> = {
  non_submission_warning: "Non-Submission Warning",
  budget_underutilization: "Budget Underutilization",
  deliverable_slippage: "Deliverable Slippage",
  personnel_change_frequency: "Personnel Change Frequency",
  forecast_overrun: "Forecast Overrun Risk",
};

const FLAG_ORDER = Object.keys(FLAG_LABELS) as (keyof ProjectRiskFlags)[];

const ESCALATION_LABELS: Record<string, string> = {
  on_track: "On Track",
  notify_dean_riuh: "Notify Dean/RIUH",
  terminate_recommended: "Termination Recommended",
  unknown: "Unknown",
};

function flagDetail(key: keyof ProjectRiskFlags, flags: ProjectRiskFlags): string {
  switch (key) {
    case "non_submission_warning": {
      const f = flags.non_submission_warning;
      return `${ESCALATION_LABELS[f.status]}${f.months_since_last_report !== null ? ` · ${f.months_since_last_report} mo. since last report` : ""}`;
    }
    case "budget_underutilization": {
      const f = flags.budget_underutilization;
      return f.budget_used_pct === null ? "No certified budget yet" : `${f.budget_used_pct}% of budget used`;
    }
    case "deliverable_slippage": {
      const f = flags.deliverable_slippage;
      return `${f.overdue_count} overdue milestone${f.overdue_count === 1 ? "" : "s"}${f.deliverables_pct !== null ? ` · ${f.deliverables_pct}% complete` : ""}`;
    }
    case "personnel_change_frequency": {
      const f = flags.personnel_change_frequency;
      return `${f.changes_in_window} change${f.changes_in_window === 1 ? "" : "s"} in the last ${f.window_months} months`;
    }
    case "forecast_overrun": {
      const f = flags.forecast_overrun;
      if (!f.has_forecast) return "No forecast run yet";
      return f.is_overrun_risk ? "Overrun risk flagged" : "No overrun risk";
    }
  }
}

function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge variant={level === "high" ? "destructive" : "outline"} className={level !== "high" ? RISK_LEVEL_CLASS[level] : undefined}>
      {RISK_LEVEL_LABELS[level]}
    </Badge>
  );
}

function FlagBadges({ flags }: { flags: ProjectRiskFlags }) {
  const active = FLAG_ORDER.filter((key) => flags[key].flagged);
  if (active.length === 0) {
    return <span className="text-xs text-muted-foreground">No flags</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((key) => (
        <Badge key={key} variant="destructive" title={flagDetail(key, flags)}>
          {FLAG_LABELS[key]}
        </Badge>
      ))}
    </div>
  );
}

function StatTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${className ?? "text-navy"}`}>{value}</p>
    </Card>
  );
}

const SECTIONS = [
  { key: "overview", label: "Institution Overview" },
  { key: "project", label: "Project Risk Status" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function OverviewTab() {
  const [campus, setCampus] = useState("");
  const [fundingType, setFundingType] = useState("");
  const [dashboard, setDashboard] = useState<RiskDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async (params: { campus?: string; funding_type?: string }) => {
    setIsLoading(true);
    try {
      setDashboard(await riskApi.getDashboard(params));
    } catch (err) {
      notify.error(errorMessage(err, "Could not load the risk dashboard."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load({});
    })();
  }, []);

  const applyFilters = () => load({ campus: campus.trim() || undefined, funding_type: fundingType || undefined });

  return (
    <div>
      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="w-56">
          <FieldLabel>Campus</FieldLabel>
          <Input value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="All campuses" />
        </div>
        <div className="w-64">
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
        <Button size="sm" onClick={applyFilters} disabled={isLoading}>
          Apply
        </Button>
      </Card>

      {isLoading || !dashboard ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label="Active Projects in Scope" value={dashboard.total_projects} />
            <StatTile label="Low Risk" value={dashboard.by_risk_level.low} className="text-success" />
            <StatTile label="Medium Risk" value={dashboard.by_risk_level.medium} className="text-warning" />
            <StatTile label="High Risk" value={dashboard.by_risk_level.high} className="text-destructive" />
          </div>

          {dashboard.flagged_projects.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="size-7" />} title="No flagged projects in scope" />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border p-4">
                <h3 className="text-sm font-semibold text-navy">Flagged Projects</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                    <TableHead>Project</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.flagged_projects.map((p) => (
                    <TableRow key={p.project}>
                      <TableCell className="font-medium">{p.project_code}</TableCell>
                      <TableCell>
                        <RiskLevelBadge level={p.risk_level} />
                      </TableCell>
                      <TableCell>
                        <FlagBadges flags={p.flags} />
                      </TableCell>
                      <TableCell className="text-right">{p.flagged_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectTab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState("");
  const [status, setStatus] = useState<ProjectRiskStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoadingProjects(true);
      try {
        setProjects(await researchApi.getProjects());
      } catch {
        notify.error("Could not load projects. Check your connection and refresh.");
      } finally {
        setIsLoadingProjects(false);
      }
    })();
  }, []);

  const handleSelectProject = async (value: string) => {
    setSelectedProject(value);
    setIsLoadingStatus(true);
    try {
      setStatus(await riskApi.getProjectStatus(Number(value)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not load this project's risk status."));
    } finally {
      setIsLoadingStatus(false);
    }
  };

  return (
    <div>
      <Card className="mb-6 p-4 sm:w-96">
        <FieldLabel required>Project</FieldLabel>
        <Select value={selectedProject} onValueChange={handleSelectProject} disabled={isLoadingProjects}>
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
      </Card>

      {!selectedProject ? (
        <EmptyState
          icon={<AlertTriangle className="size-7" />}
          title="Select a project"
          description="Choose a project above to view its five early-warning risk flags."
        />
      ) : isLoadingStatus || !status ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-navy">{status.project_code}</h3>
            <RiskLevelBadge level={status.risk_level} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FLAG_ORDER.map((key) => (
              <div key={key} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-navy">{FLAG_LABELS[key]}</span>
                  <Badge variant={status.flags[key].flagged ? "destructive" : "outline"}>
                    {status.flags[key].flagged ? "Flagged" : "Clear"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{flagDetail(key, status.flags)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RisksContent() {
  const [section, setSection] = useState<SectionKey>("overview");

  return (
    <div>
      <PageHeader
        title="Risks"
        description="Five live early-warning flags per active project — non-submission, budget underutilization, deliverable slippage, personnel churn, and forecast overrun risk. Computed on read, not stored."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button key={s.key} size="sm" variant={section === s.key ? "default" : "outline"} onClick={() => setSection(s.key)}>
            {s.label}
          </Button>
        ))}
      </div>

      {section === "overview" ? <OverviewTab /> : <ProjectTab />}
    </div>
  );
}

export default function RisksPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Risks">
        <RisksContent />
      </AppShell>
    </ProtectedRoute>
  );
}
