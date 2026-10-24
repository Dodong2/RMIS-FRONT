import { useMutation, useQueryClient } from "@tanstack/react-query";
import { budgetApi } from "./budgetApi";
import { errorMessage } from "./errorMessage";
import type { LibAction } from "./libWorkflow";
import { notify } from "./notify";
import { queryKeys } from "./queries";

/** Runs one LIB step (= the project's review step) and refreshes the projects, LIBs and bell. */
export function useReviewStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ budget, step, remarks }: { budget: number; step: LibAction["step"]; remarks?: string; done: string }) =>
      budgetApi.reviewBudget(budget, step, remarks ?? ""),
    onSuccess: (_data, { done }) => {
      notify.success(done);
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError: (err) => notify.error(errorMessage(err, "The step could not be saved.")),
  });
}

