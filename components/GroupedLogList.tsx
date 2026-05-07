"use client";

import { useMemo, useState } from "react";

import { LogTable } from "./LogTable";
import { SEVERITY_BANDS, groupByResource } from "@/lib/otlp/transform";
import type { FlatLogRow, ResourceGroup, SeverityBand } from "@/lib/otlp/transform";

interface GroupedLogListProps {
  rows: FlatLogRow[];
}

export function GroupedLogList({ rows }: GroupedLogListProps) {
  const groups = useMemo(() => groupByResource(rows), [rows]);
  // Default to expanded so landing on the grouped view shows content
  // without extra clicks. User interactions flip entries in this set.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allCollapsed = groups.length > 0 && collapsed.size === groups.length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {groups.length} {groups.length === 1 ? "service" : "services"}
        </span>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
            disabled={collapsed.size === 0}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set(groups.map((g) => g.key)))}
            className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
            disabled={allCollapsed}
          >
            Collapse all
          </button>
        </div>
      </div>

      {groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          collapsed={collapsed.has(group.key)}
          onToggle={() => toggle(group.key)}
        />
      ))}
    </section>
  );
}

function GroupSection({
  group,
  collapsed,
  onToggle,
}: {
  group: ResourceGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const counts = useMemo(() => countByBand(group.rows), [group.rows]);
  return (
    <div className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
      >
        <span
          className={`inline-block text-slate-400 transition-transform ${collapsed ? "" : "rotate-90"}`}
          aria-hidden
        >
          ▶
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="truncate font-semibold text-slate-800">
            {group.label}
          </h3>
          {group.serviceVersion && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
              v{group.serviceVersion}
            </span>
          )}
        </div>
        <CountsStrip counts={counts} total={group.rows.length} />
      </button>
      {!collapsed && (
        <div className="border-t border-slate-100 px-3 py-3">
          <LogTable rows={group.rows} hideResource />
        </div>
      )}
    </div>
  );
}

function countByBand(rows: FlatLogRow[]): Record<SeverityBand, number> {
  const c: Record<SeverityBand, number> = {
    UNSPECIFIED: 0,
    TRACE: 0,
    DEBUG: 0,
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    FATAL: 0,
  };
  for (const r of rows) c[r.severityBand] += 1;
  return c;
}

function CountsStrip({
  counts,
  total,
}: {
  counts: Record<SeverityBand, number>;
  total: number;
}) {
  const nonZero = SEVERITY_BANDS.filter((b) => counts[b] > 0);
  return (
    <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
      {nonZero.map((b) => (
        <span
          key={b}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ring-slate-200"
          title={`${counts[b]} ${b}`}
        >
          <span
            className="mr-1 inline-block h-2 w-2 rounded-sm align-middle"
            style={{ background: BAND_DOT[b] }}
          />
          {counts[b]}
        </span>
      ))}
      <span className="font-medium text-slate-700">{total} total</span>
    </div>
  );
}

const BAND_DOT: Record<SeverityBand, string> = {
  UNSPECIFIED: "#cbd5e1",
  TRACE: "#94a3b8",
  DEBUG: "#64748b",
  INFO: "#3b82f6",
  WARN: "#f59e0b",
  ERROR: "#ef4444",
  FATAL: "#b91c1c",
};
