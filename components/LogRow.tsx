"use client";

import { useState } from "react";

import { AttributesGrid, recordToKeyValues } from "./AttributesGrid";
import { SeverityBadge } from "./SeverityBadge";
import { formatTimestamp } from "@/lib/format";
import type { FlatLogRow } from "@/lib/otlp/transform";

interface LogRowProps {
  row: FlatLogRow;
  /** When true, hide the resource column (rendered inside a resource group). */
  hideResource?: boolean;
}

export function LogRow({ row, hideResource }: LogRowProps) {
  const [open, setOpen] = useState(false);
  const colSpan = hideResource ? 3 : 4;

  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <td className="w-[1%] py-2 pl-3 pr-2 align-top">
          <span
            className={`inline-block transition-transform ${open ? "rotate-90" : ""} text-slate-400`}
            aria-hidden
          >
            ▶
          </span>
        </td>
        <td className="w-[90px] py-2 pr-3 align-top">
          <SeverityBadge band={row.severityBand} text={row.severityText} />
        </td>
        <td className="w-[200px] py-2 pr-4 align-top font-mono text-xs text-slate-600">
          {formatTimestamp(row.timestampMs)}
        </td>
        {!hideResource && (
          <td className="w-[220px] py-2 pr-4 align-top text-xs text-slate-600">
            <span className="truncate" title={row.resourceLabel}>
              {row.resourceLabel}
            </span>
          </td>
        )}
        <td className="py-2 pr-3 align-top text-sm text-slate-900">
          <span className="font-mono">{row.body || <span className="italic text-slate-400">(empty body)</span>}</span>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td />
          <td colSpan={colSpan} className="px-3 py-4">
            <ExpandedDetail row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetail({ row }: { row: FlatLogRow }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <AttributesGrid
        title="Log attributes"
        attributes={row.attributes}
        emptyMessage="(no log-record attributes)"
      />
      <AttributesGrid
        title="Resource"
        attributes={recordToKeyValues(row.resourceAttrs)}
        emptyMessage="(no resource attributes)"
      />
      <AttributesGrid
        title={`Scope${row.scopeName ? ` · ${row.scopeName}` : ""}${row.scopeVersion ? `@${row.scopeVersion}` : ""}`}
        attributes={row.scopeAttrs}
        emptyMessage="(no scope attributes)"
      />
      <div className="md:col-span-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Raw record
        </h4>
        <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
{JSON.stringify(row.raw, null, 2)}
        </pre>
      </div>
    </div>
  );
}
