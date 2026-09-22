import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus } from "lucide-react";
import { researchApi } from "../lib/researchApi";
import type { Program, Project, FundingType } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "../lib/notify";

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
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const [programList, projectList] = await Promise.all([
        researchApi.getPrograms(),
        researchApi.getProjects(),
      ]);
      setPrograms(programList);
      setProjects(projectList);
    } catch {
      notify.error("Could not load projects. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Projects" description="Programs, projects, and their registration details." />

      <Card className="mb-6 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">Programs</h3>
          {canRegister && (
            <Button size="sm" onClick={() => navigate("/programs/new")}>
              <Plus className="size-4" />
              Register a Program
            </Button>
          )}
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
                    description="Register one once you have two or more related projects to group."
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

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h3 className="text-sm font-semibold text-navy">All Projects</h3>
          {canRegister && (
            <Button size="sm" onClick={() => navigate("/projects/new")}>
              <Plus className="size-4" />
              Register a Project
            </Button>
          )}
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
                    description="Register the first project once it has an approved Notice to Proceed."
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
