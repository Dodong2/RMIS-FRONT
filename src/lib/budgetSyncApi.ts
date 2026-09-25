import { apiClient } from "./apiClient";
import type { BudgetOfficeImport, BudgetOfficeRecord, Reconciliation } from "../types/budgetSync";

export const budgetSyncApi = {
  getImports: async (): Promise<BudgetOfficeImport[]> => {
    const { data } = await apiClient.get("/api/budget-sync/imports/");
    return data;
  },
  uploadImport: async (file: File): Promise<BudgetOfficeImport> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post("/api/budget-sync/imports/", form);
    return data;
  },
  getRecords: async (params: { import?: number; linked?: boolean } = {}): Promise<BudgetOfficeRecord[]> => {
    const { linked, ...rest } = params;
    const { data } = await apiClient.get("/api/budget-sync/records/", {
      params: { ...rest, ...(linked === undefined ? {} : { linked: String(linked) }) },
    });
    return data;
  },
  linkRecord: async (id: number, project: number | null): Promise<BudgetOfficeRecord> => {
    const { data } = await apiClient.patch(`/api/budget-sync/records/${id}/`, { project });
    return data;
  },
  getReconciliation: async (importId?: number): Promise<Reconciliation | null> => {
    try {
      const { data } = await apiClient.get("/api/budget-sync/reconciliation/", {
        params: importId ? { import: importId } : {},
      });
      return data;
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) return null;
      throw err;
    }
  },
};
