import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { Activity, CalendarClock, ClipboardCheck, FileCheck2, RefreshCw } from "lucide-react";
import { monitoringApi } from "../lib/monitoringApi";
import { researchApi } from "../lib/researchApi";
import { documentApi } from "../lib/documentApi";
import { errorMessage } from "../lib/errorMessage";
import type {
  EvaluationOutcome,
  MidtermReport,
  MonthlyProgressReport,
  ProjectEvaluation,
  ProjectMonitoringStatus,
  RenewalApplication,
  RenewalStatus,
  TerminalReport,
} from "../types/monitoring";
import type { Project } from "../types/research";
import type { ProjectDocument } from "../types/document";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { EmptyOption } from "../components/common/EmptyOption";
import { FieldLabel } from "../components/common/FieldLabel";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
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

const REPORT_ROLE_CODES = ["system_admin", "riuh", "project_leader", "study_leader", "project_staff"];
const TERMINAL_CERTIFY_ROLE_CODES = ["system_admin", "riuh"];
const EVALUATION_PANEL_ROLE_CODES = ["system_admin", "vprei", "drd", "crc_chair"];
const RENEWAL_DECISION_ROLE_CODES = ["system_admin", "riuh", "drd", "vprei"];

const ESCALATION_LABELS: Record<string, string> = {
  unknown: "Unknown",
  on_track: "On Track",
  notify_dean_riuh: "Notify Dean/RIUH",
  terminate_recommended: "Termination Recommended",
};

const OUTCOME_LABELS: Record<EvaluationOutcome, string> = {
  pending: "Pending",
  passed: "Passed",
  conditional: "Conditional",
  failed: "Failed",
};

const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

