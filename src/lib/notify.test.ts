import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { notify } from "./notify";

describe("notify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps errors and warnings until the user closes them", () => {
    notify.error("Save failed.");
    notify.warning("Not enough data.");
    expect(toast.error).toHaveBeenCalledWith("Save failed.", expect.objectContaining({ duration: Infinity }));
    expect(toast.warning).toHaveBeenCalledWith("Not enough data.", expect.objectContaining({ duration: Infinity }));
  });

  it("lets success and info close by themselves", () => {
    notify.success("Saved.");
    notify.info("Heads up.");
    expect(toast.success).toHaveBeenCalledWith("Saved.", expect.objectContaining({ duration: 5000 }));
    expect(toast.info).toHaveBeenCalledWith("Heads up.", expect.objectContaining({ duration: 5000 }));
  });

  it("uses the message as the id so a repeated message shows once", () => {
    notify.error("Network error.");
    notify.error("Network error.");
    const ids = toast.error.mock.calls.map(([, options]) => options.id);
    expect(ids).toEqual(["Network error.", "Network error."]);
  });
});
