import { apiClient } from "./apiClient";
import type { GeneratedReportLog, ReportFormat } from "../types/reports";

function extractFilename(disposition: unknown, fallback: string): string {
  if (typeof disposition !== "string") return fallback;
  const match = disposition.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
}

async function downloadReport(
  url: string,
  params: Record<string, string | number | undefined>,
  fallbackName: string,
) {
  const response = await apiClient.get(url, { params, responseType: "blob" });
  const filename = extractFilename(response.headers["content-disposition"], fallbackName);
  const blobUrl = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

/** Report errors come back as a JSON body, but axios still delivers it as a Blob
 * because the request used responseType: "blob" — this reads it back out. */
export async function reportErrorMessage(err: unknown, fallback: string): Promise<string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!(data instanceof Blob)) return fallback;
  try {
    const parsed = JSON.parse(await data.text());
    return typeof parsed.detail === "string" ? parsed.detail : fallback;
  } catch {
    return fallback;
  }
}

export const reportsApi = {
  downloadAppendixE: (projectId: number, fileFormat: ReportFormat) =>
    downloadReport(`/api/reports/appendix-e/${projectId}/`, { file_format: fileFormat }, `appendix_e.${fileFormat}`),
  downloadAppendixF: (projectId: number, fileFormat: ReportFormat) =>
    downloadReport(`/api/reports/appendix-f/${projectId}/`, { file_format: fileFormat }, `appendix_f.${fileFormat}`),
  downloadAppendixG: (params: { campus?: string; year?: string; file_format: ReportFormat }) =>
    downloadReport("/api/reports/appendix-g/", params, `appendix_g.${params.file_format}`),
  downloadProjectList: (params: {
    campus?: string;
    funding_type?: string;
    status?: string;
    rei_thrust?: string;
    year?: string;
    file_format: ReportFormat;
  }) => downloadReport("/api/reports/projects/", params, `project_list.${params.file_format}`),
  getLogs: async (): Promise<GeneratedReportLog[]> => {
    const { data } = await apiClient.get("/api/reports/logs/");
    return data;
  },
};
