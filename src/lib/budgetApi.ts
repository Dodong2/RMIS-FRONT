import { apiClient } from "./apiClient";
import { downloadReport } from "./reportsApi";
import type { BudgetStep, FinanceEditRow, LibAllocation, LibItem, LibItemInput, LineItem, LineItemBudget, LineItemCategory } from "../types/budget";

export const budgetApi = {
  getBudgets: async (project?: number): Promise<LineItemBudget[]> => {
    const { data } = await apiClient.get("/api/budget/budgets/", {
      params: project ? { project } : {},
    });
    return data;
  },
  getBudget: async (id: number): Promise<LineItemBudget> => {
    const { data } = await apiClient.get(`/api/budget/budgets/${id}/`);
    return data;
  },
  createBudget: async (project: number): Promise<LineItemBudget> => {
    const { data } = await apiClient.post("/api/budget/budgets/", { project });
    return data;
  },
  /** One step of the LIB review workflow (client 2026-10-21); "hold" needs remarks. */
  reviewBudget: async (id: number, step: BudgetStep, remarks = ""): Promise<LineItemBudget> => {
    const { data } = await apiClient.post(`/api/budget/budgets/${id}/${step}/`, { remarks });
    return data;
  },

  /** Task 20: the LIB as saved, in the Download LIB Template layout (GET budgets/<id>/export/). */
  downloadLib: (id: number) => downloadReport(`/api/budget/budgets/${id}/export/`, {}, "LIB.xlsx"),
  /** Task 20: Update This LIB, existing items only, a reason per changed item. */
  financeEdit: async (id: number, items: FinanceEditRow[]): Promise<LineItemBudget> => {
    const { data } = await apiClient.post(`/api/budget/budgets/${id}/finance-edit/`, { items });
    return data;
  },

  getLineItems: async (
    params: { budget?: number; project?: number; is_app_flagged?: boolean } = {},
  ): Promise<LineItem[]> => {
    const { data } = await apiClient.get("/api/budget/line-items/", { params });
    return data;
  },
  createLineItem: async (payload: {
    budget: number;
    category: LineItemCategory;
    description: string;
    amount: string;
    unit?: string;
    quantity?: string;
    unit_cost?: string;
    fiscal_year?: number | null;
    funding_source?: string;
    is_counterpart?: boolean;
    justification?: string;
    allocations?: LibAllocation[];
  }): Promise<LineItem> => {
    const { data } = await apiClient.post("/api/budget/line-items/", payload);
    return data;
  },
  updateLineItem: async (
    id: number,
    payload: Partial<{ category: LineItemCategory; description: string; amount: string }>,
  ): Promise<LineItem> => {
    const { data } = await apiClient.patch(`/api/budget/line-items/${id}/`, payload);
    return data;
  },
  deleteLineItem: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/budget/line-items/${id}/`);
  },
  getLibItems: async (): Promise<LibItem[]> => {
    const { data } = await apiClient.get("/api/budget/lib-items/");
    return data;
  },
  createLibItem: async (payload: LibItemInput): Promise<LibItem> => {
    const { data } = await apiClient.post("/api/budget/lib-items/", payload);
    return data;
  },
  updateLibItem: async (id: number, payload: Partial<LibItemInput>): Promise<LibItem> => {
    const { data } = await apiClient.patch(`/api/budget/lib-items/${id}/`, payload);
    return data;
  },
  deleteLibItem: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/budget/lib-items/${id}/`);
  },
};
