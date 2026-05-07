import { renderAnyValue } from "@/lib/otlp/transform";
import type { IKeyValue } from "@opentelemetry/otlp-transformer";

interface AttributesGridProps {
  title: string;
  attributes: IKeyValue[];
  /** Empty-state message when attributes is empty. */
  emptyMessage?: string;
}

/**
 * Renders an attribute bag as a compact key/value grid. Used for log-record,
 * resource, and scope attribute blocks in the expanded row.
 */
export function AttributesGrid({
  title,
  attributes,
  emptyMessage = "(none)",
}: AttributesGridProps) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h4>
      {attributes.length === 0 ? (
        <p className="text-xs italic text-slate-400">{emptyMessage}</p>
      ) : (
        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-xs">
          {attributes.map((kv, i) => (
            <div key={`${kv.key}-${i}`} className="contents">
              <dt className="truncate text-slate-500">{kv.key}</dt>
              <dd className="whitespace-pre-wrap break-words text-slate-800">
                {renderAnyValue(kv.value) || <span className="italic text-slate-400">(empty)</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** Simple record → array helper for resource attrs (already flattened to strings). */
export function recordToKeyValues(rec: Record<string, string>): IKeyValue[] {
  return Object.entries(rec).map(([key, value]) => ({
    key,
    value: { stringValue: value },
  }));
}
