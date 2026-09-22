import { useEffect, useState } from "react";
import { Plus, ShieldCheck, Wallet } from "lucide-react";
import { budgetApi } from "../lib/budgetApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type { LineItemBudget, LineItemCategory } from "../types/budget";
import type { Project } from "../types/research";
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

const MANAGE_ROLE_CODES = ["system_admin", "finance_budget"];

const CATEGORY_LABELS: Record<LineItemCategory, string> = {
  ps: "Personal Services",
  mooe: "Maintenance and Other Operating Expenses",
  co: "Capital Outlay",
};

const peso = (amount: string) =>
  `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function BudgetContent() {
  const { user } = useAuth();
  const canManage = !!user?.role && MANAGE_ROLE_CODES.includes(user.role.code);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [budget, setBudget] = useState<LineItemBudget | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [isCreatingBudget, setIsCreatingBudget] = useState(false);
  const [isCertifying, setIsCertifying] = useState(false);

  const [itemForm, setItemForm] = useState({ category: "", description: "", amount: "" });
  const [attemptedItem, setAttemptedItem] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);

  const project = projects.find((p) => p.id === Number(selectedProject)) ?? null;

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

  const loadBudget = async (projectId: number) => {
    setIsLoadingBudget(true);
    try {
      const budgets = await budgetApi.getBudgets(projectId);
      setBudget(budgets.find((b) => b.is_current) ?? null);
    } catch {
      notify.error("Could not load the budget for this project.");
    } finally {
      setIsLoadingBudget(false);
    }
  };

  const handleSelectProject = async (value: string) => {
    setSelectedProject(value);
    setItemForm({ category: "", description: "", amount: "" });
    setAttemptedItem(false);
    await loadBudget(Number(value));
  };

  const handleCreateBudget = async () => {
    if (!selectedProject) return;
    setIsCreatingBudget(true);
    try {
      const created = await budgetApi.createBudget(Number(selectedProject));
      setBudget(created);
      notify.success(`Budget v${created.version_number} started.`);
    } catch (err) {
      notify.error(errorMessage(err, "Could not create a budget for this project."));
    } finally {
      setIsCreatingBudget(false);
    }
  };

  const handleAddItem = async () => {
    setAttemptedItem(true);
    if (!budget || !itemForm.category || !itemForm.description.trim() || !itemForm.amount) {
      notify.error("Category, description, and amount are required.");
      return;
    }
    setIsAddingItem(true);
    try {
      await budgetApi.createLineItem({
        budget: budget.id,
        category: itemForm.category as LineItemCategory,
        description: itemForm.description.trim(),
        amount: itemForm.amount,
      });
      setAttemptedItem(false);
      notify.success("Line item added.");
      setItemForm({ category: "", description: "", amount: "" });
      await loadBudget(budget.project);
    } catch (err) {
      notify.error(errorMessage(err, "Could not add the line item."));
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!budget) return;
    try {
      await budgetApi.deleteLineItem(id);
      notify.success("Line item removed.");
      await loadBudget(budget.project);
    } catch (err) {
      notify.error(errorMessage(err, "Could not remove the line item."));
    }
  };

  const handleCertify = async () => {
    if (!budget) return;
    setIsCertifying(true);
    try {
      const certified = await budgetApi.certifyBudget(budget.id);
      setBudget(certified);
      notify.success("Budget certified.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not certify this budget."));
    } finally {
      setIsCertifying(false);
    }
  };

  const isDraft = budget?.status === "draft";
  const isCappedProject = !!project && project.funding_type === "institutional" && project.is_dry_research;

  return (
    <div>
      <PageHeader
        title="Budget"
        description="Line-item budgets per project — Personal Services, MOOE, and Capital Outlay."
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
        {isCappedProject && (
          <p className="mt-2 text-xs text-muted-foreground">
            Institutionally-funded dry research — total line items are capped at ₱100,000.
          </p>
        )}
      </Card>

      {!selectedProject ? (
        <EmptyState
          icon={<Wallet className="size-7" />}
          title="Select a project"
          description="Choose a project above to view or manage its budget."
        />
      ) : isLoadingBudget ? (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableBody>
              <TableSkeletonRows rows={3} columns={4} />
            </TableBody>
          </Table>
        </Card>
      ) : !budget ? (
        <EmptyState
          icon={<Wallet className="size-7" />}
          title="No budget yet"
          description="This project has no line-item budget version yet."
          action={
            canManage && (
              <Button size="sm" onClick={handleCreateBudget} disabled={isCreatingBudget}>
                <Plus className="size-4" />
                {isCreatingBudget ? "Creating..." : "Create Budget"}
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-navy">
                Version {budget.version_number}
                <Badge variant="outline" className="ml-2 capitalize">
                  {budget.status}
                </Badge>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Total: <span className="font-semibold text-navy">{peso(budget.total_amount)}</span>
              </p>
              {budget.status === "certified" && budget.certified_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Certified on {new Date(budget.certified_at).toLocaleDateString()}
                </p>
              )}
            </div>
            {canManage && isDraft && (
              <Button size="sm" onClick={handleCertify} disabled={isCertifying}>
                <ShieldCheck className="size-4" />
                {isCertifying ? "Certifying..." : "Certify Budget"}
              </Button>
            )}
          </Card>

          {canManage && isDraft && (
            <Card className="mb-6 p-4">
              <h3 className="mb-3 text-sm font-semibold text-navy">Add a Line Item</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <FieldLabel required>Category</FieldLabel>
                  <Select
                    value={itemForm.category}
                    onValueChange={(v) => setItemForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger aria-invalid={attemptedItem && !itemForm.category}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as LineItemCategory[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel required>Description</FieldLabel>
                  <Input
                    aria-invalid={attemptedItem && !itemForm.description.trim()}
                    value={itemForm.description}
                    onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Research assistant honorarium"
                  />
                </div>
                <div>
                  <FieldLabel required>Amount (₱)</FieldLabel>
                  <Input
                    aria-invalid={attemptedItem && !itemForm.amount}
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.amount}
                    onChange={(e) => setItemForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={handleAddItem} disabled={isAddingItem} className="w-full">
                    <Plus className="size-4" />
                    {isAddingItem ? "Adding..." : "Add Item"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-navy">Line Items</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  {canManage && isDraft && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {budget.line_items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage && isDraft ? 4 : 3} className="p-0">
                      <EmptyState
                        icon={<Wallet className="size-7" />}
                        title="No line items yet"
                        description="Add PS, MOOE, or CO line items above."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  budget.line_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline">{CATEGORY_LABELS[item.category]}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.description}
                        {item.is_app_flagged && (
                          <Badge variant="outline" className="ml-2 text-destructive">
                            Above ₱50,000
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{peso(item.amount)}</TableCell>
                      {canManage && isDraft && (
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleDeleteItem(item.id)}>
                            Remove
                          </Button>
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
    </div>
  );
}

export default function BudgetPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Budget">
        <BudgetContent />
      </AppShell>
    </ProtectedRoute>
  );
}
