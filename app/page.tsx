"use client";

import { useMemo, useState } from "react";

import { GroupedLogList } from "@/components/GroupedLogList";
import { Histogram } from "@/components/Histogram";
import { LogTable } from "@/components/LogTable";
import { ViewModeToggle, type ViewMode } from "@/components/ViewModeToggle";
import { formatRelative } from "@/lib/format";
import { useLogs } from "@/lib/hooks/useLogs";
import { flattenLogs } from "@/lib/otlp/transform";

export default function HomePage() {
  const { data, state, error, fetchedAt, refresh } = useLogs();
  const [viewMode, setViewMode] = useState<ViewMode>("flat");

  const rows = useMemo(() => (data ? flattenLogs(data) : []), [data]);

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            OTLP Log Viewer
          </h1>
          <p className="text-sm text-slate-500">
            Browse OpenTelemetry log records from the assignment API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-xs text-slate-500">
              Fetched {formatRelative(fetchedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={state === "loading"}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {state === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {state === "error" && (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <p className="font-medium">Failed to load logs</p>
          <p className="font-mono text-xs">{error}</p>
        </div>
      )}

      {state === "loading" && !data && <SkeletonState />}

      {data && (
        <>
          <Histogram rows={rows} />

          <section className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {rows.length} {rows.length === 1 ? "log record" : "log records"}
            </h2>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </section>

          {viewMode === "flat" ? (
            <LogTable rows={rows} />
          ) : (
            <GroupedLogList rows={rows} />
          )}
        </>
      )}

      <footer className="pt-6 text-center text-[11px] text-slate-400">
        Data via <code className="font-mono">/api/logs</code> → upstream{" "}
        <code className="font-mono">take-home-assignment-otlp-logs-api.vercel.app</code>
      </footer>
    </main>
  );
}

function SkeletonState() {
  return (
    <div className="space-y-4">
      <div className="h-[220px] animate-pulse rounded border border-slate-200 bg-slate-100" />
      <div className="h-8 animate-pulse rounded bg-slate-100" />
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
