"use client";

import { useMemo, useState } from "react";

import { formatTimestamp } from "@/lib/format";
import { bucketRows, SEVERITY_BANDS } from "@/lib/otlp/transform";
import type { FlatLogRow } from "@/lib/otlp/transform";
import type { SeverityBand } from "@/lib/otlp/types";

interface HistogramProps {
  rows: FlatLogRow[];
  /** Number of buckets to render. Tuned for roughly 1 bucket per 12-16px at typical widths. */
  buckets?: number;
}

const BAND_FILLS: Record<SeverityBand, string> = {
  UNSPECIFIED: "#cbd5e1",
  TRACE: "#94a3b8",
  DEBUG: "#64748b",
  INFO: "#3b82f6",
  WARN: "#f59e0b",
  ERROR: "#ef4444",
  FATAL: "#b91c1c",
};

const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };
const WIDTH = 800;
const HEIGHT = 220;
const INNER_W = WIDTH - PADDING.left - PADDING.right;
const INNER_H = HEIGHT - PADDING.top - PADDING.bottom;

export function Histogram({ rows, buckets = 48 }: HistogramProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const data = useMemo(() => bucketRows(rows, buckets), [rows, buckets]);

  if (rows.length === 0 || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded border border-dashed border-slate-300 text-sm text-slate-400">
        No logs to chart.
      </div>
    );
  }

  const maxTotal = Math.max(1, ...data.map((b) => b.total));
  const bucketWidth = INNER_W / data.length;
  const barWidth = Math.max(1, bucketWidth - 1);

  // Y ticks: 0, maxTotal/2, maxTotal (rounded up to a nice integer).
  const yTicks = buildYTicks(maxTotal);
  const yScale = (v: number) => INNER_H - (v / yTicks[yTicks.length - 1]) * INNER_H;

  const xTickIdxs = pickXTickIdxs(data.length);

  const hoverBucket = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <figure className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <figcaption className="text-sm font-medium text-slate-700">
          Log volume over time
        </figcaption>
        <Legend />
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label={`Histogram of ${rows.length} log records across ${data.length} buckets`}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* Y gridlines + labels */}
            {yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={0}
                  x2={INNER_W}
                  y1={yScale(v)}
                  y2={yScale(v)}
                  stroke="#e2e8f0"
                  strokeDasharray={v === 0 ? undefined : "2,2"}
                />
                <text
                  x={-8}
                  y={yScale(v) + 3}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px]"
                >
                  {v}
                </text>
              </g>
            ))}

            {/* Bars (stacked) */}
            {data.map((b, i) => {
              const x = i * bucketWidth;
              let yCursor = INNER_H;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoverIdx(i)}
                  onFocus={() => setHoverIdx(i)}
                  tabIndex={0}
                >
                  {/* Transparent hit target covers entire column including empty space */}
                  <rect x={x} y={0} width={bucketWidth} height={INNER_H} fill="transparent" />
                  {SEVERITY_BANDS.map((band) => {
                    const count = b.byBand[band];
                    if (count === 0) return null;
                    const h = (count / yTicks[yTicks.length - 1]) * INNER_H;
                    yCursor -= h;
                    return (
                      <rect
                        key={band}
                        x={x + (bucketWidth - barWidth) / 2}
                        y={yCursor}
                        width={barWidth}
                        height={h}
                        fill={BAND_FILLS[band]}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* X-axis baseline */}
            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="#94a3b8" />

            {/* X ticks */}
            {xTickIdxs.map((i) => {
              const b = data[i];
              const x = i * bucketWidth + bucketWidth / 2;
              return (
                <g key={i}>
                  <line x1={x} x2={x} y1={INNER_H} y2={INNER_H + 4} stroke="#94a3b8" />
                  <text
                    x={x}
                    y={INNER_H + 16}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px]"
                  >
                    {formatShortTime(b.t0)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {hoverBucket && (
          <HoverTooltip
            bucket={hoverBucket}
            xPercent={((hoverIdx! * bucketWidth + PADDING.left + bucketWidth / 2) / WIDTH) * 100}
          />
        )}
      </div>
    </figure>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
      {SEVERITY_BANDS.map((b) => (
        <li key={b} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: BAND_FILLS[b] }}
          />
          {b}
        </li>
      ))}
    </ul>
  );
}

function HoverTooltip({
  bucket,
  xPercent,
}: {
  bucket: ReturnType<typeof bucketRows>[number];
  xPercent: number;
}) {
  const nonZeroBands = SEVERITY_BANDS.filter((b) => bucket.byBand[b] > 0);
  // Keep tooltip on-screen: clamp so it doesn't slip past the right edge.
  const left = `min(calc(${xPercent}% + 8px), calc(100% - 200px))`;
  return (
    <div
      className="pointer-events-none absolute top-2 w-[200px] rounded border border-slate-200 bg-white p-2 text-xs shadow-md"
      style={{ left }}
    >
      <div className="mb-1 font-medium text-slate-700">
        {formatTimestamp(bucket.t0)}
      </div>
      <div className="mb-1 text-slate-500">
        → {formatTimestamp(bucket.t1)}
      </div>
      <div className="mb-2 border-t border-slate-100" />
      <div className="flex justify-between font-medium text-slate-800">
        <span>Total</span>
        <span>{bucket.total}</span>
      </div>
      {nonZeroBands.map((b) => (
        <div key={b} className="flex justify-between text-slate-600">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: BAND_FILLS[b] }}
            />
            {b}
          </span>
          <span>{bucket.byBand[b]}</span>
        </div>
      ))}
    </div>
  );
}

/** Pick up to 5 evenly-spaced tick indexes. */
function pickXTickIdxs(n: number): number[] {
  if (n <= 1) return [0];
  const count = Math.min(5, n);
  const step = (n - 1) / (count - 1);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round(i * step));
  }
  return out;
}

/** Round max up to a "nice" number and produce 4 evenly-spaced tick values. */
function buildYTicks(max: number): number[] {
  const nice = niceCeil(max);
  return [0, nice / 4, nice / 2, (nice * 3) / 4, nice].map((v) =>
    Number.isInteger(v) ? v : Math.round(v),
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const frac = n / exp;
  let niceFrac: number;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return Math.max(4, niceFrac * exp);
}

function formatShortTime(ms: number): string {
  const d = new Date(ms);
  // "MM-DD HH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
