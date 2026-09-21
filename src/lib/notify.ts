import { toast } from "sonner";

export const notify = {
  success: (message: string) => toast.success(message, { id: message }),
  error: (message: string) => toast.error(message, { id: message }),
  warning: (message: string) => toast.warning(message, { id: message }),
  info: (message: string) => toast.info(message, { id: message }),
};
