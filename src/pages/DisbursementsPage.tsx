import { useEffect, useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { budgetApi } from "../lib/budgetApi";
import { financialApi } from "../lib/financialApi";
import { researchApi } from "../lib/researchApi";
import { errorMessage } from "../lib/errorMessage";
import type { LineItemBudget, LineItemCategory } from "../types/budget";
import type { BudgetRealignment, Disbursement, RealignmentStatus, RealignmentTier } from "../types/financial";
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

const DISBURSEMENT_ROLE_CODES = ["system_admin", "finance_budget"];
const REALIGNMENT_REQUEST_ROLE_CODES = ["system_admin", "project_leader"];
const REALIGNMENT_MAJOR_REVIEW_ROLE_CODES = ["system_admin", "university_admin"];
const REALIGNMENT_BOR_REVIEW_ROLE_CODES = ["system_admin"];

const CATEGORY_LABELS: Record<LineItemCategory, string> = {
  ps: "Personal Services",
  mooe: "Maintenance and Other Operating Expenses",
  co: "Capital Outlay",
};

const TIER_LABELS: Record<RealignmentTier, string> = {
  minor: "Minor (≤33%)",
  major: "Major (33–100%)",
  bor: "Board of Regents",
};

const STATUS_LABELS: Record<RealignmentStatus, string> = {
  implemented: "Implemented",
  pending_approval: "Pending University Admin",
  approved: "Approved",
  pending_bor: "Pending Board of Regents",
  bor_approved: "BOR Approved",
  rejected: "Rejected",
};

const today = () => new Date().toLocaleDateString("en-CA");

const peso = (amount: string) =>
  `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function DisbursementsContent() {
  const { user } = useAuth();
  const canDisburse = !!user?.role && DISBURSEMENT_ROLE_CODES.includes(user.role.code);
  const canRequestRealignment = !!user?.role && REALIGNMENT_REQUEST_ROLE_CODES.includes(user.role.code);
  const canReviewMajor = !!user?.role && REALIGNMENT_MAJOR_REVIEW_ROLE_CODES.includes(user.role.code);
  const canReviewBor = !!user?.role && REALIGNMENT_BOR_REVIEW_ROLE_CODES.includes(user.role.code);
  const canReviewRealignment = canReviewMajor || canReviewBor;
  const canReviewTier = (tier: RealignmentTier) => (tier === "bor" ? canReviewBor : canReviewMajor);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [budget, setBudget] = useState<LineItemBudget | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [realignments, setRealignments] = useState<BudgetRealignment[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);

  const [disbForm, setDisbForm] = useState({
    line_item: "",
    amount: "",
    reference_number: "",
    description: "",
    disbursed_on: today(),
  });
  const [attemptedDisb, setAttemptedDisb] = useState(false);
  const [isSavingDisb, setIsSavingDisb] = useState(false);

  const [realignTarget, setRealignTarget] = useState<"existing" | "new">("existing");
  const [realignForm, setRealignForm] = useState({
    from_line_item: "",
    to_line_item: "",
    new_item_category: "",
    new_item_description: "",
    amount: "",
    justification: "",
  });
  const [attemptedRealign, setAttemptedRealign] = useState(false);
  const [isSavingRealign, setIsSavingRealign] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [borResolution, setBorResolution] = useState<Record<number, string>>({});

  const lineItemLabel = (id: number) => {
    const item = budget?.line_items.find((li) => li.id === id);
    return item ? `${CATEGORY_LABELS[item.category]} — ${item.description}` : `#${id}`;
  };

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

  const loadBudgetData = async (projectId: number) => {
    setIsLoadingBudget(true);
    try {
      const budgets = await budgetApi.getBudgets(projectId);
      const current = budgets.find((b) => b.is_current) ?? null;
      setBudget(current);
      if (current) {
        const [disbList, realignList] = await Promise.all([
          financialApi.getDisbursements({ budget: current.id }),
          financialApi.getRealignments(current.id),
        ]);
        setDisbursements(disbList);
        setRealignments(realignList);
      } else {
        setDisbursements([]);
        setRealignments([]);
      }
    } catch {
      notify.error("Could not load financial records for this project.");
    } finally {
      setIsLoadingBudget(false);
    }
  };

  const handleSelectProject = async (value: string) => {
    setSelectedProject(value);
    setDisbForm({ line_item: "", amount: "", reference_number: "", description: "", disbursed_on: today() });
    setRealignForm({
      from_line_item: "",
      to_line_item: "",
      new_item_category: "",
      new_item_description: "",
      amount: "",
      justification: "",
    });
    setAttemptedDisb(false);
    setAttemptedRealign(false);
    await loadBudgetData(Number(value));
  };

  const handleAddDisbursement = async () => {
    setAttemptedDisb(true);
    if (!disbForm.line_item || !disbForm.amount || !disbForm.disbursed_on) {
      notify.error("Line item, amount, and date are required.");
      return;
    }
    setIsSavingDisb(true);
    try {
      await financialApi.createDisbursement({
        line_item: Number(disbForm.line_item),
        amount: disbForm.amount,
        reference_number: disbForm.reference_number || undefined,
        description: disbForm.description || undefined,
        disbursed_on: disbForm.disbursed_on,
      });
      setAttemptedDisb(false);
      notify.success("Disbursement recorded.");
      setDisbForm({ line_item: "", amount: "", reference_number: "", description: "", disbursed_on: today() });
      await loadBudgetData(Number(selectedProject));
    } catch (err) {
      notify.error(errorMessage(err, "Could not record the disbursement."));
    } finally {
      setIsSavingDisb(false);
    }
  };

  const handleRequestRealignment = async () => {
    setAttemptedRealign(true);
    const hasTarget =
      realignTarget === "existing" ? !!realignForm.to_line_item : !!realignForm.new_item_category;
    if (
      !realignForm.from_line_item ||
      !hasTarget ||
      !realignForm.amount ||
      !realignForm.justification.trim() ||
      (realignTarget === "new" && !realignForm.new_item_description.trim())
    ) {
      notify.error("Source item, destination, amount, and justification are all required.");
      return;
    }
    setIsSavingRealign(true);
    try {
      await financialApi.createRealignment({
        from_line_item: Number(realignForm.from_line_item),
        to_line_item: realignTarget === "existing" ? Number(realignForm.to_line_item) : null,
        new_item_category: realignTarget === "new" ? realignForm.new_item_category : undefined,
        new_item_description: realignTarget === "new" ? realignForm.new_item_description.trim() : undefined,
        amount: realignForm.amount,
        justification: realignForm.justification.trim(),
      });
      setAttemptedRealign(false);
      notify.success("Realignment requested.");
      setRealignForm({
        from_line_item: "",
        to_line_item: "",
        new_item_category: "",
        new_item_description: "",
        amount: "",
        justification: "",
      });
      await loadBudgetData(Number(selectedProject));
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit the realignment request."));
    } finally {
      setIsSavingRealign(false);
    }
  };

  const handleReview = async (realignment: BudgetRealignment, decision: "approved" | "rejected") => {
    if (decision === "approved" && realignment.tier === "bor" && !borResolution[realignment.id]?.trim()) {
      notify.error("A Board of Regents resolution number is required to approve this realignment.");
      return;
    }
    setReviewingId(realignment.id);
    try {
      await financialApi.reviewRealignment(realignment.id, {
        decision,
        bor_resolution_number:
          decision === "approved" && realignment.tier === "bor" ? borResolution[realignment.id] : undefined,
      });
      notify.success(decision === "approved" ? "Realignment approved." : "Realignment rejected.");
      await loadBudgetData(Number(selectedProject));
    } catch (err) {
      notify.error(errorMessage(err, "Could not submit the review."));
    } finally {
      setReviewingId(null);
    }
  };

  const isCertified = budget?.status === "certified";

  return (
    <div>
      <PageHeader
        title="Disbursements & Realignments"
        description="Record actual spend against a certified budget and request fund transfers between line items."
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

      {!selectedProject ? (
        <EmptyState
          icon={<Receipt className="size-7" />}
          title="Select a project"
          description="Choose a project above to view its disbursements and realignments."
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
          icon={<Receipt className="size-7" />}
          title="No budget for this project"
          description="Create and certify a line-item budget first, from the Budget page."
        />
      ) : !isCertified ? (
        <EmptyState
          icon={<Receipt className="size-7" />}
          title="Budget not yet certified"
          description="Disbursements and realignments can only be recorded against a certified budget."
        />
      ) : (
        <>
          {canDisburse && (
            <Card className="mb-6 p-4">
              <h3 className="mb-3 text-sm font-semibold text-navy">Record a Disbursement</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <FieldLabel required>Line Item</FieldLabel>
                  <Select
                    value={disbForm.line_item}
                    onValueChange={(v) => setDisbForm((f) => ({ ...f, line_item: v }))}
                  >
                    <SelectTrigger aria-invalid={attemptedDisb && !disbForm.line_item}>
                      <SelectValue placeholder="Select line item" />
                    </SelectTrigger>
                    <SelectContent>
                      {budget.line_items.length === 0 && <EmptyOption message="No line items on this budget" />}
                      {budget.line_items.map((li) => (
                        <SelectItem key={li.id} value={String(li.id)}>
                          {CATEGORY_LABELS[li.category]} — {li.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel required>Amount (₱)</FieldLabel>
                  <Input
                    aria-invalid={attemptedDisb && !disbForm.amount}
                    type="number"
                    min="0"
                    step="0.01"
                    value={disbForm.amount}
                    onChange={(e) => setDisbForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel required>Date</FieldLabel>
                  <Input
                    aria-invalid={attemptedDisb && !disbForm.disbursed_on}
                    type="date"
                    value={disbForm.disbursed_on}
                    onChange={(e) => setDisbForm((f) => ({ ...f, disbursed_on: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>OR/Voucher No. (optional)</FieldLabel>
                  <Input
                    value={disbForm.reference_number}
                    onChange={(e) => setDisbForm((f) => ({ ...f, reference_number: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={handleAddDisbursement} disabled={isSavingDisb} className="w-full">
                    <Plus className="size-4" />
                    {isSavingDisb ? "Recording..." : "Record"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card className="mb-6 overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-navy">Disbursements</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>Line Item</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disbursements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0">
                      <EmptyState icon={<Receipt className="size-7" />} title="No disbursements yet" />
                    </TableCell>
                  </TableRow>
                ) : (
                  disbursements.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{lineItemLabel(d.line_item)}</TableCell>
                      <TableCell>{peso(d.amount)}</TableCell>
                      <TableCell>{d.disbursed_on}</TableCell>
                      <TableCell>{d.reference_number || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {canRequestRealignment && (
            <Card className="mb-6 p-4">
              <h3 className="mb-3 text-sm font-semibold text-navy">Request a Budget Realignment</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <FieldLabel required>From Line Item</FieldLabel>
                  <Select
                    value={realignForm.from_line_item}
                    onValueChange={(v) => setRealignForm((f) => ({ ...f, from_line_item: v }))}
                  >
                    <SelectTrigger aria-invalid={attemptedRealign && !realignForm.from_line_item}>
                      <SelectValue placeholder="Source line item" />
                    </SelectTrigger>
                    <SelectContent>
                      {budget.line_items.map((li) => (
                        <SelectItem key={li.id} value={String(li.id)}>
                          {CATEGORY_LABELS[li.category]} — {li.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Destination</FieldLabel>
                  <Select
                    value={realignTarget}
                    onValueChange={(v) => setRealignTarget(v as "existing" | "new")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">An existing line item</SelectItem>
                      <SelectItem value="new">A new expense item (BOR tier)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel required>Amount (₱)</FieldLabel>
                  <Input
                    aria-invalid={attemptedRealign && !realignForm.amount}
                    type="number"
                    min="0"
                    step="0.01"
                    value={realignForm.amount}
                    onChange={(e) => setRealignForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                {realignTarget === "existing" ? (
                  <div>
                    <FieldLabel required>To Line Item</FieldLabel>
                    <Select
                      value={realignForm.to_line_item}
                      onValueChange={(v) => setRealignForm((f) => ({ ...f, to_line_item: v }))}
                    >
                      <SelectTrigger aria-invalid={attemptedRealign && !realignForm.to_line_item}>
                        <SelectValue placeholder="Destination line item" />
                      </SelectTrigger>
                      <SelectContent>
                        {budget.line_items
                          .filter((li) => String(li.id) !== realignForm.from_line_item)
                          .map((li) => (
                            <SelectItem key={li.id} value={String(li.id)}>
                              {CATEGORY_LABELS[li.category]} — {li.description}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div>
                      <FieldLabel required>New Item Category</FieldLabel>
                      <Select
                        value={realignForm.new_item_category}
                        onValueChange={(v) => setRealignForm((f) => ({ ...f, new_item_category: v }))}
                      >
                        <SelectTrigger aria-invalid={attemptedRealign && !realignForm.new_item_category}>
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
                      <FieldLabel required>New Item Description</FieldLabel>
                      <Input
                        aria-invalid={attemptedRealign && !realignForm.new_item_description.trim()}
                        value={realignForm.new_item_description}
                        onChange={(e) => setRealignForm((f) => ({ ...f, new_item_description: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2 lg:col-span-3">
                  <FieldLabel required>Justification</FieldLabel>
                  <Input
                    aria-invalid={attemptedRealign && !realignForm.justification.trim()}
                    value={realignForm.justification}
                    onChange={(e) => setRealignForm((f) => ({ ...f, justification: e.target.value }))}
                    placeholder="Reason for this fund transfer"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={handleRequestRealignment} disabled={isSavingRealign}>
                  <Plus className="size-4" />
                  {isSavingRealign ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-navy">Budget Realignments</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  {canReviewRealignment && <TableHead className="text-right">Review</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {realignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canReviewRealignment ? 6 : 5} className="p-0">
                      <EmptyState icon={<Receipt className="size-7" />} title="No realignments yet" />
                    </TableCell>
                  </TableRow>
                ) : (
                  realignments.map((r) => {
                    const pending = r.status === "pending_approval" || r.status === "pending_bor";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{lineItemLabel(r.from_line_item)}</TableCell>
                        <TableCell>
                          {r.to_line_item
                            ? lineItemLabel(r.to_line_item)
                            : `New: ${r.new_item_description}`}
                        </TableCell>
                        <TableCell>{peso(r.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{TIER_LABELS[r.tier]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {STATUS_LABELS[r.status]}
                          </Badge>
                        </TableCell>
                        {canReviewRealignment && (
                          <TableCell className="text-right">
                            {pending && canReviewTier(r.tier) ? (
                              <div className="flex flex-col items-end gap-1.5">
                                {r.tier === "bor" && (
                                  <Input
                                    className="h-8 w-44"
                                    placeholder="BOR resolution no."
                                    value={borResolution[r.id] ?? ""}
                                    onChange={(e) =>
                                      setBorResolution((prev) => ({ ...prev, [r.id]: e.target.value }))
                                    }
                                  />
                                )}
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleReview(r, "approved")}
                                    disabled={reviewingId === r.id}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReview(r, "rejected")}
                                    disabled={reviewingId === r.id}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            ) : pending ? (
                              <span className="text-xs text-muted-foreground">
                                Awaiting {r.tier === "bor" ? "System Admin" : "University Admin or System Admin"}
                              </span>
                            ) : (
                              "—"
                            )}
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
    </div>
  );
}

export default function DisbursementsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Disbursements & Realignments">
        <DisbursementsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
