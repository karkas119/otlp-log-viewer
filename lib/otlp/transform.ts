import type {
  AnyValue,
  ExportLogsServiceRequest,
  KeyValue,
  LogRecord,
  Resource,
  ResourceLogs,
  ScopeLogs,
  SeverityBand,
} from "./types";

/**
 * A single log record flattened with enough parent context to render and
 * search without re-walking the OTLP tree.
 */
export interface FlatLogRow {
  /** Stable id across re-renders: resourceIdx.scopeIdx.recordIdx. */
  id: string;
  /** Milliseconds since epoch (nano precision lost; fine for display/buckets). */
  timestampMs: number;
  severityNumber: number;
  severityText: string;
  severityBand: SeverityBand;
  body: string;
  attributes: KeyValue[];
  resource: Resource | undefined;
  resourceAttrs: Record<string, string>;
  scopeName: string | undefined;
  scopeVersion: string | undefined;
  scopeAttrs: KeyValue[];
  /** Stable id derived from resource attributes (service.name/namespace). */
  resourceKey: string;
  resourceLabel: string;
  raw: LogRecord;
}

export interface ResourceGroup {
  key: string;
  label: string;
  /** namespace / name / version pulled out for chips. */
  serviceName: string | undefined;
  serviceNamespace: string | undefined;
  serviceVersion: string | undefined;
  resourceAttrs: Record<string, string>;
  rows: FlatLogRow[];
}

const SEV_BAND_BY_FIRST_CHAR: Record<string, SeverityBand> = {
  T: "TRACE",
  D: "DEBUG",
  I: "INFO",
  W: "WARN",
  E: "ERROR",
  F: "FATAL",
};

/** Map OTel severity number (1-24) to one of the 7 display bands. */
export function severityBandFromNumber(n: number | undefined): SeverityBand {
  if (!n || n <= 0) return "UNSPECIFIED";
  if (n <= 4) return "TRACE";
  if (n <= 8) return "DEBUG";
  if (n <= 12) return "INFO";
  if (n <= 16) return "WARN";
  if (n <= 20) return "ERROR";
  return "FATAL";
}

export function severityBand(rec: LogRecord): SeverityBand {
  // Prefer severityText when present; fall back to severityNumber.
  const t = rec.severityText?.toUpperCase();
  if (t && t[0] && SEV_BAND_BY_FIRST_CHAR[t[0]]) {
    return SEV_BAND_BY_FIRST_CHAR[t[0]];
  }
  return severityBandFromNumber(rec.severityNumber);
}

/** Render AnyValue for display. Kept intentionally small; we're not rebuilding a REPL. */
export function renderAnyValue(v: AnyValue | undefined): string {
  if (v === undefined || v === null) return "";
  if (v.stringValue != null) return v.stringValue;
  if (v.boolValue != null) return String(v.boolValue);
  if (v.intValue != null) return String(v.intValue);
  if (v.doubleValue != null) return String(v.doubleValue);
  if (v.arrayValue) {
    return `[${v.arrayValue.values.map(renderAnyValue).join(", ")}]`;
  }
  if (v.kvlistValue) {
    const inner = v.kvlistValue.values
      .map((kv) => `${kv.key}: ${renderAnyValue(kv.value)}`)
      .join(", ");
    return `{${inner}}`;
  }
  if (v.bytesValue) return `<${v.bytesValue.length} bytes>`;
  return "";
}

export function attributesToRecord(attrs: KeyValue[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!attrs) return out;
  for (const kv of attrs) {
    out[kv.key] = renderAnyValue(kv.value);
  }
  return out;
}

/**
 * Convert OTLP nano timestamp (string) to JS ms.
 * timeUnixNano is sent as a string because uint64 can overflow JS Number,
 * but after /1e6 a sensible ms value fits comfortably.
 */
export function nanoToMs(nano: string | number | undefined): number {
  if (nano === undefined || nano === null) return 0;
  if (typeof nano === "number") return Math.floor(nano / 1e6);
  // String path: divide by 1e6 using BigInt to avoid precision loss.
  try {
    return Number(BigInt(nano) / 1_000_000n);
  } catch {
    // Fallback: best-effort parse.
    const n = Number(nano);
    return Number.isFinite(n) ? Math.floor(n / 1e6) : 0;
  }
}

