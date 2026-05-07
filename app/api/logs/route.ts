import { NextResponse } from "next/server";

/**
 * Thin proxy in front of the assignment's OTLP logs API.
 *
 * Why proxy via the server instead of calling from the browser:
 *  - Avoids CORS coupling to an upstream we don't control.
 *  - Keeps the upstream URL server-side (easier to swap for a private OTel
 *    collector without touching the client).
 *  - Lets us set a short `no-store` cache policy while the upstream sends
 *    random data on every request — without this, aggressive client fetch
 *    caching would make the refresh button feel broken.
 */
const UPSTREAM =
  process.env.OTLP_LOGS_URL ??
  "https://take-home-assignment-otlp-logs-api.vercel.app/api/logs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(UPSTREAM, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream responded ${res.status}` },
        { status: 502 },
      );
    }
    const body = await res.json();
    return NextResponse.json(body, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Failed to reach upstream: ${message}` },
      { status: 502 },
    );
  }
}
