import { toast } from "sonner";

const STAYS = { duration: Infinity };
const CLOSES = { duration: 5000 };

export const notify = {
  success: (message: string) => toast.success(message, { id: message, ...CLOSES }),
  error: (message: string) => toast.error(message, { id: message, ...STAYS }),
  warning: (message: string) => toast.warning(message, { id: message, ...STAYS }),
  info: (message: string) => toast.info(message, { id: message, ...CLOSES }),
};
