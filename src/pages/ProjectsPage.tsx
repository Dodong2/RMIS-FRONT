import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus } from "lucide-react";
import { researchApi } from "../lib/researchApi";
import type { Program, Project, FundingType } from "../types/research";
import type { AdminUser } from "../types/auth";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { FormAlert } from "../components/common/FormAlert";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
import { MultiSelect } from "../components/common/MultiSelect";
import {
  PRIORITY_AREA_LABELS,
  RESEARCH_TYPE_LABELS,
  SDG_OPTIONS,
  SECTOR_LABELS,
  TYPOLOGY_OPTIONS,
} from "../lib/projectOptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const FUNDING_LABELS: Record<FundingType, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

const REGISTRATION_ROLE_CODES = ["system_admin", "crc_chair"];

function ProjectsContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRegister = !!user?.role && REGISTRATION_ROLE_CODES.includes(user.role.code);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [programLeaders, setProgramLeaders] = useState<AdminUser[]>([]);
  const [projectLeaders, setProjectLeaders] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [programForm, setProgramForm] = useState({
    title: "",
    funding_type: "",
    lead: "",
    rei_thrust: "",
    start_date: "",
  });
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);

  const [projectForm, setProjectForm] = useState({
    title: "",
    project_code: "",
    funding_type: "",
    program: "",
    lead: "",
    ntp_number: "",
    ntp_date: "",
    toe_signed_date: "",
    is_dry_research: "true",
    start_date: "",
    target_end_date: "",
    rei_thrust: "",
    sdgs: [] as string[],
    sector: "",
    sector_other: "",
    is_continuing: "false",
    research_type: "",
    research_priority_area: "",
    research_typology: [] as string[],
    campus: "",
    implementing_unit: "",
    cooperating_agencies: "",
    total_cost: "",
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [programList, projectList] = await Promise.all([
        researchApi.getPrograms(),
        researchApi.getProjects(),
      ]);
      setPrograms(programList);
      setProjects(projectList);

      if (canRegister) {
        const [pls, prls] = await Promise.all([
          researchApi.getUsersByRole("program_leader"),
          researchApi.getUsersByRole("project_leader"),
        ]);
        setProgramLeaders(pls);
        setProjectLeaders(prls);
      }
      setError("");
    } catch {
      setError("Could not load projects. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRegister]);

  const handleCreateProgram = async () => {
    setError("");
    setSuccess("");
    if (!programForm.title || !programForm.funding_type || !programForm.lead) {
      setError("Program title, funding type, and lead are required.");
      return;
    }
    setIsCreatingProgram(true);
    try {
      await researchApi.createProgram({
        title: programForm.title,
        funding_type: programForm.funding_type,
        lead: Number(programForm.lead),
        rei_thrust: programForm.rei_thrust || undefined,
        start_date: programForm.start_date || undefined,
      });
      setSuccess("Program registered.");
      setProgramForm({ title: "", funding_type: "", lead: "", rei_thrust: "", start_date: "" });
      await load();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          err?.response?.data?.non_field_errors?.[0] ??
          "Could not register the program.",
      );
    } finally {
      setIsCreatingProgram(false);
    }
  };

  const handleCreateProject = async () => {
    setError("");
    setSuccess("");
    if (!projectForm.title || !projectForm.project_code || !projectForm.funding_type || !projectForm.lead) {
      setError("Project title, project code, funding type, and lead are required.");
      return;
    }
    if (projectForm.sdgs.length === 0) {
      setError("Select at least one Sustainable Development Goal.");
      return;
    }
    if (!projectForm.sector) {
      setError("Sector is required.");
      return;
    }
    if (projectForm.sector === "others" && !projectForm.sector_other.trim()) {
      setError("Specify the sector when 'Others' is selected.");
      return;
    }
    setIsCreatingProject(true);
    try {
      await researchApi.createProject({
        program: projectForm.program ? Number(projectForm.program) : null,
        title: projectForm.title,
        project_code: projectForm.project_code,
        funding_type: projectForm.funding_type,
        lead: Number(projectForm.lead),
        ntp_number: projectForm.ntp_number || undefined,
        ntp_date: projectForm.ntp_date || undefined,
        toe_signed_date: projectForm.toe_signed_date || undefined,
        is_dry_research: projectForm.is_dry_research === "true",
        start_date: projectForm.start_date || undefined,
        target_end_date: projectForm.target_end_date || undefined,
        rei_thrust: projectForm.rei_thrust || undefined,
        sdgs: projectForm.sdgs.map(Number),
        sector: projectForm.sector,
        sector_other: projectForm.sector === "others" ? projectForm.sector_other : undefined,
        is_continuing: projectForm.is_continuing === "true",
        research_type: projectForm.research_type || undefined,
        research_priority_area: projectForm.research_priority_area || undefined,
        research_typology: projectForm.research_typology,
        campus: projectForm.campus || undefined,
        implementing_unit: projectForm.implementing_unit || undefined,
        cooperating_agencies: projectForm.cooperating_agencies || undefined,
        total_cost: projectForm.total_cost || undefined,
      });
      setSuccess("Project registered.");
      setProjectForm({
        title: "",
        project_code: "",
        funding_type: "",
        program: "",
        lead: "",
        ntp_number: "",
        ntp_date: "",
        toe_signed_date: "",
        is_dry_research: "true",
        start_date: "",
        target_end_date: "",
        rei_thrust: "",
        sdgs: [],
        sector: "",
        sector_other: "",
        is_continuing: "false",
        research_type: "",
        research_priority_area: "",
        research_typology: [],
        campus: "",
        implementing_unit: "",
        cooperating_agencies: "",
        total_cost: "",
      });
      await load();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        data?.detail ??
          data?.non_field_errors?.[0] ??
          data?.sdgs?.[0] ??
          data?.sector?.[0] ??
          data?.sector_other?.[0] ??
          "Could not register the project.",
      );
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <div>
      <PageHeader title="Projects" description="Programs, projects, and their registration details." />

      <FormAlert tone="error" message={error} className="mb-4" />
      <FormAlert tone="success" message={success} className="mb-4" />

      {canRegister && (
        <Card className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-semibold text-navy">Register a Program</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs">Title</Label>
              <Input
                value={programForm.title}
                onChange={(e) => setProgramForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Program title"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Funding Type</Label>
              <Select
                value={programForm.funding_type}
                onValueChange={(v) => setProgramForm((p) => ({ ...p, funding_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select funding type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUNDING_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Program Leader</Label>
              <Select value={programForm.lead} onValueChange={(v) => setProgramForm((p) => ({ ...p, lead: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leader" />
                </SelectTrigger>
                <SelectContent>
                  {programLeaders.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">REI Thrust (optional)</Label>
              <Input
                value={programForm.rei_thrust}
                onChange={(e) => setProgramForm((p) => ({ ...p, rei_thrust: e.target.value }))}
                placeholder="e.g. Sustainable Agriculture"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleCreateProgram} disabled={isCreatingProgram}>
              <Plus className="size-4" />
              {isCreatingProgram ? "Registering..." : "Register Program"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">Programs</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Title</TableHead>
              <TableHead>Funding Type</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={2} columns={4} />
            ) : programs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    icon={<FolderKanban className="size-7" />}
                    title="No programs yet"
                    description="Register one above once you have two or more related projects to group."
                  />
                </TableCell>
              </TableRow>
            ) : (
              programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{FUNDING_LABELS[p.funding_type]}</TableCell>
                  <TableCell>{p.lead_detail.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {p.status}
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
          <h3 className="mb-3 text-sm font-semibold text-navy">Register a Project</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">Title</Label>
              <Input
                value={projectForm.title}
                onChange={(e) => setProjectForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Project title"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Project Code (LSPU Faculty Research Number)</Label>
              <Input
                value={projectForm.project_code}
                onChange={(e) => setProjectForm((p) => ({ ...p, project_code: e.target.value }))}
                placeholder="e.g. FRN-2026-001"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Funding Type</Label>
              <Select
                value={projectForm.funding_type}
                onValueChange={(v) => setProjectForm((p) => ({ ...p, funding_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select funding type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUNDING_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Parent Program (optional)</Label>
              <Select value={projectForm.program} onValueChange={(v) => setProjectForm((p) => ({ ...p, program: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="No parent program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((prog) => (
                    <SelectItem key={prog.id} value={String(prog.id)}>
                      {prog.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Project Leader</Label>
              <Select value={projectForm.lead} onValueChange={(v) => setProjectForm((p) => ({ ...p, lead: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leader" />
                </SelectTrigger>
                <SelectContent>
                  {projectLeaders.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Research Type</Label>
              <Select
                value={projectForm.is_dry_research}
                onValueChange={(v) => setProjectForm((p) => ({ ...p, is_dry_research: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Dry Research</SelectItem>
                  <SelectItem value="false">Wet / Laboratory Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">NTP Number (optional)</Label>
              <Input
                value={projectForm.ntp_number}
                onChange={(e) => setProjectForm((p) => ({ ...p, ntp_number: e.target.value }))}
                placeholder="Notice to Proceed no."
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">NTP Date (optional)</Label>
              <Input
                type="date"
                value={projectForm.ntp_date}
                onChange={(e) => setProjectForm((p) => ({ ...p, ntp_date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">TOE Signed Date (optional)</Label>
              <Input
                type="date"
                value={projectForm.toe_signed_date}
                onChange={(e) => setProjectForm((p) => ({ ...p, toe_signed_date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Start Date (optional)</Label>
              <Input
                type="date"
                value={projectForm.start_date}
                onChange={(e) => setProjectForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Target End Date (optional)</Label>
              <Input
                type="date"
                value={projectForm.target_end_date}
                onChange={(e) => setProjectForm((p) => ({ ...p, target_end_date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">REI Thrust (optional)</Label>
              <Input
                value={projectForm.rei_thrust}
                onChange={(e) => setProjectForm((p) => ({ ...p, rei_thrust: e.target.value }))}
                placeholder="e.g. Sustainable Agriculture"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Sustainable Development Goals</Label>
              <MultiSelect
                options={SDG_OPTIONS}
                value={projectForm.sdgs}
                onChange={(next) => setProjectForm((p) => ({ ...p, sdgs: next }))}
                placeholder="Select SDGs"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Sector</Label>
              <Select value={projectForm.sector} onValueChange={(v) => setProjectForm((p) => ({ ...p, sector: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sector" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {projectForm.sector === "others" && (
              <div>
                <Label className="mb-1 block text-xs">Specify Sector</Label>
                <Input
                  value={projectForm.sector_other}
                  onChange={(e) => setProjectForm((p) => ({ ...p, sector_other: e.target.value }))}
                  placeholder="Other sector"
                />
              </div>
            )}
            <div>
              <Label className="mb-1 block text-xs">Proposal Type</Label>
              <Select
                value={projectForm.is_continuing}
                onValueChange={(v) => setProjectForm((p) => ({ ...p, is_continuing: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">New Proposal</SelectItem>
                  <SelectItem value="true">Continuing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Research Category (optional)</Label>
              <Select
                value={projectForm.research_type}
                onValueChange={(v) => setProjectForm((p) => ({ ...p, research_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Basic or applied" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESEARCH_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Research Priority Area (optional)</Label>
              <Select
                value={projectForm.research_priority_area}
                onValueChange={(v) => setProjectForm((p) => ({ ...p, research_priority_area: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority area" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_AREA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Research Typology (optional)</Label>
              <MultiSelect
                options={TYPOLOGY_OPTIONS}
                value={projectForm.research_typology}
                onChange={(next) => setProjectForm((p) => ({ ...p, research_typology: next }))}
                placeholder="Select typology"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Campus (optional)</Label>
              <Input
                value={projectForm.campus}
                onChange={(e) => setProjectForm((p) => ({ ...p, campus: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Implementing Unit (optional)</Label>
              <Input
                value={projectForm.implementing_unit}
                onChange={(e) => setProjectForm((p) => ({ ...p, implementing_unit: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Cooperating Agencies (optional)</Label>
              <Input
                value={projectForm.cooperating_agencies}
                onChange={(e) => setProjectForm((p) => ({ ...p, cooperating_agencies: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Total Cost (optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={projectForm.total_cost}
                onChange={(e) => setProjectForm((p) => ({ ...p, total_cost: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleCreateProject} disabled={isCreatingProject}>
              <Plus className="size-4" />
              {isCreatingProject ? "Registering..." : "Register Project"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">All Projects</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Project Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Funding Type</TableHead>
              <TableHead>Leader</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={4} columns={6} />
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={<FolderKanban className="size-7" />}
                    title="No projects yet"
                    description="Register the first project above once it has an approved Notice to Proceed."
                  />
                </TableCell>
              </TableRow>
            ) : (
              projects.map((proj) => (
                <TableRow key={proj.id}>
                  <TableCell className="font-mono text-xs">{proj.project_code}</TableCell>
                  <TableCell className="font-medium">{proj.title}</TableCell>
                  <TableCell>{FUNDING_LABELS[proj.funding_type]}</TableCell>
                  <TableCell>{proj.lead_detail.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {proj.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${proj.id}`)}>
                      View
                    </Button>
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

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Projects">
        <ProjectsContent />
      </AppShell>
    </ProtectedRoute>
  );
}