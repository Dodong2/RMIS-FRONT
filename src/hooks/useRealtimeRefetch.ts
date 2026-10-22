import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RECONNECTED, useRealtime } from "./useRealtime";
import { REALTIME_REFETCH_EVENTS, keysToRefetch } from "../lib/realtimeInvalidation";

const COALESCE_MS = 300;

export function useRealtimeRefetch() {
  const queryClient = useQueryClient();
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useRealtime(REALTIME_REFETCH_EVENTS, (msg) => {
    pending.current.add(msg.type);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const types = pending.current;
      pending.current = new Set();
      for (const queryKey of keysToRefetch(types, types.has(RECONNECTED))) queryClient.invalidateQueries({ queryKey });
    }, COALESCE_MS);
  });
}

export function RealtimeRefetch() {
  useRealtimeRefetch();
  return null;
}
