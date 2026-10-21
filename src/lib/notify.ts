import { toast } from "sonner";

const STAYS = { duration: Infinity };
const CLOSES = { duration: 5000 };

export const notify = {
  success: (message: string) => toast.success(message, { id: message, ...CLOSES }),
  error: (message: string) => toast.error(message, { id: message, ...STAYS }),
  warning: (message: string) => toast.warning(message, { id: message, ...STAYS }),
  info: (message: string) => toast.info(message, { id: message, ...CLOSES }),
  /** Toast with Confirm/Cancel instead of the browser's confirm() (client 2026-10-21). Resolves false when closed. */
  confirm: (message: string, confirmLabel = "Delete") =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      toast.warning(message, {
        ...STAYS,
        action: { label: confirmLabel, onClick: () => settle(true) },
        cancel: { label: "Cancel", onClick: () => settle(false) },
        onDismiss: () => settle(false),
        onAutoClose: () => settle(false),
        classNames: {
          actionButton: "bg-[#dc2626]! text-white! font-bold! rounded-lg! px-3! h-8! hover:bg-[#b91c1c]!",
          cancelButton: "bg-white! text-[#475569]! border! border-[#e2e8f0]! font-semibold! rounded-lg! px-3! h-8! hover:bg-[#f1f5f9]!",
        },
      });
    }),
};
