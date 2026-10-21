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
      });
    }),
};
