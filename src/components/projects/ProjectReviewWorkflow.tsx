import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, MessageSquare, Pencil, SquarePen, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "../../lib/errorMessage";
import { libActions, type LibAction } from "../../lib/libWorkflow";
import { notify } from "../../lib/notify";
import { financeEditRow, type UpdateDraft } from "../../lib/projectReview";
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_MEANINGS, REVIEW_STATUS_STYLE, assignedReviewer, currentLib, leaderSubmitLabel, reviewHistory, reviewQueues, rowActions, REVIEW_PAGE_SIZE, matchesProjectSearch, newestFirst } from "../../lib/projectReview";
import { pageOf } from "../../lib/paging";
import { Pager } from "../common/proto";
import { documentsQuery, queryKeys } from "../../lib/queries";
import { researchApi } from "../../lib/researchApi";
import { documentUrl, openDocument } from "../../lib/documentApi";
import { nameOf } from "../../lib/workplan";
import { budgetApi } from "../../lib/budgetApi";
import { reportErrorMessage } from "../../lib/reportsApi";
import { LIB_UNITS } from "../../lib/libUnits";
import { SubmitConfirmDialog } from "./SubmitConfirmDialog";
import { useReviewStep } from "../../lib/useReviewStep";
import type { LineItem, LineItemBudget } from "../../types/budget";
import type { DocumentType } from "../../types/document";
import type { Project, ReviewStatus } from "../../types/research";

const ENDORSE_ROLE_CODES = ["system_admin", "crc_chair"];
const CERTIFY_ROLE_CODES = ["system_admin", "finance_budget"];
const DOC_LABELS: Partial<Record<DocumentType, string>> = {
  notice_of_approval: "Approve Proposal",
  ntp: "Notice to Proceed (NTP)",
  moa: "Memorandum of Agreement (MOA)",
  proposal_form: "Research Proposal Form (SF-018)",
  other: "Supporting document",
};

// Task 19 (2026-10-30): the client's wording for the CRC/CRD forwarding a proposal to Finance/Accounting/Budget
const FORWARD_WARNING =
  "By continuing, you confirm that you have reviewed this proposal and are forwarding it to Finance/Accounting/Budget for budget review and certification. Once submitted, you can no longer add review comments or modify this proposal. This action cannot be undone.";

// Task 20 (2026-10-30): Finance/Accounting/Budget may update a LIB and comment on it only before certification
const BUDGET_REVIEW_STATUSES = ["endorsed", "certifying"];

