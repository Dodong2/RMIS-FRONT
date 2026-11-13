import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { LineItemBudget } from "../types/budget";
import { queryKeys } from "./queries";
import { putLib } from "./useReviewStep";

const lib = (id: number, status: string) => ({ id, status }) as unknown as LineItemBudget;

describe("putLib (Task 59): the saved LIB replaces the cached one at once", () => {
  it("updates every budgets list that holds the LIB and leaves the others alone", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.budgets(), [lib(1, "submitted"), lib(2, "submitted")]);
    client.setQueryData(queryKeys.budgets(5), [lib(1, "submitted")]);
    client.setQueryData(queryKeys.budgets(6), [lib(3, "draft")]);

    putLib(client, lib(1, "for_budget_review"));

    expect(client.getQueryData<LineItemBudget[]>(queryKeys.budgets())!.map((b) => b.status)).toEqual(["for_budget_review", "submitted"]);
    expect(client.getQueryData<LineItemBudget[]>(queryKeys.budgets(5))![0].status).toBe("for_budget_review");
    expect(client.getQueryData<LineItemBudget[]>(queryKeys.budgets(6))![0].status).toBe("draft");
  });
});
