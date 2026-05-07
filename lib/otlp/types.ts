/**
 * OTLP JSON wire-format types for logs.
 *
 * Mirrors the subset of opentelemetry-proto used by the assignment API:
 *   https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/logs/v1/logs.proto
 *   https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto
 *
 * Defined locally rather than re-used from @opentelemetry/otlp-transformer
 * because that package's IResourceLogs / ILogRecord are internal (not in its
 * public export map), and we want a single source of truth for the exact
 * JSON shape we receive.
 */

export interface AnyValue {
  stringValue?: string | null;
  boolValue?: boolean | null;
  intValue?: number | string | null;
  doubleValue?: number | null;
  arrayValue?: { values: AnyValue[] };
  kvlistValue?: { values: KeyValue[] };
  bytesValue?: string; // base64
}

export interface KeyValue {
  key: string;
  value: AnyValue;
}

export interface InstrumentationScope {
  name?: string;
  version?: string;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

export interface Resource {
  attributes: KeyValue[];
  droppedAttributesCount?: number;
}

export interface LogRecord {
  /** nanoseconds since epoch, encoded as a numeric string (uint64). */
  timeUnixNano: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: AnyValue;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
  flags?: number;
  traceId?: string;
  spanId?: string;
}

export interface ScopeLogs {
  scope?: InstrumentationScope;
  logRecords?: LogRecord[];
  schemaUrl?: string;
}

export interface ResourceLogs {
  resource?: Resource;
  scopeLogs: ScopeLogs[];
  schemaUrl?: string;
}

export interface ExportLogsServiceRequest {
  resourceLogs?: ResourceLogs[];
}

/**
 * Log Data Model severity bands — grouped as per
 * https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
 */
export type SeverityBand =
  | "UNSPECIFIED"
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "FATAL";
