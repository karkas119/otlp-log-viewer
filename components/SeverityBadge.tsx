import type { SeverityBand } from "@/lib/otlp/transform";

const BAND_STYLES: Record<SeverityBand, string> = {
  UNSPECIFIED: "bg-slate-200 text-slate-700 ring-slate-300",
  TRACE: "bg-slate-100 text-slate-600 ring-slate-300",
  DEBUG: "bg-slate-200 text-slate-700 ring-slate-300",
  INFO: "bg-sky-100 text-sky-800 ring-sky-300",
  WARN: "bg-amber-100 text-amber-900 ring-amber-300",
  ERROR: "bg-rose-100 text-rose-800 ring-rose-300",
  FATAL: "bg-red-200 text-red-900 ring-red-400",
};

export function SeverityBadge({
  band,
  text,
}: {
  band: SeverityBand;
  text?: string;
}) {
  const label = text && text.length > 0 ? text : band;
  return (
    <span
      className={`inline-flex min-w-[68px] justify-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${BAND_STYLES[band]}`}
      title={`Severity band: ${band}`}
    >
      {label}
    </span>
  );
}
