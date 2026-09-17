import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoogleButton({
  label,
  onClick,
  isPending,
  disabled,
}: {
  label: string;
  onClick: () => void;
  isPending?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2.5"
      onClick={onClick}
      disabled={disabled || isPending}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <GoogleGlyph className="size-4" />
      )}
      {isPending ? "Opening Google…" : label}
    </Button>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.4 6.65v5.52h7.12c4.16-3.83 6.56-9.47 6.56-16.18Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.32l-7.12-5.52c-1.97 1.32-4.49 2.1-7.44 2.1-5.73 0-10.58-3.87-12.31-9.07H4.24v5.7A22 22 0 0 0 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.19a13.2 13.2 0 0 1 0-8.38v-5.7H4.24a22 22 0 0 0 0 19.78l7.45-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.92 29.93 1 24 1 15.4 1 7.96 5.93 4.24 14.11l7.45 5.7C13.42 13.37 18.27 9.5 24 9.5Z"
      />
    </svg>
  );
}