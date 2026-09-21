import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
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
    <details className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-xs [&::-webkit-details-marker]:hidden">
        <span className={value.length === 0 ? "text-muted-foreground" : "truncate"}>{summary}</span>
        <ChevronDown className="size-4 shrink-0 opacity-50 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute z-50 mt-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
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
      </div>
    </details>
  );
}