const SECTIONS = [
  { key: "status", label: "Status" },
  { key: "monthly", label: "Monthly Reports" },
  { key: "midterm", label: "Midterm Reports" },
  { key: "terminal", label: "Terminal Report" },
  { key: "evaluations", label: "Evaluations" },
  { key: "renewal", label: "Renewal Applications" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const today = () => new Date().toLocaleDateString("en-CA");
const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

function Textarea({
  value,
  onChange,
  ...props
}: { value: string; onChange: (value: string) => void } & Omit<
  ComponentProps<"textarea">,
  "value" | "onChange"
>) {
  return (
    <textarea
      className="min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
}

function DocumentPicker({
  value,
  onChange,
  documents,
}: {
  value: string;
  onChange: (value: string) => void;
  documents: ProjectDocument[];
}) {
  return (
    <div>
      <FieldLabel>Supporting Document</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          {documents.length === 0 && <EmptyOption message="No documents uploaded for this project yet" />}
          {documents.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              {d.file_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MonitoringContent() {
  const { user } = useAuth();
  const canReport = !!user?.role && REPORT_ROLE_CODES.includes(user.role.code);
  const canCertifyTerminal = !!user?.role && TERMINAL_CERTIFY_ROLE_CODES.includes(user.role.code);
  const canPanelEvaluate = !!user?.role && EVALUATION_PANEL_ROLE_CODES.includes(user.role.code);
  const canDecideRenewal = !!user?.role && RENEWAL_DECISION_ROLE_CODES.includes(user.role.code);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [section, setSection] = useState<SectionKey>("status");
  const [isLoadingSection, setIsLoadingSection] = useState(false);

  const [status, setStatus] = useState<ProjectMonitoringStatus | null>(null);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyProgressReport[]>([]);
  const [midtermReports, setMidtermReports] = useState<MidtermReport[]>([]);
  const [terminalReport, setTerminalReport] = useState<TerminalReport | null>(null);
  const [evaluations, setEvaluations] = useState<ProjectEvaluation[]>([]);
  const [renewalApplications, setRenewalApplications] = useState<RenewalApplication[]>([]);

  const emptyMonthlyForm = { period: today().slice(0, 7), narrative: "", document: "" };
  const [monthlyForm, setMonthlyForm] = useState(emptyMonthlyForm);
  const [attemptedMonthly, setAttemptedMonthly] = useState(false);
  const [isSavingMonthly, setIsSavingMonthly] = useState(false);

  const emptyMidtermForm = { project_year: "1", narrative: "", expenditure_summary: "", document: "" };
  const [midtermForm, setMidtermForm] = useState(emptyMidtermForm);
  const [attemptedMidterm, setAttemptedMidterm] = useState(false);
  const [isSavingMidterm, setIsSavingMidterm] = useState(false);

  const emptyTerminalForm = { narrative: "", document: "" };
  const [terminalForm, setTerminalForm] = useState(emptyTerminalForm);
  const [isSavingTerminal, setIsSavingTerminal] = useState(false);
  const [isCertifying, setIsCertifying] = useState(false);

  const emptyEvalForm = { project_year: "1", scheduled_date: today(), panel_members: "" };
  const [evalForm, setEvalForm] = useState(emptyEvalForm);
  const [attemptedEval, setAttemptedEval] = useState(false);
  const [isSavingEval, setIsSavingEval] = useState(false);
  const [evalDrafts, setEvalDrafts] = useState<Record<number, { outcome: EvaluationOutcome; remarks: string }>>({});
  const [savingEvalId, setSavingEvalId] = useState<number | null>(null);

  const emptyRenewalForm = { application_year: "1", underspend_justification: "" };
  const [renewalForm, setRenewalForm] = useState(emptyRenewalForm);
  const [isSavingRenewal, setIsSavingRenewal] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);

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

  const loadSection = async (projectId: number, key: SectionKey) => {
    setIsLoadingSection(true);
    try {
      if (key === "status") setStatus(await monitoringApi.getProjectStatus(projectId));
      if (key === "monthly") setMonthlyReports(await monitoringApi.getMonthlyReports({ project: projectId }));
      if (key === "midterm") setMidtermReports(await monitoringApi.getMidtermReports({ project: projectId }));
      if (key === "terminal") {
        const reports = await monitoringApi.getTerminalReports({ project: projectId });
        setTerminalReport(reports[0] ?? null);
      }
      if (key === "evaluations") setEvaluations(await monitoringApi.getEvaluations({ project: projectId }));
      if (key === "renewal") {
        setRenewalApplications(await monitoringApi.getRenewalApplications({ project: projectId }));
      }
    } catch {
      notify.error("Could not load records for this section.");
    } finally {
      setIsLoadingSection(false);
    }
  };

  const handleSelectProject = async (value: string) => {
    setSelectedProject(value);
    try {
      setDocuments(await documentApi.getDocuments({ project: Number(value) }));
    } catch {
      setDocuments([]);
    }
    await loadSection(Number(value), section);
  };

  const handleSelectSection = async (key: SectionKey) => {
    setSection(key);
    if (selectedProject) await loadSection(Number(selectedProject), key);
  };

  const handleAddMonthly = async () => {
    setAttemptedMonthly(true);
    if (!monthlyForm.period) {
      notify.error("Period is required.");
      return;
    }
    setIsSavingMonthly(true);
    try {
      await monitoringApi.createMonthlyReport({
        project: Number(selectedProject),
        period: `${monthlyForm.period}-01`,
        narrative: monthlyForm.narrative || undefined,
        document: monthlyForm.document ? Number(monthlyForm.document) : null,
      });
      setAttemptedMonthly(false);
      notify.success("Monthly progress report submitted.");
      setMonthlyForm(emptyMonthlyForm);
      await loadSection(Number(selectedProject), "monthly");
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit this report."));
    } finally {
      setIsSavingMonthly(false);
    }
  };

  const handleAddMidterm = async () => {
    setAttemptedMidterm(true);
    if (!midtermForm.project_year) {
      notify.error("Project year is required.");
      return;
    }
    setIsSavingMidterm(true);
    try {
      await monitoringApi.createMidtermReport({
        project: Number(selectedProject),
        project_year: Number(midtermForm.project_year),
        narrative: midtermForm.narrative || undefined,
        expenditure_summary: midtermForm.expenditure_summary || undefined,
        document: midtermForm.document ? Number(midtermForm.document) : null,
      });
      setAttemptedMidterm(false);
      notify.success("Midterm report submitted.");
      setMidtermForm(emptyMidtermForm);
      await loadSection(Number(selectedProject), "midterm");
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit this report."));
    } finally {
      setIsSavingMidterm(false);
    }
  };

  const handleAddTerminal = async () => {
    setIsSavingTerminal(true);
    try {
      const report = await monitoringApi.createTerminalReport({
        project: Number(selectedProject),
        narrative: terminalForm.narrative || undefined,
        document: terminalForm.document ? Number(terminalForm.document) : null,
      });
      notify.success("Terminal report submitted.");
      setTerminalForm(emptyTerminalForm);
      setTerminalReport(report);
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit the terminal report."));
    } finally {
      setIsSavingTerminal(false);
    }
  };

  const handleCertifyTerminal = async () => {
    if (!terminalReport) return;
    setIsCertifying(true);
    try {
      setTerminalReport(await monitoringApi.certifyTerminalReport(terminalReport.id));
      notify.success("Terminal report certified.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not certify this report."));
    } finally {
      setIsCertifying(false);
    }
  };

  const handleAddEvaluation = async () => {
    setAttemptedEval(true);
    if (!evalForm.project_year || !evalForm.scheduled_date) {
      notify.error("Project year and scheduled date are required.");
      return;
    }
    setIsSavingEval(true);
    try {
      await monitoringApi.createEvaluation({
        project: Number(selectedProject),
        project_year: Number(evalForm.project_year),
        scheduled_date: evalForm.scheduled_date,
        panel_members: evalForm.panel_members || undefined,
      });
      setAttemptedEval(false);
      notify.success("Evaluation scheduled.");
      setEvalForm(emptyEvalForm);
      await loadSection(Number(selectedProject), "evaluations");
    } catch (err) {
      notify.error(errorMessage(err, "Could not schedule this evaluation."));
    } finally {
      setIsSavingEval(false);
    }
  };

  const evalDraft = (evaluation: ProjectEvaluation) =>
    evalDrafts[evaluation.id] ?? { outcome: evaluation.outcome, remarks: evaluation.remarks };

  const handleSaveEvaluation = async (evaluation: ProjectEvaluation) => {
    const draft = evalDraft(evaluation);
    setSavingEvalId(evaluation.id);
    try {
      const updated = await monitoringApi.updateEvaluation(evaluation.id, {
        outcome: draft.outcome,
        remarks: draft.remarks,
      });
      setEvaluations((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEvalDrafts((prev) => {
        const next = { ...prev };
        delete next[evaluation.id];
        return next;
      });
      notify.success("Evaluation outcome recorded.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not record the outcome."));
    } finally {
      setSavingEvalId(null);
    }
  };

  const handleAddRenewal = async () => {
    if (!renewalForm.application_year) {
      notify.error("Application year is required.");
      return;
    }
    setIsSavingRenewal(true);
    try {
      await monitoringApi.createRenewalApplication({
        project: Number(selectedProject),
        application_year: Number(renewalForm.application_year),
        underspend_justification: renewalForm.underspend_justification || undefined,
      });
      notify.success("Renewal application submitted.");
      setRenewalForm(emptyRenewalForm);
      await loadSection(Number(selectedProject), "renewal");
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit this renewal application."));
    } finally {
      setIsSavingRenewal(false);
    }
  };

  const handleDecideRenewal = async (application: RenewalApplication, decision: RenewalStatus) => {
    setDecidingId(application.id);
    try {
      const updated = await monitoringApi.decideRenewalApplication(application.id, decision);
      setRenewalApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      notify.error(errorMessage(err, "Could not record the decision."));
    } finally {
      setDecidingId(null);
    }
  };

  const escalationBadgeClass =
    status?.escalation_status === "notify_dean_riuh" ? "text-destructive" : "";

  return (
    <div>
      <PageHeader
        title="Project Monitoring and Reporting"
        description="Monthly/midterm/terminal reports, annual evaluations, and renewal applications, with the renewal-year continuation rule under the Manual computed live."
      />

      <Card className="mb-6 p-4">
        <FieldLabel required>Project</FieldLabel>
        <Select value={selectedProject} onValueChange={handleSelectProject} disabled={isLoadingProjects}>
          <SelectTrigger className="sm:w-96">
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

      {!selectedProject ? (
        <EmptyState
          icon={<Activity className="size-7" />}
          title="Select a project"
          description="Choose a project above to view or record its monitoring records."
        />
      ) : (
        <>
          {section === "status" && (
            <Card className="p-4">
              {isLoadingSection || !status ? (
                <p className="text-sm text-muted-foreground">Loading status…</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Escalation Status</p>
                    <Badge
                      variant={status.escalation_status === "terminate_recommended" ? "destructive" : "outline"}
                      className={`mt-1 ${escalationBadgeClass}`}
                    >
                      {ESCALATION_LABELS[status.escalation_status]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Months Since Last Monthly Report</p>
                    <p className="mt-1 text-sm font-medium text-navy">
                      {status.months_since_last_report ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Budget Used</p>
                    <p className="mt-1 text-sm font-medium text-navy">{pct(status.budget_used_pct)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deliverables Done</p>
                    <p className="mt-1 text-sm font-medium text-navy">{pct(status.deliverables_pct)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Midterm Reports Submitted</p>
                    <p className="mt-1 text-sm font-medium text-navy">
                      {status.midterm_submitted_years.length > 0
                        ? status.midterm_submitted_years.sort((a, b) => a - b).join(", ")
                        : "None yet"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Terminal Report</p>
                    <p className="mt-1 text-sm font-medium text-navy">
                      {status.terminal_submitted ? "Submitted" : "Not submitted"}
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadSection(Number(selectedProject), "status")}
                  disabled={isLoadingSection}
                >
                  <RefreshCw className="size-4" />
                  Refresh
                </Button>
              </div>
            </Card>
          )}

          {section === "monthly" && (
            <>
              {canReport && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Submit a Monthly Progress Report</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel required>Period</FieldLabel>
                      <Input
                        aria-invalid={attemptedMonthly && !monthlyForm.period}
                        type="month"
                        value={monthlyForm.period}
                        onChange={(e) => setMonthlyForm((f) => ({ ...f, period: e.target.value }))}
                      />
                    </div>
                    <DocumentPicker
                      value={monthlyForm.document}
                      onChange={(v) => setMonthlyForm((f) => ({ ...f, document: v }))}
                      documents={documents}
                    />
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel>Narrative</FieldLabel>
                      <Textarea
                        value={monthlyForm.narrative}
                        onChange={(v) => setMonthlyForm((f) => ({ ...f, narrative: v }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddMonthly} disabled={isSavingMonthly}>
                      {isSavingMonthly ? "Submitting..." : "Submit Report"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Period</TableHead>
                      <TableHead>Narrative</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={4} />
                    ) : monthlyReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <EmptyState icon={<CalendarClock className="size-7" />} title="No monthly reports yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthlyReports.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.period.slice(0, 7)}</TableCell>
                          <TableCell className="max-w-sm truncate">{r.narrative || "—"}</TableCell>
                          <TableCell>
                            {r.document ? documents.find((d) => d.id === r.document)?.file_name ?? `#${r.document}` : "—"}
                          </TableCell>
                          <TableCell>{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "midterm" && (
            <>
              {canReport && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Submit a Midterm Report (Appendix E)</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel required>Project Year</FieldLabel>
                      <Input
                        aria-invalid={attemptedMidterm && !midtermForm.project_year}
                        type="number"
                        min="1"
                        value={midtermForm.project_year}
                        onChange={(e) => setMidtermForm((f) => ({ ...f, project_year: e.target.value }))}
                      />
                    </div>
                    <DocumentPicker
                      value={midtermForm.document}
                      onChange={(v) => setMidtermForm((f) => ({ ...f, document: v }))}
                      documents={documents}
                    />
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel>Narrative</FieldLabel>
                      <Textarea
                        value={midtermForm.narrative}
                        onChange={(v) => setMidtermForm((f) => ({ ...f, narrative: v }))}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel>Expenditure Summary</FieldLabel>
                      <Textarea
                        value={midtermForm.expenditure_summary}
                        onChange={(v) => setMidtermForm((f) => ({ ...f, expenditure_summary: v }))}
                        placeholder="Summary of expenditures per quarter"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddMidterm} disabled={isSavingMidterm}>
                      {isSavingMidterm ? "Submitting..." : "Submit Report"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
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
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={4} />
                    ) : midtermReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <EmptyState icon={<ClipboardCheck className="size-7" />} title="No midterm reports yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      midtermReports.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">Y{r.project_year}</TableCell>
                          <TableCell className="max-w-sm truncate">{r.narrative || "—"}</TableCell>
                          <TableCell className="max-w-sm truncate">{r.expenditure_summary || "—"}</TableCell>
                          <TableCell>{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "terminal" && (
            <>
              {isLoadingSection ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : terminalReport ? (
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-navy">Terminal Report (Appendix F)</h3>
                    <Badge variant={terminalReport.is_certified ? "outline" : "secondary"}>
                      {terminalReport.is_certified ? "Certified" : "Awaiting Certification"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Narrative</p>
                      <p className="mt-1 text-sm">{terminalReport.narrative || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Document</p>
                      <p className="mt-1 text-sm">
                        {terminalReport.document
                          ? documents.find((d) => d.id === terminalReport.document)?.file_name ??
                            `#${terminalReport.document}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Submitted</p>
                      <p className="mt-1 text-sm">{new Date(terminalReport.submitted_at).toLocaleDateString()}</p>
                    </div>
                    {terminalReport.is_certified && (
                      <div>
                        <p className="text-xs text-muted-foreground">Certified</p>
                        <p className="mt-1 text-sm">
                          {terminalReport.certified_at && new Date(terminalReport.certified_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {!terminalReport.is_certified && canCertifyTerminal && (
                    <div className="mt-4 flex justify-end">
                      <Button size="sm" onClick={handleCertifyTerminal} disabled={isCertifying}>
                        <FileCheck2 className="size-4" />
                        {isCertifying ? "Certifying..." : "Certify Terminal Report"}
                      </Button>
                    </div>
                  )}
                  {!terminalReport.is_certified && !canCertifyTerminal && (
                    <p className="mt-3 text-right text-xs text-muted-foreground">Awaiting RIUH or System Admin certification</p>
                  )}
                </Card>
              ) : canReport ? (
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Submit the Terminal Report (Appendix F)</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DocumentPicker
                      value={terminalForm.document}
                      onChange={(v) => setTerminalForm((f) => ({ ...f, document: v }))}
                      documents={documents}
                    />
                    <div className="sm:col-span-2">
                      <FieldLabel>Narrative</FieldLabel>
                      <Textarea
                        value={terminalForm.narrative}
                        onChange={(v) => setTerminalForm((f) => ({ ...f, narrative: v }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddTerminal} disabled={isSavingTerminal}>
                      {isSavingTerminal ? "Submitting..." : "Submit Terminal Report"}
                    </Button>
                  </div>
                </Card>
              ) : (
                <EmptyState icon={<FileCheck2 className="size-7" />} title="No terminal report submitted yet" />
              )}
            </>
          )}

          {section === "evaluations" && (
            <>
              {canPanelEvaluate && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Schedule an Annual Evaluation</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel required>Project Year</FieldLabel>
                      <Input
                        aria-invalid={attemptedEval && !evalForm.project_year}
                        type="number"
                        min="1"
                        value={evalForm.project_year}
                        onChange={(e) => setEvalForm((f) => ({ ...f, project_year: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Scheduled Date</FieldLabel>
                      <Input
                        aria-invalid={attemptedEval && !evalForm.scheduled_date}
                        type="date"
                        value={evalForm.scheduled_date}
                        onChange={(e) => setEvalForm((f) => ({ ...f, scheduled_date: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FieldLabel>Panel Members</FieldLabel>
                      <Textarea
                        value={evalForm.panel_members}
                        onChange={(v) => setEvalForm((f) => ({ ...f, panel_members: v }))}
                        placeholder="Names/roles of panel members, incl. any external member"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddEvaluation} disabled={isSavingEval}>
                      {isSavingEval ? "Scheduling..." : "Schedule Evaluation"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Year</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Panel Members</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Remarks</TableHead>
                      {canPanelEvaluate && <TableHead className="text-right">Record</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={canPanelEvaluate ? 6 : 5} />
                    ) : evaluations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canPanelEvaluate ? 6 : 5} className="p-0">
                          <EmptyState icon={<ClipboardCheck className="size-7" />} title="No evaluations scheduled yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      evaluations.map((e) => {
                        const draft = evalDraft(e);
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">Y{e.project_year}</TableCell>
                            <TableCell>{e.scheduled_date}</TableCell>
                            <TableCell className="max-w-xs truncate">{e.panel_members || "—"}</TableCell>
                            <TableCell>
                              {canPanelEvaluate ? (
                                <Select
                                  value={draft.outcome}
                                  onValueChange={(v) =>
                                    setEvalDrafts((prev) => ({
                                      ...prev,
                                      [e.id]: { ...draft, outcome: v as EvaluationOutcome },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline">{OUTCOME_LABELS[e.outcome]}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {canPanelEvaluate ? (
                                <Input
                                  className="h-8 w-48"
                                  value={draft.remarks}
                                  onChange={(ev) =>
                                    setEvalDrafts((prev) => ({
                                      ...prev,
                                      [e.id]: { ...draft, remarks: ev.target.value },
                                    }))
                                  }
                                />
                              ) : (
                                e.remarks || "—"
                              )}
                            </TableCell>
                            {canPanelEvaluate && (
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveEvaluation(e)}
                                  disabled={savingEvalId === e.id}
                                >
                                  Save
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {section === "renewal" && (
            <>
              {canReport && (
                <Card className="mb-6 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-navy">Apply for Renewal</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>Application Year</FieldLabel>
                      <Input
                        type="number"
                        min="1"
                        value={renewalForm.application_year}
                        onChange={(e) => setRenewalForm((f) => ({ ...f, application_year: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FieldLabel>Underspend Justification</FieldLabel>
                      <Textarea
                        value={renewalForm.underspend_justification}
                        onChange={(v) => setRenewalForm((f) => ({ ...f, underspend_justification: v }))}
                        placeholder="Reasonable explanation for unspent funds, if budget usage is below 70%"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAddRenewal} disabled={isSavingRenewal}>
                      {isSavingRenewal ? "Submitting..." : "Submit Application"}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                      <TableHead>Year</TableHead>
                      <TableHead>Eligible</TableHead>
                      <TableHead>Budget Used</TableHead>
                      <TableHead>Deliverables</TableHead>
                      <TableHead>Status</TableHead>
                      {canDecideRenewal && <TableHead className="text-right">Review</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingSection ? (
                      <TableSkeletonRows rows={3} columns={canDecideRenewal ? 6 : 5} />
                    ) : renewalApplications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canDecideRenewal ? 6 : 5} className="p-0">
                          <EmptyState icon={<RefreshCw className="size-7" />} title="No renewal applications yet" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      renewalApplications.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">Y{a.application_year}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={a.renewal_eligible ? "" : "text-muted-foreground"}>
                              {a.renewal_eligible ? "Eligible" : "Not Eligible"}
                            </Badge>
                          </TableCell>
                          <TableCell>{pct(a.budget_used_pct)}</TableCell>
                          <TableCell>{pct(a.deliverables_pct)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{RENEWAL_STATUS_LABELS[a.status]}</Badge>
                          </TableCell>
                          {canDecideRenewal && (
                            <TableCell className="text-right">
                              {a.status === "pending" ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleDecideRenewal(a, "approved")}
                                    disabled={decidingId === a.id}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDecideRenewal(a, "denied")}
                                    disabled={decidingId === a.id}
                                  >
                                    Deny
                                  </Button>
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Project Monitoring">
        <MonitoringContent />
      </AppShell>
    </ProtectedRoute>
  );
}
