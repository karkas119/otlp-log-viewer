import type {
  IAnyValue,
  IExportLogsServiceRequest,
  IKeyValue,
  ILogRecord,
  IResource,
  IResourceLogs,
  IScopeLogs,
} from "@opentelemetry/otlp-transformer";

// ---------------------------------------------------------------------------
// Severity bands
// ---------------------------------------------------------------------------

/**
 * Display grouping of the OTel severity numbers (1-24) into 7 bands per
 * https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
 *
 * Declared as an array first so `SeverityBand`, `emptyBandCounts`, and any
 * future iteration order all share one source of truth.
 */
export const SEVERITY_BANDS = [
  "UNSPECIFIED",
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "FATAL",
] as const;

export type SeverityBand = (typeof SEVERITY_BANDS)[number];

/** Map severityNumber (0-24) → band. 0 or undefined → UNSPECIFIED. */
export function severityBandFromNumber(n: number | undefined): SeverityBand {
  if (!n || n <= 0) return "UNSPECIFIED";
  if (n <= 4) return "TRACE";
  if (n <= 8) return "DEBUG";
  if (n <= 12) return "INFO";
  if (n <= 16) return "WARN";
  if (n <= 20) return "ERROR";
  return "FATAL";
}

/**
 * Pull a band out of severityText. Works because every OTel severity text
 * starts with a unique letter (TRACE/DEBUG/INFO/WARN/ERROR/FATAL), so values
 * like "INFO2" or "ERROR4" still map cleanly.
 */
function severityBandFromText(text: string | undefined): SeverityBand | null {
  if (!text) return null;
  const first = text[0]?.toUpperCase();
  switch (first) {
    case "T": return "TRACE";
    case "D": return "DEBUG";
    case "I": return "INFO";
    case "W": return "WARN";
    case "E": return "ERROR";
    case "F": return "FATAL";
    default: return null;
  }
}

/** Prefer severityText when present; fall back to severityNumber. */
export function severityBand(rec: ILogRecord): SeverityBand {
  return severityBandFromText(rec.severityText) ?? severityBandFromNumber(rec.severityNumber);
}

// ---------------------------------------------------------------------------
// AnyValue rendering
// ---------------------------------------------------------------------------

/** Render an OTLP AnyValue for display. Intentionally not a full JSON dump. */
export function renderAnyValue(v: IAnyValue | undefined): string {
  if (v == null) return "";
  if (v.stringValue != null) return v.stringValue;
  if (v.boolValue != null) return String(v.boolValue);
  if (v.intValue != null) return String(v.intValue);
  if (v.doubleValue != null) return String(v.doubleValue);
  if (v.arrayValue) {
    const parts = v.arrayValue.values.map(renderAnyValue);
    return `[${parts.join(", ")}]`;
  }
  if (v.kvlistValue) {
    const parts = v.kvlistValue.values.map((kv) => `${kv.key}: ${renderAnyValue(kv.value)}`);
    return `{${parts.join(", ")}}`;
  }
  if (v.bytesValue) return `<${v.bytesValue.length} bytes>`;
  return "";
}

