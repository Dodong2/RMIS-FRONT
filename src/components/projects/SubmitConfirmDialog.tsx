import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Task 16 (2026-10-30): the decision before a proposal goes to the CRC/CRD (submit or resubmit). A real modal, on top
 * of whatever opened it; Cancel closes only this one. */
export function SubmitConfirmDialog({ open, action, pending, onCancel, onConfirm }: { open: boolean; action: string; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ color: "#0d2a5e" }}>{action}?</DialogTitle>
          <DialogDescription className="font-semibold" style={{ color: "#b91c1c" }}>
            Once you continue this submission, you cannot edit your proposal.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm" style={{ color: "#475569" }}>It goes to the CRC/CRD of your campus for review. You can edit it again only if it is returned for revision.</p>
        <DialogFooter>
          <button onClick={onCancel} disabled={pending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={pending} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#0d2a5e" }}>
            {pending ? "Submitting…" : "Submit"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
