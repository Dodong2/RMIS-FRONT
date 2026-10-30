import { afterEach, describe, expect, it, vi } from "vitest";
import { documentApi, documentUrl, openDocument } from "./documentApi";
import { notify } from "./notify";
import type { ProjectDocument } from "../types/document";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fakeTab() {
  const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
  vi.stubGlobal("window", { open: vi.fn(() => tab) });
  return tab;
}

describe("documentUrl", () => {
  it("returns the document's fresh signed URL", async () => {
    vi.spyOn(documentApi, "getDocument").mockResolvedValue({ download_url: "https://signed/ntp.pdf" } as ProjectDocument);
    await expect(documentUrl(7)).resolves.toBe("https://signed/ntp.pdf");
  });

  it("treats a missing file as an error instead of a broken link", async () => {
    vi.spyOn(documentApi, "getDocument").mockResolvedValue({ download_url: null } as unknown as ProjectDocument);
    await expect(documentUrl(7)).rejects.toThrow("This file is missing or can't be opened right now.");
  });
});

describe("openDocument", () => {
  it("opens the URL in the new tab without an opener", async () => {
    const tab = fakeTab();
    await openDocument(async () => "https://signed/ntp.pdf");
    expect(tab.location.href).toBe("https://signed/ntp.pdf");
    expect(tab.opener).toBeNull();
  });

  it("closes the tab and says why when the file can't be opened", async () => {
    const tab = fakeTab();
    const error = vi.spyOn(notify, "error").mockImplementation(() => "");
    await openDocument(() => Promise.reject(new Error("This file is missing or can't be opened right now.")));
    expect(tab.close).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("This file is missing or can't be opened right now.");
  });

  it("uses the server's reason, or the fallback, for a failed request", async () => {
    fakeTab();
    const error = vi.spyOn(notify, "error").mockImplementation(() => "");
    const denied = Object.assign(new Error("Request failed with status code 404"), { response: { status: 404, data: { detail: "Not found." } } });
    await openDocument(() => Promise.reject(denied));
    const blob = Object.assign(new Error("Request failed with status code 404"), { response: { status: 404, data: {} } });
    await openDocument(() => Promise.reject(blob), "Could not open the proposal information.");
    expect(error.mock.calls).toEqual([["Not found."], ["Could not open the proposal information."]]);
  });
});
