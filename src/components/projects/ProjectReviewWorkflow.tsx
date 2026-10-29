import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { libActions, type LibAction } from "../../lib/libWorkflow";
import { notify } from "../../lib/notify";
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_STYLE, assignedReviewer, currentLib, leaderSubmitLabel, reviewHistory, reviewQueues } from "../../lib/projectReview";
import { documentsQuery } from "../../lib/queries";
import { useReviewStep } from "../../lib/useReviewStep";
import type { LineItemBudget } from "../../types/budget";
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
  const queues = reviewQueues(projects);
  const rows = projects.filter((p) => filter === "all" || p.review_status === filter);
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
              ["Reviews completed", queues.completed],
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
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ReviewStatus | "all")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none"
            aria-label="Review status"
          >
            <option value="all">All review statuses</option>
            {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((s) => (
              <option key={s} value={s}>{REVIEW_STATUS_LABELS[s]}</option>
            ))}
          </select>
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
                    <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">No projects with this review status.</td>
                  </tr>
                )}
                {rows.map((project) => {
                  const lib = currentLib(budgets, project.id);
                  const reviews = lib?.reviews ?? [];
                  const reviewer = assignedReviewer(project.review_status, project, reviews);
                  const last = reviews.at(-1)?.acted_at ?? lib?.created_at ?? project.created_at;
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
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedId(project.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:border-[#0891b2] hover:text-[#0891b2]"
                          style={{ color: "#0d2a5e" }}
                        >
                          Open review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}

function ReviewModal({ project, budgets, userId, roleCode, onClose }: { project: Project; budgets: LineItemBudget[]; userId?: number; roleCode: string; onClose: () => void }) {
  const [returning, setReturning] = useState(false);
  const [justification, setJustification] = useState("");
  const step = useReviewStep();
  const documents = useQuery(documentsQuery({ project: project.id })).data ?? [];
  const lib = currentLib(budgets, project.id);
  const reviews = lib?.reviews ?? [];
  const reviewer = assignedReviewer(project.review_status, project, reviews);
  const history = reviewHistory(reviews);
  const lastComment = [...reviews].reverse().find((r) => r.remarks)?.remarks;
  const viewer = { isOwnLeader: userId !== undefined && project.lead === userId, canEndorse: ENDORSE_ROLE_CODES.includes(roleCode), canCertify: CERTIFY_ROLE_CODES.includes(roleCode) };
  const actions = lib ? libActions(lib.status, viewer) : [];
  const hold = actions.find((a) => a.step === "hold");
  const leaderLabel = leaderSubmitLabel(project.review_status);
  const take = (a: LibAction, remarks = "") =>
    step.mutate({ budget: lib!.id, step: a.step, remarks, done: a.step === "submit" ? "Project proposal submitted to the CRC Chair." : a.done }, {
      onSuccess: () => {
        setReturning(false);
        setJustification("");
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
          </div>
          <button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close workflow detail">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            </svg>
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
                    <p className="mt-1 truncate text-[10px] text-slate-500">{d.file_name}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold" style={{ color: "#0d2a5e" }}>LIB version history</p>
              <div className="mt-3 space-y-2">
                {budgets.length === 0 && <p className="text-xs text-slate-400">No Line-Item Budget yet. Prepare it under Budget Management.</p>}
                {[...budgets].sort((a, b) => b.version_number - a.version_number).map((b) => (
                  <div key={b.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex justify-between gap-2 text-xs">
                      <strong>Version {b.version_number}</strong>
                      <span className="shrink-0 text-slate-400">{when(b.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Proposed Line-Item Budget · {peso(b.total_amount)}
                      {b.reviews.some((r) => r.action === "resubmitted") ? ` · resubmitted ${b.reviews.filter((r) => r.action === "resubmitted").length}×` : ""}
                    </p>
                  </div>
                ))}
              </div>
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
                    onClick={async () => {
                      if (a.step === "submit" && !(await notify.confirm("Submit this project to the CRC Chair? You can't edit it until it is returned for revision.", "Submit"))) return;
                      take(a);
                    }}
                    className={`rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50 ${a.step === "submit" || a.step === "resubmit" ? "hover:bg-[#1a3f7a]" : "hover:bg-emerald-700"}`}
                    style={{ background: a.step === "submit" || a.step === "resubmit" ? "#0d2a5e" : "#059669" }}
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
      </div>
    </div>,
    document.body,
  );
}
