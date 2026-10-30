import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { editChangeLines } from "../../lib/projectReview";
import type { LineItem } from "../../types/budget";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Task 20 (2026-10-30): the Project Leader's yellow Attention icon beside a line item Finance/Accounting/Budget
 * changed; it opens every recorded change, newest first. Render it only for the project's own leader. */
export function LibEditAttention({ item }: { item: LineItem }) {
  const [open, setOpen] = useState(false);
  if (!item.edits?.length) return null;
  const label = `${item.description} was changed by Finance/Accounting/Budget. View the changes.`;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex shrink-0 rounded-md p-0.5 align-middle hover:bg-amber-100" title={label} aria-label={label}>
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: "#0d2a5e" }}>Changes to {item.description}</DialogTitle>
            <DialogDescription>Made by Finance/Accounting/Budget to this line item, newest first.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {[...item.edits].reverse().map((edit) => (
              <div key={edit.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                <p className="text-[10px] text-slate-500">{when(edit.edited_at)}</p>
                <ul className="mt-1 space-y-1">
                  {editChangeLines(edit).map((line) => (
                    <li key={line.field} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-700">{line.field}:</span>
                      <span className="text-slate-500 line-through">{line.before}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-amber-600" aria-label="changed to" />
                      <span className="font-semibold text-slate-800">{line.after}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2"><span className="font-bold text-slate-700">Edited by:</span> {edit.edited_by_name}</p>
                <p><span className="font-bold text-slate-700">Reason:</span> {edit.reason}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
