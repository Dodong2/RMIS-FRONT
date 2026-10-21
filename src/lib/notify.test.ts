import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
type ConfirmOptions = { action: { label: string; onClick: () => void }; cancel: { onClick: () => void }; onDismiss: () => void };
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

  it("confirm resolves true on the action and false on Cancel or close", async () => {
    const yes = notify.confirm('Delete "Laptop"?');
    const [message, options] = toast.warning.mock.calls[0] as [string, ConfirmOptions];
    expect(message).toBe('Delete "Laptop"?');
    expect(options.action.label).toBe("Delete");
    options.action.onClick();
    options.onDismiss();
    await expect(yes).resolves.toBe(true);

    const no = notify.confirm("Clear the form?", "Clear");
    (toast.warning.mock.calls[1][1] as ConfirmOptions).cancel.onClick();
    await expect(no).resolves.toBe(false);

    const closed = notify.confirm("Delete?");
    (toast.warning.mock.calls[2][1] as ConfirmOptions).onDismiss();
    await expect(closed).resolves.toBe(false);
  });
});
