import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { reportsApi, reportErrorMessage } from "../lib/reportsApi";
import { researchApi } from "../lib/researchApi";
import type { GeneratedReportLog, ReportFormat, ReportType } from "../types/reports";
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

const REPORT_LOG_VIEW_ROLE_CODES = ["system_admin", "riuh", "drd", "vprei"];

const FUNDING_TYPE_LABELS: Record<string, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word (DOCX)" },
];

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  appendix_e: "Appendix E — Midterm Progress Report",
  appendix_f: "Appendix F — Terminal Report",
  appendix_g: "Appendix G — R&D Accomplishment Report",
  project_list: "Custom Filtered Project List",
  financial: "Financial / Procurement Report",
  compliance: "Compliance Report",
  personnel: "Personnel and Task Report",
  outputs: "Research Outputs (6Ps) Report",
};

const SECTIONS = [
  { key: "appendix_e", label: "Appendix E" },
  { key: "appendix_f", label: "Appendix F" },
  { key: "appendix_g", label: "Appendix G" },
  { key: "project_list", label: "Project List" },
  { key: "log", label: "Generation Log" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function FormatSelect({ value, onChange }: { value: ReportFormat; onChange: (v: ReportFormat) => void }) {
  return (
    <div className="w-48">
      <FieldLabel required>Format</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as ReportFormat)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_OPTIONS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProjectAppendixTab({
  kind,
  projects,
  isLoadingProjects,
}: {
  kind: "appendix_e" | "appendix_f";
  projects: Project[];
  isLoadingProjects: boolean;
}) {
  const [projectId, setProjectId] = useState("");
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!projectId) return;
    setIsDownloading(true);
    try {
      if (kind === "appendix_e") {
        await reportsApi.downloadAppendixE(Number(projectId), format);
      } else {
        await reportsApi.downloadAppendixF(Number(projectId), format);
      }
      notify.success("Report downloaded.");
    } catch (err) {
      notify.error(await reportErrorMessage(err, "Could not generate this report."));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-navy">{REPORT_TYPE_LABELS[kind]}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-80">
          <FieldLabel required>Project</FieldLabel>
          <Select value={projectId} onValueChange={setProjectId} disabled={isLoadingProjects}>
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
        <FormatSelect value={format} onChange={setFormat} />
        <Button size="sm" onClick={handleDownload} disabled={!projectId || isDownloading}>
          <Download className="size-4" />
          {isDownloading ? "Generating..." : "Download"}
        </Button>
      </div>
      {kind === "appendix_f" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Fails with a 404 if this project hasn't submitted a terminal report yet.
        </p>
      )}
    </Card>
  );
}

function AppendixGTab() {
  const [campus, setCampus] = useState("");
  const [year, setYear] = useState("");
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await reportsApi.downloadAppendixG({ campus: campus.trim() || undefined, year: year.trim() || undefined, file_format: format });
      notify.success("Report downloaded.");
    } catch (err) {
      notify.error(await reportErrorMessage(err, "Could not generate this report."));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-navy">{REPORT_TYPE_LABELS.appendix_g}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <FieldLabel>Campus</FieldLabel>
          <Input value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="Institution-wide" />
        </div>
        <div className="w-40">
          <FieldLabel>Year</FieldLabel>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="All years" />
        </div>
        <FormatSelect value={format} onChange={setFormat} />
        <Button size="sm" onClick={handleDownload} disabled={isDownloading}>
          <Download className="size-4" />
          {isDownloading ? "Generating..." : "Download"}
        </Button>
      </div>
    </Card>
  );
}

function ProjectListTab() {
  const [campus, setCampus] = useState("");
  const [fundingType, setFundingType] = useState("");
  const [status, setStatus] = useState("");
  const [reiThrust, setReiThrust] = useState("");
  const [year, setYear] = useState("");
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await reportsApi.downloadProjectList({
        campus: campus.trim() || undefined,
        funding_type: fundingType || undefined,
        status: status || undefined,
        rei_thrust: reiThrust.trim() || undefined,
        year: year.trim() || undefined,
        file_format: format,
      });
      notify.success("Report downloaded.");
    } catch (err) {
      notify.error(await reportErrorMessage(err, "Could not generate this report."));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-navy">{REPORT_TYPE_LABELS.project_list}</h3>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <FieldLabel>Campus</FieldLabel>
          <Input value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="All campuses" />
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
          <FieldLabel>Status</FieldLabel>
          <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>REI Thrust</FieldLabel>
          <Input value={reiThrust} onChange={(e) => setReiThrust(e.target.value)} placeholder="All thrusts" />
        </div>
        <div>
          <FieldLabel>Start Year</FieldLabel>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="All years" />
        </div>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <FormatSelect value={format} onChange={setFormat} />
        <Button size="sm" onClick={handleDownload} disabled={isDownloading}>
          <Download className="size-4" />
          {isDownloading ? "Generating..." : "Download"}
        </Button>
      </div>
    </Card>
  );
}

function GenerationLogTab() {
  const [logs, setLogs] = useState<GeneratedReportLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        setLogs(await reportsApi.getLogs());
      } catch {
        notify.error("Could not load the report generation log.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (logs.length === 0) return <EmptyState icon={<FileText className="size-7" />} title="No reports generated yet" />;

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/60 hover:bg-secondary/60">
            <TableHead>Report</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Generated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{REPORT_TYPE_LABELS[l.report_type]}</TableCell>
              <TableCell>
                <Badge variant="outline">{l.format.toUpperCase()}</Badge>
              </TableCell>
              <TableCell>{new Date(l.generated_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ReportsContent() {
  const { user } = useAuth();
  const canViewLog = !!user?.role && REPORT_LOG_VIEW_ROLE_CODES.includes(user.role.code);

  const [section, setSection] = useState<SectionKey>("appendix_e");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

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

  const visibleSections = SECTIONS.filter((s) => s.key !== "log" || canViewLog);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate the Manual's Appendix E/F/G exports and a custom filtered project list, in CSV, Excel, PDF, or Word. Each download is logged with who generated it and when."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {visibleSections.map((s) => (
          <Button key={s.key} size="sm" variant={section === s.key ? "default" : "outline"} onClick={() => setSection(s.key)}>
            {s.label}
          </Button>
        ))}
      </div>

      {section === "appendix_e" && (
        <ProjectAppendixTab kind="appendix_e" projects={projects} isLoadingProjects={isLoadingProjects} />
      )}
      {section === "appendix_f" && (
        <ProjectAppendixTab kind="appendix_f" projects={projects} isLoadingProjects={isLoadingProjects} />
      )}
      {section === "appendix_g" && <AppendixGTab />}
      {section === "project_list" && <ProjectListTab />}
      {section === "log" && canViewLog && <GenerationLogTab />}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Reports">
        <ReportsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
