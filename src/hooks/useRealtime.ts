import { useEffect, useRef } from "react";

export type RealtimeMessage = { type: string; id?: number; project?: number; [key: string]: unknown };
type Handler = (msg: RealtimeMessage) => void;
type Options = { getToken: () => string | null; refreshToken: () => Promise<boolean> };

export const RECONNECTED = "realtime.reconnected";
export const PROCUREMENT_EVENTS = ["procurement.created", "procurement.updated"];
export const TASK_EVENTS = ["personnel.task.changed"];
const UNAUTHORIZED = 4401;
const PING_MS = 25000;
const MAX_DELAY_MS = 30000;

const listeners = new Set<{ types: string[] | null; handler: Handler }>();
let socket: WebSocket | null = null;
let options: Options | null = null;
let stopped = true;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;

function socketUrl(token: string) {
  const base = import.meta.env.VITE_API_URL.replace(/\/+$/, "").replace(/^http/, "ws");
  return `${base}/ws/updates/?token=${encodeURIComponent(token)}`;
}

function emit(msg: RealtimeMessage) {
  listeners.forEach((l) => {
    if (!l.types || l.types.includes(msg.type)) l.handler(msg);
  });
}

function scheduleReconnect() {
  if (stopped) return;
  const delay = Math.min(MAX_DELAY_MS, 1000 * 2 ** attempt);
  attempt += 1;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, delay);
}

function connect() {
  if (stopped || !options) return;
  const token = options.getToken();
  if (!token) return;

  const ws = new WebSocket(socketUrl(token));
  socket = ws;
  let confirmed = false;
  const ping = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" }));

  ws.onopen = () => {
    ping();
    clearInterval(pingTimer);
    pingTimer = setInterval(ping, PING_MS);
  };

  ws.onmessage = (event) => {
    let msg: RealtimeMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!confirmed) {
      confirmed = true;
      attempt = 0;
      emit({ type: RECONNECTED });
    }
    if (msg.type !== "pong") emit(msg);
  };

  ws.onclose = async (event) => {
    clearInterval(pingTimer);
    if (socket === ws) socket = null;
    if (stopped) return;
    // A refresh that fails on the network (tunnel/laptop down) just retries with the backoff; a refresh token that is
    // really expired logs the user out in apiClient, which clears the token, and connect() then stops on its own.
    if (event.code === UNAUTHORIZED) await options!.refreshToken().catch(() => false);
    scheduleReconnect();
  };
}

/** Back online, or back on this tab: reconnect now instead of waiting out the backoff. */
function reconnectNow() {
  if (stopped || socket || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
  attempt = 0;
  clearTimeout(reconnectTimer);
  connect();
}

export function startRealtime(opts: Options) {
  options = opts;
  if (!stopped) return;
  stopped = false;
  attempt = 0;
  window.addEventListener("online", reconnectNow);
  document.addEventListener("visibilitychange", reconnectNow);
  connect();
}

export function stopRealtime() {
  stopped = true;
  window.removeEventListener("online", reconnectNow);
  document.removeEventListener("visibilitychange", reconnectNow);
  clearTimeout(reconnectTimer);
  clearInterval(pingTimer);
  socket?.close(1000);
  socket = null;
}

export function useRealtime(types: string[] | null, handler: Handler) {
  const handlerRef = useRef(handler);
  const key = JSON.stringify(types);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const wanted: string[] | null = JSON.parse(key);
    const entry = {
      types: wanted ? [...wanted, RECONNECTED] : null,
      handler: (msg: RealtimeMessage) => handlerRef.current(msg),
    };
    listeners.add(entry);
    return () => {
      listeners.delete(entry);
    };
  }, [key]);
}