function resourceKeyFor(attrs: Record<string, string>): string {
  // Identity = namespace + name. Version is part of the label, not the key,
  // so re-deploys of the same service still group together.
  const ns = attrs["service.namespace"] ?? "";
  const name = attrs["service.name"] ?? "unknown_service";
  return `${ns}|${name}`;
}

function resourceLabelFor(attrs: Record<string, string>): string {
  const ns = attrs["service.namespace"];
  const name = attrs["service.name"] ?? "unknown_service";
  return ns ? `${ns} / ${name}` : name;
}

/** Flatten an OTLP request into one row per LogRecord, sorted newest-first. */
export function flattenLogs(request: ExportLogsServiceRequest): FlatLogRow[] {
  const rows: FlatLogRow[] = [];
  const resourceLogs: ResourceLogs[] = request.resourceLogs ?? [];

  resourceLogs.forEach((rl, ri) => {
    const resourceAttrs = attributesToRecord(rl.resource?.attributes);
    const resourceKey = resourceKeyFor(resourceAttrs);
    const resourceLabel = resourceLabelFor(resourceAttrs);
    const scopes: ScopeLogs[] = rl.scopeLogs ?? [];
    scopes.forEach((sl, si) => {
      const records: LogRecord[] = sl.logRecords ?? [];
      records.forEach((rec, li) => {
        rows.push({
          id: `${ri}.${si}.${li}`,
          timestampMs: nanoToMs(rec.timeUnixNano),
          severityNumber: rec.severityNumber ?? 0,
          severityText: rec.severityText ?? "",
          severityBand: severityBand(rec),
          body: renderAnyValue(rec.body),
          attributes: rec.attributes ?? [],
          resource: rl.resource,
          resourceAttrs,
          scopeName: sl.scope?.name,
          scopeVersion: sl.scope?.version,
          scopeAttrs: sl.scope?.attributes ?? [],
          resourceKey,
          resourceLabel,
          raw: rec,
        });
      });
    });
  });

  rows.sort((a, b) => b.timestampMs - a.timestampMs);
  return rows;
}

/** Group flattened rows by resource identity (service.namespace + service.name). */
export function groupByResource(rows: FlatLogRow[]): ResourceGroup[] {
  const byKey = new Map<string, ResourceGroup>();
  for (const row of rows) {
    let g = byKey.get(row.resourceKey);
    if (!g) {
      g = {
        key: row.resourceKey,
        label: row.resourceLabel,
        serviceName: row.resourceAttrs["service.name"],
        serviceNamespace: row.resourceAttrs["service.namespace"],
        serviceVersion: row.resourceAttrs["service.version"],
        resourceAttrs: row.resourceAttrs,
        rows: [],
      };
      byKey.set(row.resourceKey, g);
    }
    g.rows.push(row);
  }
  // Sort groups by row count desc (most chatty services first).
  return Array.from(byKey.values()).sort((a, b) => b.rows.length - a.rows.length);
}

export interface HistogramBucket {
  /** Bucket start in ms. */
  t0: number;
  /** Bucket end in ms (exclusive). */
  t1: number;
  total: number;
  byBand: Record<SeverityBand, number>;
}

export const SEVERITY_BANDS: readonly SeverityBand[] = [
  "UNSPECIFIED",
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "FATAL",
] as const;

function emptyBandCounts(): Record<SeverityBand, number> {
  return {
    UNSPECIFIED: 0,
    TRACE: 0,
    DEBUG: 0,
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    FATAL: 0,
  };
}

/**
 * Bucket rows into `bucketCount` fixed-width intervals spanning [min, max].
 * Returns empty buckets for ranges with no rows (so bars align with x-axis).
 */
export function bucketRows(
  rows: FlatLogRow[],
  bucketCount: number,
): HistogramBucket[] {
  if (rows.length === 0 || bucketCount <= 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const r of rows) {
    if (r.timestampMs < min) min = r.timestampMs;
    if (r.timestampMs > max) max = r.timestampMs;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];

  // Pad a tiny amount so the max row lands inside the last bucket.
  if (min === max) max = min + 1;
  const span = max - min;
  const width = Math.ceil(span / bucketCount);
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      t0: min + i * width,
      t1: min + (i + 1) * width,
      total: 0,
      byBand: emptyBandCounts(),
    });
  }
  for (const r of rows) {
    const idx = Math.min(
      bucketCount - 1,
      Math.floor((r.timestampMs - min) / width),
    );
    const b = buckets[idx];
    b.total += 1;
    b.byBand[r.severityBand] += 1;
  }
  return buckets;
}
