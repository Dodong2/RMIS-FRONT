import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { libItemsQuery } from "../../lib/queries";
import type { LineItemCategory } from "../../types/budget";

export function LibItemSelect({ category, value, onChange, className, style, ariaLabel }: {
  category: LineItemCategory | "";
  value: string;
  onChange: (name: string) => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const { data, isLoading } = useQuery(libItemsQuery);
  const items = (data ?? []).filter((i) => i.is_active && i.category === category);
  const unlisted = !!value && !items.some((i) => i.name === value);
  const placeholder = !category
    ? "Select the class first"
    : isLoading
      ? "Loading items..."
      : items.length
        ? "Select item..."
        : "No items yet, ask the System Admin to add them";

  return (
    <select aria-label={ariaLabel} className={className} style={style} value={value} onChange={(e) => onChange(e.target.value)} disabled={!category}>
      <option value="">{placeholder}</option>
      {unlisted && <option value={value}>{value} (not in LIB Items)</option>}
      {items.map((i) => (
        <option key={i.id} value={i.name}>{i.name}</option>
      ))}
    </select>
  );
}
