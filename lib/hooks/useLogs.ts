"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ExportLogsServiceRequest } from "@/lib/otlp/types";

export type FetchState = "idle" | "loading" | "success" | "error";

export interface UseLogsResult {
  data: ExportLogsServiceRequest | null;
  state: FetchState;
  error: string | null;
  /** Timestamp (ms) of the most recent successful load — useful for a "last fetched" chip. */
  fetchedAt: number | null;
  refresh: () => void;
}

/**
 * Fetches logs from our /api/logs proxy. Kept dependency-free (no SWR/TanStack)
 * because the app only makes a single GET and we want explicit control over
 * the refresh UX; adopting a query library for one endpoint would be overkill.
 */
export function useLogs(): UseLogsResult {
  const [data, setData] = useState<ExportLogsServiceRequest | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  // Track latest request so a slow in-flight fetch can't clobber a newer one.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestIdRef.current;
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/logs", { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? `Request failed with ${res.status}`);
      }
      const body = (await res.json()) as ExportLogsServiceRequest;
      if (id !== requestIdRef.current) return; // superseded
      setData(body);
      setState("success");
      setFetchedAt(Date.now());
    } catch (err) {
      if (id !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, state, error, fetchedAt, refresh: load };
}
