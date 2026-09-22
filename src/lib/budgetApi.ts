import { apiClient } from "./apiClient";
import type { LineItem, LineItemBudget, LineItemCategory } from "../types/budget";

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
  certifyBudget: async (id: number): Promise<LineItemBudget> => {
    const { data } = await apiClient.post(`/api/budget/budgets/${id}/certify/`);
    return data;
  },

  getLineItems: async (budget?: number): Promise<LineItem[]> => {
    const { data } = await apiClient.get("/api/budget/line-items/", {
      params: budget ? { budget } : {},
    });
    return data;
  },
  createLineItem: async (payload: {
    budget: number;
    category: LineItemCategory;
    description: string;
    amount: string;
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
};
