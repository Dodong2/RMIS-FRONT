import { useEffect, useState } from "react";
import { researchApi } from "./researchApi";

/** The three system Funding Types (Program.FUNDING_CHOICES); shown until the admin's list loads, and if it can't. */
const SYSTEM_LABELS: Record<string, string> = {
  institutional: "Institutional (LSPU-Funded)",
  core_funded: "Core-Funded (Self-Funded)",
  externally_funded: "Externally-Funded",
};

let cache: Promise<Record<string, string>> | null = null;

const load = () =>
  (cache ??= researchApi
    .getChoices("funding-types")
    .then((rows) => ({ ...SYSTEM_LABELS, ...Object.fromEntries(rows.map((r) => [r.code ?? "", r.name])) }))
    .catch(() => {
      cache = null;
      return SYSTEM_LABELS;
    }));

/** Call after the System Admin changes the list so the next page load re-reads it. */
export const resetFundingTypes = () => {
  cache = null;
};

/** System Admin > Funding Types (client meeting 2026-10-14): `options` for dropdowns, `label(code)` for display. */
export function useFundingTypes() {
  const [labels, setLabels] = useState(SYSTEM_LABELS);
  useEffect(() => {
    let live = true;
    load().then((l) => live && setLabels(l));
    return () => {
      live = false;
    };
  }, []);
  return { options: Object.entries(labels), label: (code: string) => labels[code] ?? code };
}
