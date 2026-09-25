import { reportsApi } from "./reportsApi";
import type { CatalogFormat, ReportParam } from "./reportCatalog";

export type ReportParams = Partial<Record<ReportParam, string>>;

export async function runServerReport(id: string, p: ReportParams, file_format: CatalogFormat) {
  const scope = { campus: p.campus || undefined, funding_type: p.funding_type || undefined, file_format };
  switch (id) {
    case "appendix_e":
      return reportsApi.downloadAppendixE(Number(p.project), file_format);
    case "appendix_f":
      return reportsApi.downloadAppendixF(Number(p.project), file_format);
    case "appendix_g":
      return reportsApi.downloadAppendixG({ campus: p.campus || undefined, year: p.year || undefined, file_format });
    case "project_list":
      return reportsApi.downloadProjectList({ ...scope, status: p.status || undefined, rei_thrust: p.rei_thrust || undefined, year: p.year || undefined });
    case "financial":
    case "compliance":
    case "personnel":
    case "outputs":
      return reportsApi.downloadModule(id, scope);
  }
  throw new Error(`Unknown report ${id}`);
}