/** Flatten an IKeyValue[] into a plain string-valued record for display. */
export function attributesToRecord(attrs: IKeyValue[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of attrs ?? []) {
    out[kv.key] = renderAnyValue(kv.value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Timestamp conversion
// ---------------------------------------------------------------------------

/**
 * Convert an OTLP nanosecond timestamp to JS milliseconds.
 *
 * The OTLP `Fixed64` shape is `string | number | { low, high }`. JSON wire
 * format always sends it as a string because uint64 overflows `Number`.
 * Returns 0 on invalid input rather than throwing — a bad row shouldn't
 * knock out the whole list.
 */
export function nanoToMs(nano: unknown): number {
  if (nano == null) return 0;
  if (typeof nano === "number") return Math.floor(nano / 1e6);
  if (typeof nano === "string") return nanoStringToMs(nano);
  if (isLongBits(nano)) return longBitsToMs(nano);
  return 0;
}

function nanoStringToMs(s: string): number {
  try {
    return Number(BigInt(s) / 1_000_000n);
  } catch {
    const n = Number(s);
    return Number.isFinite(n) ? Math.floor(n / 1e6) : 0;
  }
}

function longBitsToMs({ low, high }: { low: number; high: number }): number {
  const nanos = (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);
  return Number(nanos / 1_000_000n);
}

function isLongBits(v: unknown): v is { low: number; high: number } {
  return typeof v === "object" && v !== null && "low" in v && "high" in v;
}

// ---------------------------------------------------------------------------
// Flattening
// ---------------------------------------------------------------------------

/**
 * A single log record joined with its resource + scope context so downstream
 * components don't need to re-walk the nested OTLP tree.
 */
export interface FlatLogRow {
  /** Stable id across re-renders: `resourceIdx.scopeIdx.recordIdx`. */
  id: string;
  /** Milliseconds since epoch (sub-ms precision from nanos is discarded). */
  timestampMs: number;
  severityNumber: number;
  severityText: string;
  severityBand: SeverityBand;
  body: string;
  attributes: IKeyValue[];
  resource: IResource | undefined;
  resourceAttrs: Record<string, string>;
  scopeName: string | undefined;
  scopeVersion: string | undefined;
  scopeAttrs: IKeyValue[];
  /** Group key: `service.namespace|service.name` (version excluded on purpose). */
  resourceKey: string;
  resourceLabel: string;
  raw: ILogRecord;
}

/** Pre-computed resource-level context, reused for every record in a resource. */
interface ResourceContext {
  resource: IResource | undefined;
  resourceAttrs: Record<string, string>;
  resourceKey: string;
  resourceLabel: string;
}

function buildResourceContext(rl: IResourceLogs): ResourceContext {
  const resourceAttrs = attributesToRecord(rl.resource?.attributes);
  const ns = resourceAttrs["service.namespace"] ?? "";
  const name = resourceAttrs["service.name"] ?? "unknown_service";
  return {
    resource: rl.resource,
    resourceAttrs,
    // Version is intentionally excluded so that re-deployed services still
    // group under the same key.
    resourceKey: `${ns}|${name}`,
    resourceLabel: ns ? `${ns} / ${name}` : name,
  };
}

function toFlatRow(
  rec: ILogRecord,
  scope: IScopeLogs,
  ctx: ResourceContext,
  ids: { resourceIdx: number; scopeIdx: number; recordIdx: number },
): FlatLogRow {
  return {
    id: `${ids.resourceIdx}.${ids.scopeIdx}.${ids.recordIdx}`,
    timestampMs: nanoToMs(rec.timeUnixNano),
    severityNumber: rec.severityNumber ?? 0,
    severityText: rec.severityText ?? "",
    severityBand: severityBand(rec),
    body: renderAnyValue(rec.body),
    attributes: rec.attributes ?? [],
    scopeName: scope.scope?.name,
    scopeVersion: scope.scope?.version,
    scopeAttrs: scope.scope?.attributes ?? [],
    ...ctx,
    raw: rec,
  };
}

/** Walk resourceLogs → scopeLogs → logRecords and return newest-first rows. */
export function flattenLogs(request: IExportLogsServiceRequest): FlatLogRow[] {
  const rows: FlatLogRow[] = [];

  const resourceLogsList = request.resourceLogs ?? [];
  for (let ri = 0; ri < resourceLogsList.length; ri++) {
    const rl = resourceLogsList[ri];
    const ctx = buildResourceContext(rl);
    const scopes = rl.scopeLogs ?? [];
    for (let si = 0; si < scopes.length; si++) {
      const scope = scopes[si];
      const records = scope.logRecords ?? [];
      for (let li = 0; li < records.length; li++) {
        rows.push(toFlatRow(records[li], scope, ctx, {
          resourceIdx: ri,
          scopeIdx: si,
          recordIdx: li,
        }));
      }
    }
  }

  return rows.sort((a, b) => b.timestampMs - a.timestampMs);
}

// ---------------------------------------------------------------------------
// Grouping by resource
// ---------------------------------------------------------------------------

export interface ResourceGroup {
  key: string;
  label: string;
  serviceName: string | undefined;
  serviceNamespace: string | undefined;
  serviceVersion: string | undefined;
  resourceAttrs: Record<string, string>;
  rows: FlatLogRow[];
}

function newGroup(row: FlatLogRow): ResourceGroup {
  return {
    key: row.resourceKey,
    label: row.resourceLabel,
    serviceName: row.resourceAttrs["service.name"],
    serviceNamespace: row.resourceAttrs["service.namespace"],
    serviceVersion: row.resourceAttrs["service.version"],
    resourceAttrs: row.resourceAttrs,
    rows: [],
  };
}

/** Group rows by resource identity, sorted by row count (chattiest first). */
export function groupByResource(rows: FlatLogRow[]): ResourceGroup[] {
  const byKey = new Map<string, ResourceGroup>();
  for (const row of rows) {
    let group = byKey.get(row.resourceKey);
    if (!group) {
      group = newGroup(row);
      byKey.set(row.resourceKey, group);
    }
    group.rows.push(row);
  }
  return [...byKey.values()].sort((a, b) => b.rows.length - a.rows.length);
}

// ---------------------------------------------------------------------------
// Histogram bucketing
// ---------------------------------------------------------------------------

export interface HistogramBucket {
  /** Bucket start (ms, inclusive). */
  t0: number;
  /** Bucket end (ms, exclusive). */
  t1: number;
  total: number;
  byBand: Record<SeverityBand, number>;
}

function emptyBandCounts(): Record<SeverityBand, number> {
  // Built from SEVERITY_BANDS so adding a band in one place propagates here.
  return Object.fromEntries(SEVERITY_BANDS.map((b) => [b, 0])) as Record<SeverityBand, number>;
}

function timeBounds(rows: FlatLogRow[]): { min: number; max: number } | null {
  if (rows.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const r of rows) {
    if (r.timestampMs < min) min = r.timestampMs;
    if (r.timestampMs > max) max = r.timestampMs;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  // Nudge max when all rows share a timestamp, so the single row lands inside a bucket.
  return { min, max: min === max ? min + 1 : max };
}

/**
 * Bucket rows into `bucketCount` equal-width intervals spanning the full
 * time range. Empty intervals are included so bars align with the x-axis.
 */
export function bucketRows(rows: FlatLogRow[], bucketCount: number): HistogramBucket[] {
  if (bucketCount <= 0) return [];
  const bounds = timeBounds(rows);
  if (!bounds) return [];

  const width = Math.ceil((bounds.max - bounds.min) / bucketCount);
  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    t0: bounds.min + i * width,
    t1: bounds.min + (i + 1) * width,
    total: 0,
    byBand: emptyBandCounts(),
  }));

  for (const row of rows) {
    const idx = Math.min(bucketCount - 1, Math.floor((row.timestampMs - bounds.min) / width));
    const bucket = buckets[idx];
    bucket.total += 1;
    bucket.byBand[row.severityBand] += 1;
  }
  return buckets;
}
