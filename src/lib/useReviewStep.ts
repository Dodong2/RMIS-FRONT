import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { LineItemBudget } from "../types/budget";
import { budgetApi } from "./budgetApi";
import { errorMessage } from "./errorMessage";
import type { LibAction } from "./libWorkflow";
import { notify } from "./notify";
import { queryKeys } from "./queries";

/** Task 59: puts the LIB the backend just saved into every cached budgets list, so the action buttons follow its new
 * status with the toast instead of after the slow list refetch. */
export function putLib(queryClient: QueryClient, saved: LineItemBudget) {
  queryClient.setQueriesData<LineItemBudget[]>({ queryKey: queryKeys.budgets() }, (old) =>
    Array.isArray(old) ? old.map((b) => (b.id === saved.id ? saved : b)) : old,
  );
}

/** Runs one LIB step (= the project's review step) and refreshes the projects, LIBs and bell. */
export function useReviewStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ budget, step, remarks }: { budget: number; step: LibAction["step"]; remarks?: string; done: string }) =>
      budgetApi.reviewBudget(budget, step, remarks ?? ""),
    onSuccess: (saved, { done }) => {
      putLib(queryClient, saved);
      notify.success(done);
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError: (err) => notify.error(errorMessage(err, "The step could not be saved.")),
  });
}
