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