const peso = (n: string | number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${REVIEW_STATUS_STYLE[status]}`}>
      {REVIEW_STATUS_LABELS[status]}
    </span>
  );
}

/** Client 2026-10-24 (Figma ProjectReviewWorkflow, PL-after-submit.png): review queues, the review table and the
 * Open review modal, on real data. The steps are the client's 2026-10-21 LIB workflow (Carl's D1), so the CRC Chair
 * and Budget Officer get their usual buttons instead of the prototype's single "Review Completed". */
export function ProjectReviewWorkflow({ projects, budgets, userId, roleCode }: { projects: Project[]; budgets: LineItemBudget[]; userId?: number; roleCode: string }) {
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: number) => researchApi.deleteProject(id),
    onSuccess: () => {
      notify.success("Draft proposal deleted.");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
    },
    onError: (err) => notify.error(errorMessage(err, "The draft could not be deleted.")),
  });
  const [search, setSearch] = useState("");
  const queues = reviewQueues(projects);
  const rows = newestFirst(projects).filter((p) => (filter === "all" || p.review_status === filter) && matchesProjectSearch(p, search));
  // Back to page 1 whenever the search or the status filter changes (the UsersListPage pattern)
  const pageKey = `${filter}|${search}`;
  const [pageState, setPageState] = useState({ key: pageKey, n: 1 });
  const shown = pageOf(rows, pageState.key === pageKey ? pageState.n : 1, REVIEW_PAGE_SIZE);
  const selected = projects.find((p) => p.id === selectedId);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              ["Research queue", queues.research],
              ["Budget queue", queues.budget],
              ["Returned", queues.returned],
              ["Active", queues.completed],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black" style={{ color: "#0d2a5e" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Showing {rows.length} workflow record{rows.length === 1 ? "" : "s"}
          </p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, title, leader or campus…"
            aria-label="Search proposals"
            className="ml-auto w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:border-[#0891b2]"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ReviewStatus | "all")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none"
            aria-label="Review status"
            aria-describedby="review-status-meaning"
          >
            <option value="all">All review statuses</option>
            {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((s) => (
              <option key={s} value={s} title={REVIEW_STATUS_MEANINGS[s]}>{REVIEW_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p id="review-status-meaning" className="text-xs text-slate-500">
            {filter === "all" ? "Showing every review status. Pick one to see only those proposals and what it means." : (
              <>
                <ReviewStatusBadge status={filter} /> <span className="ml-1">{REVIEW_STATUS_MEANINGS[filter]}</span>
              </>
            )}
          </p>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold" style={{ color: "#0891b2" }}>What do the statuses mean?</summary>
            <dl className="mt-2 space-y-1.5 rounded-xl border border-slate-200 bg-white p-3">
              {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((s) => (
                <div key={s} className="flex flex-wrap items-start gap-2">
                  <dt><ReviewStatusBadge status={s} /></dt>
                  <dd className="flex-1 min-w-48 text-slate-600">{REVIEW_STATUS_MEANINGS[s]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead className="bg-slate-50">
                <tr>
                  {["Project", "Campus", "Proposed LIB", "Current Status", "Assigned Reviewer", "Last Action", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">No projects match this search or review status.</td>
                  </tr>
                )}
                {shown.rows.map((project) => {
                  const lib = currentLib(budgets, project.id);
                  const reviews = lib?.reviews ?? [];
                  const reviewer = assignedReviewer(project.review_status, project, reviews);
                  const last = reviews.at(-1)?.acted_at ?? lib?.created_at ?? project.created_at;
                  const can = rowActions(project.review_status, { isOwnLeader: userId !== undefined && project.lead === userId, isAdmin: roleCode === "system_admin" });
                  return (
                    <tr key={project.id} className="hover:bg-slate-50">
                      <td className="max-w-xs px-4 py-3">
                        <p className="font-mono text-[10px] font-bold" style={{ color: "#0891b2" }}>{project.project_code}</p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-800">{project.title}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{project.lead_detail?.full_name || project.lead_detail?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {project.campus ? (
                          <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: "#e0f2fe", color: "#0891b2" }}>{project.campus}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{lib ? peso(lib.total_amount) : "No LIB yet"}</td>
                      <td className="px-4 py-3">
                        <ReviewStatusBadge status={project.review_status} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-700">{reviewer.name}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{reviewer.role}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{when(last)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {can.edit && (
                            <button
                              onClick={() => navigate(`/projects/${project.id}/edit`)}
                              title="Edit Project"
                              aria-label={`Edit Project ${project.project_code}`}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#0891b2]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {can.remove && (
                            <button
                              onClick={() => setDeleting(project)}
                              title="Delete Project"
                              aria-label={`Delete Project ${project.project_code}`}
                              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {can.openReview && (
                            <button
                              onClick={() => setSelectedId(project.id)}
                              className="ml-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:border-[#0891b2] hover:text-[#0891b2]"
                              style={{ color: "#0d2a5e" }}
                            >
                              Open review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={shown.page} pageCount={shown.pageCount} total={rows.length} size={REVIEW_PAGE_SIZE} onPage={(n) => setPageState({ key: pageKey, n })} />
        </div>
      </div>

      {selected && (
        <ReviewModal
          project={selected}
          budgets={budgets.filter((b) => b.project === selected.id)}
          userId={userId}
          roleCode={roleCode}
          onClose={() => setSelectedId(null)}
        />
      )}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && !remove.isPending && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "#0d2a5e" }}>Delete this Draft proposal?</DialogTitle>
            <DialogDescription className="font-semibold" style={{ color: "#b91c1c" }}>
              {deleting?.project_code} · {deleting?.title}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm" style={{ color: "#475569" }}>This removes the proposal with its LIB, work plan, team and attached files. It can't be undone.</p>
          <DialogFooter>
            <button onClick={() => setDeleting(null)} disabled={remove.isPending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
              Cancel
            </button>
            <button onClick={() => deleting && remove.mutate(deleting.id)} disabled={remove.isPending} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#dc2626" }}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewModal({ project, budgets, userId, roleCode, onClose }: { project: Project; budgets: LineItemBudget[]; userId?: number; roleCode: string; onClose: () => void }) {
  const [returning, setReturning] = useState(false);
  const [justification, setJustification] = useState("");
  const [confirming, setConfirming] = useState<LibAction | null>(null);
  const [comment, setComment] = useState("");
  const [updating, setUpdating] = useState<"confirm" | "edit" | null>(null);
  const step = useReviewStep();
  const documents = useQuery(documentsQuery({ project: project.id })).data ?? [];
  const lib = currentLib(budgets, project.id);
  const reviews = lib?.reviews ?? [];
  const reviewer = assignedReviewer(project.review_status, project, reviews);
  const history = reviewHistory(reviews);
  const lastComment = [...reviews].reverse().find((r) => r.remarks)?.remarks;
  const viewer = { isOwnLeader: userId !== undefined && project.lead === userId, canEndorse: ENDORSE_ROLE_CODES.includes(roleCode), canCertify: CERTIFY_ROLE_CODES.includes(roleCode) };
  const actions = lib ? libActions(lib.status, viewer) : [];
  // Task 20: the Budget Officer's view of a LIB forwarded to them; "By:" is then the CRC/CRD who forwarded it
  const financeView = viewer.canCertify && !!lib && [...BUDGET_REVIEW_STATUSES, "certified"].includes(lib.status);
  const financeCanChange = financeView && BUDGET_REVIEW_STATUSES.includes(lib!.status);
  const leaderName = nameOf(project.lead_detail);
  const hold = actions.find((a) => a.step === "hold");
  const leaderLabel = leaderSubmitLabel(project.review_status);
  const isSubmit = (a: LibAction) => a.step === "submit" || a.step === "resubmit";
  const isForward = (a: LibAction) => a.step === "for-checking";
  // Task 16: a submit or resubmit closes its confirmation and this review once the backend accepts it; the project
  // list refetches (useReviewStep), so the row shows the new status and no stale modal stays open
  const take = (a: LibAction, remarks = "") =>
    step.mutate({ budget: lib!.id, step: a.step, remarks, done: a.step === "submit" ? "Project proposal submitted to the CRC/CRD." : a.done }, {
      onSuccess: () => {
        setReturning(false);
        setJustification("");
        if (isSubmit(a)) {
          setConfirming(null);
          onClose();
        }
        // Task 19: Open Review stays open, read-only, once the CRC/CRD has forwarded it
        if (isForward(a)) setConfirming(null);
      },
    });
  const close = () => {
    setReturning(false);
    setJustification("");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "rgba(8,26,61,0.6)" }} onClick={close}>
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold" style={{ color: "#0891b2" }}>{project.project_code}</span>
              <ReviewStatusBadge status={project.review_status} />
            </div>
            <p className="mt-2 text-lg font-black" style={{ color: "#0d2a5e" }}>{project.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">By: {financeView ? lib?.endorsed_by_name ?? "CRC/CRD" : leaderName}</p>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close workflow detail" title="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Current status", REVIEW_STATUS_LABELS[project.review_status]],
              ["Assigned reviewer", reviewer.name],
              ["Reviewer role", reviewer.role],
              ["Action date", when(reviews.at(-1)?.acted_at ?? lib?.created_at ?? project.created_at)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Latest review comments</p>
            <p className="mt-1 text-sm text-blue-900">{lastComment || "No review comments yet."}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold" style={{ color: "#0d2a5e" }}>Supporting document history</p>
              <div className="mt-3 space-y-2">
                {documents.length === 0 && <p className="text-xs text-slate-400">No documents uploaded yet.</p>}
                {documents.map((d) => (
                  <div key={d.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex justify-between gap-2 text-xs">
                      <strong>{DOC_LABELS[d.document_type] ?? d.document_type} · Version {d.version_number}</strong>
                      <span className="shrink-0 text-slate-400">{when(d.uploaded_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-[10px] text-slate-500">{d.file_name}</p>
                      <button
                        onClick={() => openDocument(() => documentUrl(d.id))}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-cyan-50"
                        style={{ color: "#0891b2" }}
                        aria-label={`View ${DOC_LABELS[d.document_type] ?? d.document_type} version ${d.version_number}`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold" style={{ color: "#0d2a5e" }}>Submitted Approved Proposal Information</p>
              <dl className="mt-3 space-y-1.5 text-xs">
                {[
                  ["Total project budget", project.total_cost ? peso(project.total_cost) : "—"],
                  ["Project start date", project.start_date ? new Date(`${project.start_date}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"],
                  ["NTP number", project.project_code],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-semibold text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
              <button
                onClick={() => openDocument(() => researchApi.proposalPdfUrl(project.id), "Could not open the proposal information.")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white hover:bg-[#1a3f7a]"
                style={{ background: "#0d2a5e" }}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" /> View Other Information
              </button>
            </div>
          </div>

          <div>
            <p className="font-bold" style={{ color: "#0d2a5e" }}>Transaction history</p>
            {history.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">Not submitted yet. The project is a Draft its Project Leader can still edit.</p>
            ) : (
              <div className="mt-3 space-y-3 border-l-2 border-slate-200 pl-5">
                {history.map((event) => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ring-1" style={{ background: "#0891b2", ["--tw-ring-color" as string]: "#0891b2" }} />
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-800">{event.action}</p>
                        <span className="text-[10px] text-slate-400">{when(event.at)}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{event.actor} · {event.actorRole}</p>
                      <p className="mt-1 text-xs text-slate-600">{event.toStatus}</p>
                      {event.comments && <p className="mt-1 text-xs text-slate-500">{event.comments}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {financeView && (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold" style={{ color: "#0d2a5e" }}>Line-Item Budget</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => budgetApi.downloadLib(lib!.id).catch(async (err) => notify.error(await reportErrorMessage(err, "The LIB could not be downloaded.")))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download LIB
                  </button>
                  {financeCanChange && (
                    <button onClick={() => setUpdating("confirm")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white hover:bg-[#1a3f7a]" style={{ background: "#0d2a5e" }}>
                      <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Update This LIB
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {lib!.line_items.length} line item{lib!.line_items.length === 1 ? "" : "s"} · Grand Total {peso(lib!.total_amount)}
                {lib!.status === "certified" ? " · Certified, read-only" : ""}
              </p>
              {financeCanChange && (
                <div className="mt-3">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400" htmlFor="budget-comment">Review comment</label>
                  <div className="mt-1 flex gap-2">
                    <textarea
                      id="budget-comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      placeholder="Add a comment for the review history..."
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0891b2]"
                    />
                    <button
                      disabled={!comment.trim() || step.isPending}
                      onClick={() => step.mutate({ budget: lib!.id, step: "comment", remarks: comment.trim(), done: "Comment added." }, { onSuccess: () => setComment("") })}
                      className="inline-flex items-center gap-1.5 self-end rounded-lg bg-[#0891b2] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Add comment
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {returning && hold && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <label className="text-xs font-bold text-amber-900" htmlFor="return-justification">
                Required justification for {lib?.status === "endorsed" || lib?.status === "certifying" ? "budget-related revisions" : "research-related revisions"}
              </label>
              <textarea
                id="return-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                placeholder="Describe the required corrections..."
                className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0891b2]"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => { setReturning(false); setJustification(""); }} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500">
                  Cancel
                </button>
                <button
                  disabled={!justification.trim() || step.isPending}
                  onClick={() => take(hold, justification.trim())}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Confirm return and notify
                </button>
              </div>
            </div>
          )}
        </div>

        {!returning && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
            {viewer.isOwnLeader && leaderLabel && !lib && (
              <span className="mr-auto text-xs text-slate-500">Prepare the LIB under Budget Management, then submit the project.</span>
            )}
            {actions
              .filter((a) => a.step !== "hold")
              .map((a) => {
                const label = a.step === "submit" || a.step === "resubmit" ? leaderLabel ?? a.label : a.label;
                return (
                  <button
                    key={a.step}
                    disabled={step.isPending}
                    onClick={() => (isSubmit(a) || isForward(a) ? setConfirming(a) : take(a))}
                    className={`rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50 ${isSubmit(a) ? "hover:bg-[#1a3f7a]" : "hover:bg-emerald-700"}`}
                    style={{ background: isSubmit(a) ? "#0d2a5e" : "#059669" }}
                  >
                    {label}
                  </button>
                );
              })}
            {hold && (
              <button onClick={() => setReturning(true)} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">
                Return for Revision
              </button>
            )}
            {actions.length === 0 && !(viewer.isOwnLeader && leaderLabel && !lib) && (
              <span className="text-xs text-slate-400">No action for you at this stage.</span>
            )}
          </div>
        )}
        {/* Inside the panel that stops clicks, so a click in the (portalled) dialog doesn't reach the backdrop's close */}
        <Dialog open={updating === "confirm"} onOpenChange={(o) => !o && setUpdating(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ color: "#0d2a5e" }}>Update This LIB?</DialogTitle>
              <DialogDescription style={{ color: "#475569" }}>
                Updating this LIB will notify {leaderName} that changes have been made to the project's budget. Do you want to continue?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button onClick={() => setUpdating(null)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
                Exit
              </button>
              <button onClick={() => setUpdating("edit")} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#0d2a5e" }}>
                Continue
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {updating === "edit" && lib && <LibUpdateDialog lib={lib} totalCost={project.total_cost} onClose={() => setUpdating(null)} />}
        {confirming && isForward(confirming) ? (
          <SubmitConfirmDialog
            open
            action="Mark for checking"
            warning={FORWARD_WARNING}
            note=""
            confirmLabel="Confirm Submission"
            pending={step.isPending}
            onCancel={() => setConfirming(null)}
            onConfirm={() => take(confirming)}
          />
        ) : (
          <SubmitConfirmDialog
            open={confirming !== null}
            action={leaderLabel ?? "Submit Project Proposal"}
            pending={step.isPending}
            onCancel={() => setConfirming(null)}
            onConfirm={() => confirming && take(confirming)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

const centavos = (n: number) => Math.round(n * 100) / 100;

function periodsOf(items: LineItem[]) {
  const periods: string[] = [];
  items.forEach((i) => i.allocations.forEach((a) => !periods.includes(a.period) && periods.push(a.period)));
  return periods;
}

function draftOf(item: LineItem): UpdateDraft {
  return {
    specification: item.specification,
    unit: item.unit,
    quantity: item.quantity ?? "",
    unit_cost: item.unit_cost ?? "",
    split: Object.fromEntries(item.allocations.map((a) => [a.period, a.amount])),
    reason: "",
  };
}

/** Update This LIB (Task 20, 2026-10-30): the existing items only (no add, remove or class change), a reason for each
 * changed item; the backend checks the split and the Grand Total again and saves all or nothing. */
function LibUpdateDialog({ lib, totalCost, onClose }: { lib: LineItemBudget; totalCost: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const periods = periodsOf(lib.line_items);
  const [drafts, setDrafts] = useState<Record<number, UpdateDraft>>(() => Object.fromEntries(lib.line_items.map((i) => [i.id, draftOf(i)])));
  const patch = (id: number, p: Partial<UpdateDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const rowTotal = (d: UpdateDraft) => centavos(Number(d.quantity || 0) * Number(d.unit_cost || 0));
  const splitTotal = (d: UpdateDraft) => centavos(periods.reduce((sum, p) => sum + Number(d.split[p] || 0), 0));
  const rows = lib.line_items.map((item) => ({ item, draft: drafts[item.id], change: financeEditRow(item, drafts[item.id], periods) }));
  const changed = rows.filter((r) => r.change);
  const grand = centavos(rows.reduce((sum, r) => sum + rowTotal(r.draft), 0));
  const problems = [
    ...changed.filter((r) => !r.draft.reason.trim()).map((r) => `${r.item.description}: give the reason for the change.`),
    ...rows.filter((r) => periods.length && splitTotal(r.draft) !== rowTotal(r.draft)).map((r) => `${r.item.description}: the periods must add up to ${peso(rowTotal(r.draft))}.`),
    ...(totalCost && grand !== Number(totalCost) ? [`The Grand Total (${peso(grand)}) must equal the Total Project/Study Cost (${peso(totalCost)}).`] : []),
  ];
  const save = useMutation({
    mutationFn: () => budgetApi.financeEdit(lib.id, changed.map((r) => r.change!)),
    onSuccess: () => {
      notify.success("LIB updated. The Project Leader and the CRC/CRD were notified.");
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      onClose();
    },
    onError: (err) => notify.error(errorMessage(err, "The LIB could not be updated.")),
  });
  const input = "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-[#0891b2]";

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: "#0d2a5e" }}>Update This LIB</DialogTitle>
          <DialogDescription>Change the existing line items only. Every changed item needs a reason; items can't be added or removed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map(({ item, draft, change }) => (
            <div key={item.id} className="rounded-xl border p-3" style={{ borderColor: change ? "#f59e0b" : "#e2e8f0", background: change ? "#fffbeb" : "white" }}>
              <p className="text-xs font-bold text-slate-700">
                {item.category.toUpperCase()} · {item.description}
                <span className="ml-2 font-normal text-slate-400">was {peso(item.amount)}</span>
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-5">
                <label className="text-[10px] text-slate-500 md:col-span-2">Specification
                  <input className={input} value={draft.specification} onChange={(e) => patch(item.id, { specification: e.target.value })} />
                </label>
                <label className="text-[10px] text-slate-500">Unit
                  <select className={input} value={draft.unit} onChange={(e) => patch(item.id, { unit: e.target.value })}>
                    {LIB_UNITS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-slate-500">Qty
                  <input className={input} inputMode="decimal" value={draft.quantity} onChange={(e) => patch(item.id, { quantity: e.target.value })} />
                </label>
                <label className="text-[10px] text-slate-500">Unit Cost (₱)
                  <input className={input} inputMode="decimal" value={draft.unit_cost} onChange={(e) => patch(item.id, { unit_cost: e.target.value })} />
                </label>
              </div>
              {periods.length > 0 && (
                <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(periods.length, 8)}, minmax(0, 1fr))` }}>
                  {periods.map((p) => (
                    <label key={p} className="text-[10px] text-slate-500">{p}
                      <input className={input} inputMode="decimal" value={draft.split[p] ?? ""} onChange={(e) => patch(item.id, { split: { ...draft.split, [p]: e.target.value } })} />
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] text-slate-500">Total {peso(rowTotal(draft))}{periods.length ? ` · periods ${peso(splitTotal(draft))}` : ""}</p>
              {change && (
                <label className="mt-2 block text-[10px] font-bold text-amber-800">Reason for the change (required)
                  <textarea className={input} rows={2} value={draft.reason} onChange={(e) => patch(item.id, { reason: e.target.value })} />
                </label>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-700">Grand Total {peso(grand)}{totalCost ? ` · Total Project/Study Cost ${peso(totalCost)}` : ""}</p>
        {changed.length > 0 && problems.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-red-700">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        )}
        <DialogFooter>
          <button onClick={onClose} disabled={save.isPending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
            Exit
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || changed.length === 0 || problems.length > 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#0d2a5e" }}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
