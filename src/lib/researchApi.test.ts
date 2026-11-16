import { afterEach, describe, expect, it, vi } from "vitest";
import type { AxiosProgressEvent } from "axios";
import { apiClient } from "./apiClient";
import { researchApi } from "./researchApi";

afterEach(() => vi.restoreAllMocks());

describe("reviewImport upload progress (client Task 47)", () => {
  it("reports the real transfer % and still reads the review response", async () => {
    const post = vi.spyOn(apiClient, "post").mockImplementation(async (_url, _form, config) => {
      config?.onUploadProgress?.({ loaded: 50, total: 200 } as AxiosProgressEvent);
      config?.onUploadProgress?.({ loaded: 200, total: 200 } as AxiosProgressEvent);
      return { data: { draft: {}, issues: [] } };
    });
    const seen: number[] = [];

    const result = await researchApi.reviewImport(new File(["x"], "a.xlsx"), (p) => seen.push(p));

    expect(seen).toEqual([25, 100]);
    expect(result.issues).toEqual([]);
    expect(post.mock.calls[0][2]?.params).toEqual({ review: 1 });
  });

  it("reports nothing when the browser doesn't know the size, instead of a made-up %", async () => {
    vi.spyOn(apiClient, "post").mockImplementation(async (_url, _form, config) => {
      config?.onUploadProgress?.({ loaded: 50 } as AxiosProgressEvent);
      return { data: { draft: {}, issues: [] } };
    });
    const onProgress = vi.fn();

    await researchApi.reviewImport(new File(["x"], "a.xlsx"), onProgress);

    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe("getProjectHistory (client Task 65-C)", () => {
  it("reads the project's recorded workflow events as the backend orders them", async () => {
    const rows = [
      { at: "2026-11-02T14:38:00+08:00", kind: "status", title: "Certified by Finance/Accounting/Budget — project is Active", actor_name: "B", actor_role: "Finance/Accounting/Budget", remarks: "" },
      { at: "2026-11-02T13:58:00+08:00", kind: "status", title: "Project registered in RMIS", actor_name: "", actor_role: "", remarks: "NTP X" },
    ];
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: rows });

    expect(await researchApi.getProjectHistory(7)).toEqual(rows);
    expect(get).toHaveBeenCalledWith("/api/projects/7/history/");
  });
});
