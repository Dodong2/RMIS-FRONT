import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info";

const TONE = {
  error: {
    Icon: AlertTriangle,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
  },
  success: {
    Icon: CheckCircle2,
    className: "border-lspu-green/30 bg-lspu-green/5 text-lspu-green",
  },
  info: {
    Icon: Info,
    className: "border-navy/20 bg-secondary text-navy",
  },
} satisfies Record<Tone, { Icon: React.ElementType; className: string }>;

/**
 * Errors say what happened and what to do about it — never just "Error".
 * Renders nothing when there is no message, so callers can drop it in directly.
 */
export function FormAlert({
  tone = "error",
  message,
  className,
}: {
  tone?: Tone;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  const { Icon, className: toneClass } = TONE[tone];

  return (
    <Alert
      role={tone === "error" ? "alert" : "status"}
      className={cn("items-start gap-2.5 py-2.5", toneClass, className)}
    >
      <Icon className="size-4 shrink-0 translate-y-px" />
      <AlertDescription className="text-[13px] leading-snug text-inherit">
        {message}
      </AlertDescription>
    </Alert>
  );
}