import { LogRow } from "./LogRow";
import type { FlatLogRow } from "@/lib/otlp/transform";

interface LogTableProps {
  rows: FlatLogRow[];
  hideResource?: boolean;
}

export function LogTable({ rows, hideResource }: LogTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No log records.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="w-[1%] py-2 pl-3 pr-2" aria-label="Toggle details" />
            <th className="py-2 pr-3 font-medium">Severity</th>
            <th className="py-2 pr-4 font-medium">Time (UTC)</th>
            {!hideResource && <th className="py-2 pr-4 font-medium">Resource</th>}
            <th className="py-2 pr-3 font-medium">Body</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LogRow key={row.id} row={row} hideResource={hideResource} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
