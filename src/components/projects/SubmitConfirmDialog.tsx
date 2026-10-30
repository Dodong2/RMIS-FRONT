import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const LEADER_WARNING = "Once you continue this submission, you cannot edit your proposal.";
const LEADER_NOTE = "It goes to the CRC/CRD of your campus for review. You can edit it again only if it is returned for revision.";

/** Task 16 (2026-10-30): the decision before a proposal goes to the CRC/CRD (submit or resubmit). A real modal, on top
 * of whatever opened it; Cancel closes only this one. Task 19: the CRC/CRD's Mark for checking reuses it with its own
 * wording. */
export function SubmitConfirmDialog({ open, action, pending, onCancel, onConfirm, warning = LEADER_WARNING, note = LEADER_NOTE, confirmLabel = "Submit" }: {
  open: boolean;
  action: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  warning?: string;
  note?: string;
  confirmLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ color: "#0d2a5e" }}>{action}?</DialogTitle>
          <DialogDescription className="font-semibold" style={{ color: "#b91c1c" }}>
            {warning}
          </DialogDescription>
        </DialogHeader>
        {note && <p className="text-sm" style={{ color: "#475569" }}>{note}</p>}
        <DialogFooter>
          <button onClick={onCancel} disabled={pending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={pending} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {pending ? "Submitting…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
