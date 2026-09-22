import { apiClient } from "./apiClient";
import type { BudgetRealignment, BudgetSummary, Disbursement } from "../types/financial";

export const financialApi = {
  getDisbursements: async (params: { line_item?: number; budget?: number } = {}): Promise<Disbursement[]> => {
    const { data } = await apiClient.get("/api/financial/disbursements/", { params });
    return data;
  },
  createDisbursement: async (payload: {
    line_item: number;
    amount: string;
    reference_number?: string;
    description?: string;
    disbursed_on: string;
  }): Promise<Disbursement> => {
    const { data } = await apiClient.post("/api/financial/disbursements/", payload);
    return data;
  },

  getRealignments: async (budget?: number): Promise<BudgetRealignment[]> => {
    const { data } = await apiClient.get("/api/financial/realignments/", {
      params: budget ? { budget } : {},
    });
    return data;
  },
  createRealignment: async (payload: {
    from_line_item: number;
    to_line_item?: number | null;
    new_item_category?: string;
    new_item_description?: string;
    amount: string;
    justification: string;
  }): Promise<BudgetRealignment> => {
    const { data } = await apiClient.post("/api/financial/realignments/", payload);
    return data;
  },
  reviewRealignment: async (
    id: number,
    payload: { decision: "approved" | "rejected"; bor_resolution_number?: string },
  ): Promise<BudgetRealignment> => {
    const { data } = await apiClient.post(`/api/financial/realignments/${id}/review/`, payload);
    return data;
  },

  getBudgetSummary: async (budgetId: number): Promise<BudgetSummary> => {
    const { data } = await apiClient.get(`/api/financial/budgets/${budgetId}/summary/`);
    return data;
  },
};
