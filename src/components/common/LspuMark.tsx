import { cn } from "@/lib/utils";

/**
 * Placeholder wordmark until the real seal asset is dropped in.
 * Replace the inner <span> with <img src="/lspu-seal.png" alt="" /> once you add
 * the file to /public — keep the same wrapper so spacing does not shift.
 */
export function LspuMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-white font-extrabold tracking-tight text-navy",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.3 }}
      aria-hidden="true"
    >
      LSPU
    </span>
  );
}