import { useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { budgetApi } from "../lib/budgetApi";
import { researchApi } from "../lib/researchApi";
import type { LineItem, LineItemBudget, LineItemCategory } from "../types/budget";
import type { Project } from "../types/research";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/layout/AppShell";
import { EmptyOption } from "../components/common/EmptyOption";
import { FieldLabel } from "../components/common/FieldLabel";
import { EmptyState, PageHeader, TableSkeletonRows } from "../components/common/Page";
import { Badge } from "@/components/ui/badge";
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
import { notify } from "../lib/notify";

const CATEGORY_LABELS: Record<LineItemCategory, string> = {
  ps: "Personal Services",
  mooe: "Maintenance and Other Operating Expenses",
  co: "Capital Outlay",
};

const peso = (amount: string) =>
  `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function ProcurementContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<LineItemBudget[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState("");

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const budgetsById = useMemo(() => new Map(budgets.map((b) => [b.id, b])), [budgets]);

  const load = async (projectId?: number) => {
    setIsLoading(true);
    try {
      const flagged = await budgetApi.getLineItems({
        project: projectId,
        is_app_flagged: true,
      });
      setItems(flagged);
    } catch {
      notify.error("Could not load the APP-flagged item worklist. Check your connection and refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [projectList, budgetList] = await Promise.all([researchApi.getProjects(), budgetApi.getBudgets()]);
        setProjects(projectList);
        setBudgets(budgetList);
      } catch {
        notify.error("Could not load projects or budgets.");
      }
      await load();
    })();
  }, []);

  const handleSelectProject = (value: string) => {
    const next = value === "all" ? "" : value;
    setSelectedProject(next);
    load(next ? Number(next) : undefined);
  };

  return (
    <div>
      <PageHeader
        title="Procurement"
        description="Institution-wide worklist of line items above the ₱50,000 APP-flag threshold, across all projects and budgets — for the LIB Procurement Officer to track regardless of which project they belong to."
      />

      <Card className="mb-6 w-80 p-4">
        <FieldLabel>Project</FieldLabel>
        <Select value={selectedProject || "all"} onValueChange={handleSelectProject}>
          <SelectTrigger>
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.length === 0 && <EmptyOption message="No projects registered yet" />}
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.project_code} — {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead>Project</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows rows={6} columns={5} />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={<ShoppingCart className="size-7" />}
                    title="No APP-flagged items"
                    description="Nothing above ₱50,000 in scope right now."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const budget = budgetsById.get(item.budget);
                const project = budget ? projectsById.get(budget.project) : undefined;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {project ? `${project.project_code} — ${project.title}` : `Budget #${item.budget}`}
                    </TableCell>
                    <TableCell>
                      {budget && (
                        <>
                          v{budget.version_number}{" "}
                          <Badge variant="outline" className="ml-1 capitalize">
                            {budget.status}
                          </Badge>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_LABELS[item.category]}</Badge>
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="font-medium text-navy">{peso(item.amount)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function ProcurementPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Procurement">
        <ProcurementContent />
      </AppShell>
    </ProtectedRoute>
  );
}
