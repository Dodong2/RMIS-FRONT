import { useState, type CSSProperties } from "react";

/** Digits and one dot, at most 2 decimals: "10,000.505" → "10000.50". */
const toRaw = (text: string) => {
  const [whole, ...rest] = text.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
};

const withCommas = (whole: string) => whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Peso amount input (client follow-up 2026-10-02: long amounts were hard to read without separators).
 * Shows "10,000" while typing and "10,000.00" once the field loses focus; `value`/`onChange` stay the plain
 * number string ("10000.5") that the API expects.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  style,
  placeholder = "0.00",
  ...rest
}: {
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [whole, decimals] = value.split(".");
  const shown =
    value === ""
      ? ""
      : focused
        ? withCommas(whole || "0") + (decimals !== undefined ? `.${decimals}` : "")
        : Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      style={style}
      placeholder={placeholder}
      value={shown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(toRaw(e.target.value))}
      {...rest}
    />
  );
}
