/**
 * Compact ISO-like timestamp — observability tools tend to favor precision
 * over locale-friendliness. UTC keeps columns aligned across timezones.
 */
export function formatTimestamp(ms: number): string {
  if (!ms || Number.isNaN(ms)) return "—";
  const d = new Date(ms);
  const iso = d.toISOString();
  // "2024-01-20T12:34:56.789Z" → "2024-01-20 12:34:56.789"
  return iso.replace("T", " ").replace("Z", "");
}

export function formatRelative(ms: number, now: number = Date.now()): string {
  const diff = now - ms;
  if (diff < 0) return "in the future";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
