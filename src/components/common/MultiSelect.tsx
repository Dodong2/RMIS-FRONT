import { ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";

interface Option {
  value: string;
  label: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  invalid?: boolean;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const summary =
    value.length === 0
      ? placeholder
      : value.length <= 3
        ? options
            .filter((o) => value.includes(o.value))
            .map((o) => o.label.split(" — ")[0])
            .join(", ")
        : `${value.length} selected`;

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-invalid={invalid}
        className={`flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 text-sm shadow-xs ${
          invalid ? "border-destructive ring-[3px] ring-destructive/20" : "border-input"
        }`}
      >
        <span className={value.length === 0 ? "text-muted-foreground" : "truncate"}>{summary}</span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 w-(--radix-popover-trigger-width) min-w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ maxHeight: "min(16rem, var(--radix-popover-content-available-height))" }}
        >
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={value.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="size-4"
              />
              {o.label}
            </label>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
