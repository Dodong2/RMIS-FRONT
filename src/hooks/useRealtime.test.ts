import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeSocket {
  static all: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }
  send() {}
  close() {}
  drop(code = 1006) {
    this.onclose?.({ code });
  }
}

const listeners: Record<string, () => void> = {};
const target = {
  addEventListener: (name: string, fn: () => void) => (listeners[name] = fn),
  removeEventListener: (name: string) => delete listeners[name],
};

vi.stubEnv("VITE_API_URL", "https://api.example.test");
vi.stubGlobal("WebSocket", FakeSocket);
vi.stubGlobal("window", target);
vi.stubGlobal("document", { ...target, visibilityState: "visible" });

const { startRealtime, stopRealtime } = await import("./useRealtime");

describe("realtime reconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.all = [];
  });
  afterEach(() => {
    stopRealtime();
    vi.useRealTimers();
  });

  it("keeps retrying after a token refresh fails on the network", async () => {
    const refreshToken = vi.fn().mockRejectedValue(new Error("Network Error"));
    startRealtime({ getToken: () => "t", refreshToken });
    FakeSocket.all[0].drop(4401);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refreshToken).toHaveBeenCalled();
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("stops once the user is logged out (no token)", async () => {
    let token: string | null = "t";
    startRealtime({ getToken: () => token, refreshToken: async () => false });
    token = null;
    FakeSocket.all[0].drop(4401);
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("reconnects at once when the browser comes back online", async () => {
    startRealtime({ getToken: () => "t", refreshToken: async () => true });
    for (let i = 0; i < 5; i++) {
      FakeSocket.all.at(-1)!.drop();
      await vi.advanceTimersByTimeAsync(30000);
    }
    const before = FakeSocket.all.length;
    FakeSocket.all.at(-1)!.drop(); // next retry would wait 30s
    listeners.online();
    expect(FakeSocket.all).toHaveLength(before + 1);
  });

  it("does nothing on online while a socket is already open", () => {
    startRealtime({ getToken: () => "t", refreshToken: async () => true });
    listeners.online();
    expect(FakeSocket.all).toHaveLength(1);
  });
});
