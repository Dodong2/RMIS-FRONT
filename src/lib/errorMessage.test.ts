import { describe, expect, it } from "vitest";

import { errorMessage, throttledMessage } from "./errorMessage";

const throttled = (detail: string) => ({ response: { status: 429, data: { detail } } });

describe("throttledMessage", () => {
  it("turns DRF's throttle detail into a wait in seconds", () => {
    expect(throttledMessage(throttled("Request was throttled. Expected available in 42 seconds."))).toBe(
      "Too many requests. Please wait 42 seconds and try again.",
    );
    expect(throttledMessage(throttled("Request was throttled. Expected available in 1 second."))).toBe(
      "Too many requests. Please wait 1 second and try again.",
    );
  });

  it("rounds long waits up to minutes", () => {
    expect(throttledMessage(throttled("Request was throttled. Expected available in 3540 seconds."))).toBe(
      "Too many requests. Please wait 59 minutes and try again.",
    );
    expect(throttledMessage(throttled("Request was throttled. Expected available in 60 seconds."))).toBe(
      "Too many requests. Please wait 1 minute and try again.",
    );
  });

  it("still explains a 429 without a wait time", () => {
    expect(throttledMessage({ response: { status: 429, data: {} } })).toBe(
      "Too many requests. Please wait a moment and try again.",
    );
  });

  it("ignores every other error", () => {
    expect(throttledMessage({ response: { status: 400, data: { detail: "Bad." } } })).toBeNull();
    expect(throttledMessage(new Error("Network Error"))).toBeNull();
  });
});

describe("errorMessage", () => {
  it("prefers the throttle sentence over the raw DRF detail", () => {
    expect(errorMessage(throttled("Request was throttled. Expected available in 5 seconds."), "Failed.")).toBe(
      "Too many requests. Please wait 5 seconds and try again.",
    );
  });

  it("keeps the backend detail for other errors", () => {
    expect(errorMessage({ response: { status: 400, data: { detail: "Bad." } } }, "Failed.")).toBe("Bad.");
  });
});
