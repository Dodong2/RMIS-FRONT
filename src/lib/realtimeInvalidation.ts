import type { QueryKey } from "@tanstack/react-query";
import { queryKeys } from "./queries";

/** Real-time signals that only need React Query data refetched; pages with their own loaders still use useRealtime. */
export const REALTIME_REFETCH: Record<string, QueryKey[]> = {
  "budget.lib.updated": [queryKeys.budgets(), queryKeys.budgetSummaries, queryKeys.projects, queryKeys.financialAll],
  "financial.realignment.created": [queryKeys.financialAll, queryKeys.budgets()],
  "financial.realignment.reviewed": [queryKeys.financialAll, queryKeys.budgets(), queryKeys.budgetSummaries],
};

export const REALTIME_REFETCH_EVENTS = Object.keys(REALTIME_REFETCH);

/** The query keys to refetch for these event types, once each; every mapped key when `all` (after a reconnect). */
export function keysToRefetch(types: Iterable<string>, all = false): QueryKey[] {
  const wanted = all ? REALTIME_REFETCH_EVENTS : [...types];
  const keys = new Map<string, QueryKey>();
  for (const type of wanted) for (const key of REALTIME_REFETCH[type] ?? []) keys.set(JSON.stringify(key), key);
  return [...keys.values()];
}
