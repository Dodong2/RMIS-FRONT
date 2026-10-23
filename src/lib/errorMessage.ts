export function throttledMessage(err: unknown): string | null {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  if (response?.status !== 429) return null;
  const seconds = Number(String(response.data?.detail ?? "").match(/(\d+) seconds?/)?.[1]);
  if (!seconds) return "Too many requests. Please wait a moment and try again.";
  const minutes = Math.ceil(seconds / 60);
  const wait = seconds < 60 ? `${seconds} second${seconds === 1 ? "" : "s"}` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `Too many requests. Please wait ${wait} and try again.`;
}

export function errorMessage(err: unknown, fallback: string): string {
  const throttled = throttledMessage(err);
  if (throttled) return throttled;
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  const first = Object.values(data).flat()[0];
  return typeof first === "string" ? first : fallback;
}
