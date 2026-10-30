import { apiClient, idempotent } from "./apiClient";
import type { BudgetRealignment, BudgetSummary, Disbursement, ProcurementBalance, ProcurementRequest, ProcurementStatus, ProcurementUpdateStatus } from "../types/financial";

export const financialApi = {
  getDisbursements: async (
    params: { line_item?: number; budget?: number; project?: number; from?: string; to?: string } = {},
  ): Promise<Disbursement[]> => {
    const { data } = await apiClient.get("/api/financial/disbursements/", { params });
    return data;
  },
  createDisbursement: async (payload: {
    line_item: number;
    amount: string;
    reference_number?: string;
    description?: string;
    payee?: string;
    supporting_document?: number | null;
    disbursed_on: string;
  }, idempotencyKey?: string): Promise<Disbursement> => {
    const { data } = await apiClient.post("/api/financial/disbursements/", payload, idempotent(idempotencyKey));
    return data;
  },

  getRealignments: async (budget?: number): Promise<BudgetRealignment[]> => {
    const { data } = await apiClient.get("/api/financial/realignments/", {
      params: budget ? { budget } : {},
    });
    return data;
  },
  /** One submission, several realignments (saved all-or-nothing under one batch). */
  createRealignments: async (
    rows: {
      from_line_item: number;
      to_line_item?: number | null;
      new_item_category?: string;
      new_item_description?: string;
      amount: string;
      justification: string;
    }[],
    idempotencyKey?: string,
  ): Promise<BudgetRealignment[]> => {
    const { data } = await apiClient.post("/api/financial/realignments/", rows, idempotent(idempotencyKey));
    return data;
  },
  reviewRealignment: async (
    id: number,
    payload: { decision: "approved" | "rejected" },
  ): Promise<BudgetRealignment> => {
    const { data } = await apiClient.post(`/api/financial/realignments/${id}/review/`, payload);
    return data;
  },

  getProcurementRequests: async (
    params: { project?: number; status?: ProcurementStatus; project_year?: number; fiscal_year?: number; quarter?: number; overdue?: boolean; active?: boolean } = {},
  ): Promise<ProcurementRequest[]> => {
    const { overdue, active, ...rest } = params;
    const { data } = await apiClient.get("/api/financial/procurement-requests/", {
      params: { ...rest, ...(overdue ? { overdue: "true" } : {}), ...(active ? { active: "true" } : {}) },
    });
    return data;
  },
  createProcurementRequest: async (payload: {
    line_item: number;
    description: string;
    amount: string;
    project_year: number;
    quarter: number | null;
    remarks?: string;
  }, idempotencyKey?: string): Promise<ProcurementRequest> => {
    const { data } = await apiClient.post("/api/financial/procurement-requests/", payload, idempotent(idempotencyKey));
    return data;
  },
  receiveProcurementRequest: async (id: number): Promise<ProcurementRequest> => {
    const { data } = await apiClient.post(`/api/financial/procurement-requests/${id}/receive/`);
    return data;
  },
  updateProcurementStatus: async (id: number, status: ProcurementUpdateStatus, remarks?: string): Promise<ProcurementRequest> => {
    const { data } = await apiClient.post(`/api/financial/procurement-requests/${id}/status/`, { status, remarks });
    return data;
  },
  payProcurementRequest: async (id: number, payload: { paid_on: string; reference_number: string }): Promise<ProcurementRequest> => {
    const { data } = await apiClient.post(`/api/financial/procurement-requests/${id}/pay/`, payload);
    return data;
  },
  getProcurementBalance: async (lineItem: number): Promise<ProcurementBalance> => {
    const { data } = await apiClient.get("/api/financial/procurement-balance/", { params: { line_item: lineItem } });
    return data;
  },
  resubmitProcurementRequest: async (
    id: number,
    payload: { description: string; amount: string; project_year: number; quarter: number | null; remarks?: string },
  ): Promise<ProcurementRequest> => {
    const { data } = await apiClient.post(`/api/financial/procurement-requests/${id}/resubmit/`, payload);
    return data;
  },

  getBudgetSummary: async (budgetId: number): Promise<BudgetSummary> => {
    const { data } = await apiClient.get(`/api/financial/budgets/${budgetId}/summary/`);
    return data;
  },
};
