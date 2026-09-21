import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, ListChecks, Plus } from "lucide-react";
import { researchApi } from "../lib/researchApi";
import type { Project, Study, Milestone, MilestoneStatus } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { EmptyOption } from "../components/common/EmptyOption";
import { FieldLabel } from "../components/common/FieldLabel";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
import {
  PRIORITY_AREA_LABELS,
  RESEARCH_TYPE_LABELS,
  SDG_LABELS,
  SECTOR_LABELS,
  TYPOLOGY_LABELS,
} from "../lib/projectOptions";
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

const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  delayed: "Delayed",
};

const REGISTRATION_ROLE_CODES = ["system_admin", "crc_chair"];

function ProjectDetailContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRegister = !!user?.role && REGISTRATION_ROLE_CODES.includes(user.role.code);
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [studyLeaders, setStudyLeaders] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attemptedMilestone, setAttemptedMilestone] = useState(false);
  const [attemptedStudy, setAttemptedStudy] = useState(false);

  const [studyForm, setStudyForm] = useState({ title: "", lead: "" });
  const [isCreatingStudy, setIsCreatingStudy] = useState(false);

  const [milestoneForm, setMilestoneForm] = useState({ title: "", target_date: "", remarks: "" });
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [updatingMilestone, setUpdatingMilestone] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [proj, studyList, milestoneList] = await Promise.all([
        researchApi.getProject(projectId),
        researchApi.getStudies(projectId),
        researchApi.getMilestones(projectId),
      ]);
      setProject(proj);
      setStudies(studyList);
      setMilestones(milestoneList);

      if (canRegister) {
        const leaders = await researchApi.getUsersByRole("study_leader");
        setStudyLeaders(leaders);
      }
    } catch {
      notify.error("Could not load this project. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isNaN(projectId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, canRegister]);

  const handleCreateStudy = async () => {
    setAttemptedStudy(true);
    if (!studyForm.title || !studyForm.lead) {
      notify.error("Study title and lead are required.");
      return;
    }
    setIsCreatingStudy(true);
    try {
      await researchApi.createStudy({
        project: projectId,
        title: studyForm.title,
        lead: Number(studyForm.lead),
      });
      setAttemptedStudy(false);
      notify.success("Study added.");
      setStudyForm({ title: "", lead: "" });
      await load();
    } catch (err: any) {
      notify.error(
        err?.response?.data?.detail ??
          err?.response?.data?.non_field_errors?.[0] ??
          "Could not add the study.",
      );
    } finally {
      setIsCreatingStudy(false);
    }
  };

  const handleCreateMilestone = async () => {
    setAttemptedMilestone(true);
    if (!milestoneForm.title || !milestoneForm.target_date) {
      notify.error("Milestone title and target date are required.");
      return;
    }
    setIsCreatingMilestone(true);
    try {
      await researchApi.createMilestone({
        project: projectId,
        title: milestoneForm.title,
        target_date: milestoneForm.target_date,
        remarks: milestoneForm.remarks || undefined,
      });
      setAttemptedMilestone(false);
      notify.success("Milestone added.");
      setMilestoneForm({ title: "", target_date: "", remarks: "" });
      await load();
    } catch {
      notify.error("Could not add the milestone.");
    } finally {
      setIsCreatingMilestone(false);
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: number, status: string) => {
    setUpdatingMilestone(milestoneId);
    try {
      await researchApi.updateMilestoneStatus(milestoneId, status);
      await load();
    } catch {
      notify.error("Could not update the milestone status.");
    } finally {
      setUpdatingMilestone(null);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/projects")}>
        <ArrowLeft className="size-4" />
        Back to Projects
      </Button>

      <PageHeader
        title={project?.title ?? (isLoading ? "Loading..." : "Project not found")}
        description={project ? `${project.project_code} · ${project.lead_detail.email}` : undefined}
      />

      {project && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Proposal Details</h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Sector</dt>
              <dd>
                {project.sector === "others"
                  ? project.sector_other
                  : project.sector
                    ? SECTOR_LABELS[project.sector]
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Proposal Type</dt>
              <dd>{project.is_continuing ? "Continuing" : "New Proposal"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Research Category</dt>
              <dd>{project.research_type ? RESEARCH_TYPE_LABELS[project.research_type] : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Priority Area</dt>
              <dd>
                {project.research_priority_area
                  ? PRIORITY_AREA_LABELS[project.research_priority_area]
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Typology</dt>
              <dd>
                {project.research_typology.length
                  ? project.research_typology.map((t) => TYPOLOGY_LABELS[t]).join(", ")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total Cost</dt>
              <dd>{project.total_cost ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Campus</dt>
              <dd>{project.campus || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Implementing Unit</dt>
              <dd>{project.implementing_unit || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cooperating Agencies</dt>
              <dd>{project.cooperating_agencies || "—"}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <p className="mb-1 text-xs text-muted-foreground">Sustainable Development Goals</p>
            <div className="flex flex-wrap gap-1.5">
              {project.sdgs.length === 0 ? (
                <span className="text-sm">—</span>
              ) : (
                project.sdgs.map((n) => (
                  <Badge key={n} variant="outline">
                    SDG {n} — {SDG_LABELS[n]}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </Card>
      )}

      {canRegister && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Add a Study</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel required>Title</FieldLabel>
              <Input aria-invalid={attemptedStudy && (!studyForm.title.trim())}
                value={studyForm.title}
                onChange={(e) => setStudyForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Study title"
              />
            </div>
            <div>
              <FieldLabel required>Study Leader</FieldLabel>
              <Select value={studyForm.lead} onValueChange={(v) => setStudyForm((s) => ({ ...s, lead: v }))}>
                <SelectTrigger aria-invalid={attemptedStudy && (!studyForm.lead)}>
                  <SelectValue placeholder="Select leader" />
                </SelectTrigger>
                <SelectContent>
                  {studyLeaders.length === 0 && <EmptyOption message="No active study leaders yet" />}
                  {studyLeaders.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={handleCreateStudy} disabled={isCreatingStudy} className="w-full">
                <Plus className="size-4" />
                {isCreatingStudy ? "Adding..." : "Add Study"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">Studies</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Title</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={2} columns={3} />
            ) : studies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={<ListChecks className="size-7" />}
                    title="No studies yet"
                    description="Every project needs at least one study for its technical/scholarly components."
                  />
                </TableCell>
              </TableRow>
            ) : (
              studies.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell>{s.lead_detail.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {canRegister && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Add a Work Plan Milestone</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel required>Title</FieldLabel>
              <Input aria-invalid={attemptedMilestone && (!milestoneForm.title.trim())}
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, title: e.target.value }))}
                placeholder="Milestone title"
              />
            </div>
            <div>
              <FieldLabel required>Target Date</FieldLabel>
              <Input aria-invalid={attemptedMilestone && (!milestoneForm.target_date)}
                type="date"
                value={milestoneForm.target_date}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, target_date: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={handleCreateMilestone} disabled={isCreatingMilestone} className="w-full">
                <Plus className="size-4" />
                {isCreatingMilestone ? "Adding..." : "Add Milestone"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">Work Plan</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Title</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead className="w-44">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={3} columns={3} />
            ) : milestones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={<CalendarClock className="size-7" />}
                    title="No milestones yet"
                    description="Add the project's key deliverables and target dates above."
                  />
                </TableCell>
              </TableRow>
            ) : (
              milestones.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell>{m.target_date}</TableCell>
                  <TableCell>
                    {canRegister ? (
                      <Select
                        value={m.status}
                        onValueChange={(v) => handleMilestoneStatusChange(m.id, v)}
                        disabled={updatingMilestone === m.id}
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(MILESTONE_STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {MILESTONE_STATUS_LABELS[m.status]}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Project Details">
        <ProjectDetailContent />
      </AppShell>
    </ProtectedRoute>
  );
}