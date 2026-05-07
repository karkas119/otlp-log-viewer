# OTLP Log Viewer

A web app that visualises OpenTelemetry log records from the Dash0 take-home
API. Lets engineers scan logs, drill into record/resource/scope attributes,
and understand volume distribution by severity and service.

Built for the [Dash0 take-home assignment](https://github.com/dash0hq/take-home-assignments/tree/main/otlp-log-viewer).

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript 5**
- **Tailwind CSS 3** for styling
- No chart library — the histogram is a ~200-line SVG component. Dropping a
  chart library for a single chart felt like over-kill for the scope.

## Run it

```bash
npm install
npm run dev         # http://localhost:3000
```

Other scripts:

```bash
npm run build       # production build
npm run start       # serve production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

The upstream API URL can be overridden for development via
`OTLP_LOGS_URL=…`. Defaults to the assignment API.

## Architecture at a glance

```
app/
  api/logs/route.ts   Thin proxy in front of the upstream API (CORS + cache control)
  page.tsx            Composes header, histogram, toggle, and list view
  layout.tsx          Root layout + Tailwind globals
components/
  Histogram.tsx       SVG histogram, stacked by severity band, with hover tooltip
  LogTable.tsx        Flat table (severity / time / resource / body)
  LogRow.tsx          Expandable row revealing log, resource, scope attrs + raw JSON
  GroupedLogList.tsx  Collapsible per-resource sections with per-band counts
  ViewModeToggle.tsx  Flat / grouped segmented control
  SeverityBadge.tsx   Severity pill with band-based colour
  AttributesGrid.tsx  Key/value grid used for all attribute blocks
lib/
  otlp/transform.ts   flatten / groupByResource / bucketRows / severityBand helpers
                      + local SeverityBand display type
  hooks/useLogs.ts    Tiny fetch hook with loading / error / refresh
  format.ts           Timestamp helpers
```

### Data flow

1. `useLogs()` fetches `/api/logs` (a Next route handler proxy).
2. `flattenLogs()` walks the `resourceLogs[] → scopeLogs[] → logRecords[]`
   tree into a flat `FlatLogRow[]` pre-joined with resource + scope context,
   so downstream components don't need to re-walk the nested OTLP shape.
3. The page branches on view mode: flat → `LogTable`, grouped →
   `GroupedLogList` (which `groupByResource`s on `service.namespace +
   service.name`).
4. `Histogram` always sees the full flat list and buckets it independently
   of view mode (switching grouping shouldn't change the histogram).

### OTLP types

Imported directly from `@opentelemetry/otlp-transformer`, pinned to
**`0.56.0`**. That's the last release where the log-side request types
(`IExportLogsServiceRequest`, `IResourceLogs`, `ILogRecord`, etc.) are
part of the public export map — from `0.57.0` they were moved to
`internal-types.d.ts` and dropped from the package exports.

Pinning the exact version means we consume the canonical, maintained
OTLP type definitions without duplicating them in the repo. The pin is
narrow (no caret) so a future `npm install` won't silently pull in a
release where the imports stop resolving.

The one locally-defined type is `SeverityBand` in `lib/otlp/transform.ts` —
a display grouping of the 24 OTel severity numbers into 7 bands. It lives
next to the transform helpers that produce and consume it.

### Severity handling

OTel severity numbers (1–24) are grouped into 7 bands
(`UNSPECIFIED` / `TRACE` / `DEBUG` / `INFO` / `WARN` / `ERROR` / `FATAL`)
following the [Log Data Model spec](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber).
This keeps colour coding consistent even when upstream emits `severityText`
values like `INFO2` or `ERROR4`. `severityText` is still displayed verbatim
in the badge — only the colour is band-derived.

### Time handling

`timeUnixNano` is sent as a numeric string (OTLP encodes uint64 as strings
to avoid JS `Number` precision loss). Converted via `BigInt` before
dividing down to milliseconds for display and bucketing.

## UX choices

- **Newest-first** ordering in the flat list — industry convention for log
  UIs (Datadog, Grafana, Cloud Logging).
- **UTC timestamps** with sub-second precision. Observability tools almost
  always normalise to UTC so traces and logs line up across regions.
- **Stacked histogram** colours volume by severity band so spikes in
  errors/fatals are visible at a glance, not just total volume.
- **Groups default expanded** and include per-band count chips — you can
  see which services are noisy without opening anything.
- **Resource column** in flat mode so logs always carry their service
  identity; hidden inside grouped view since the group header already
  supplies it.
- **Expanded row** shows three separate attribute blocks (log / resource /
  scope) plus the raw JSON for fallback when something unusual shows up.

## Trade-offs and things I deliberately skipped

- **No server components for data.** The page is `"use client"` because
  refresh + interactivity dominate the UX. Server-rendering the initial
  fetch would shave ~200ms off first paint; the cost is SSR-vs-CSR
  duplication in a UI where the data changes on every refresh anyway.
- **No fetch library.** One endpoint, one method, no cache invalidation
  needs. SWR / TanStack would add surface area without carrying their
  weight here.
- **No virtualisation.** The API returns ~60 rows; virtualising is a 1-hour
  detour for zero current benefit. Would be the first thing to add once
  filtering + streaming push row counts into the thousands.
- **Mock timestamps span ~30 days.** With 48 buckets that's ~15h per
  bucket, so adjacent bars often read similarly. Fine for the shape of
  the problem; a real deployment would want dynamic binning tied to a
  time-range selector.
- **Severity filtering is not implemented.** It would be a natural add
  (click a legend item to toggle visibility), but it overlaps with Part 2
  so I left it for discussion.
- **No tests.** Given the 4-hour budget I prioritised getting all three
  required views working correctly over setting up Vitest/RTL. The
  transformation layer in `lib/otlp/transform.ts` is the obvious
  test-first target — pure functions, explicit invariants.

## Part 2 — discussion notes

*Prepared for the follow-up interview; not implemented.*

### Clarifying questions

**Product**
- Who is the primary user — on-call responding to pages, or SRE doing
  post-incident forensics? The two want very different defaults.
- "Share findings" — is the unit a single log line, a filtered view, a
  time window, or an annotated snapshot? Each has different permalink
  semantics.
- Is filtering the product intent, or a precursor to alerting / saved
  searches? Building filters as disposable vs. saved changes the UI.

**Backend**
- Is filtering happening server-side against a query engine (and if so,
  what query language — Lucene, LogQL, PromQL-like)? Or do we pull a
  time window and filter in the browser?
- What are realistic cardinalities — records per page, distinct services,
  distinct attribute keys? This decides whether we can afford in-memory
  attribute-key enumeration for autocomplete.
- Does the API support pagination / streaming, or is it one-shot? Changes
  whether the UI needs a cursor model.

**Users**
- Show me the last time you wished you could filter. What were you
  filtering on? (Expected: severity ≥ WARN, service name, time window,
  free-text body search, specific attribute values like `user.id`.)
- When you shared a finding last, how — screenshot, link, Slack copy-paste?

### Structuring the solution

Two UI primitives, layered:

1. **Quick filters** — pinned controls that cover the 80% case: severity
   range chips, service selector, time range. Low friction; no new
   concepts.
2. **Filter bar / query input** — typed expressions like
   `service.name = "circuit" AND severity >= WARN AND body ~ "redundant"`.
   Higher ceiling, but needs a grammar and an autocomplete affordance.

**URL as single source of truth.** All filter state, view mode, selected
log, and time range go in search params. Sharing = copying the URL. This
also makes the back button free and lets users bookmark investigations.

**Architecture layers**

- A `LogQuery` type (severity bands, services, time range, body query,
  attribute predicates) with a deterministic serialiser to/from
  `URLSearchParams`.
- A `parseLogQuery` / `serialiseLogQuery` pair — pure, testable.
- A server-side filter path that accepts the same query, pushes down what
  the backend supports, and lets the client finish what it can't.
- On the UI side: quick-filter components read from and dispatch updates
  to the URL; the query bar does the same. Keeps any surface from becoming
  privileged.

**Sharing UX**

- Copy-link button on the filter bar that writes the canonical URL —
  discoverable even if users don't realise the URL is live.
- A `Share` affordance on individual rows pre-fills the URL with a
  `selected=<id>` param. Hosts a "Generate markdown / Slack-friendly
  snippet" option that includes the permalink plus a rendered preview.

### Trade-offs

**Quick filters vs. query bar.** Quick filters are learnable in seconds
but hit a ceiling fast; a query language is expressive but asks users to
learn syntax. Ship both. Start with quick filters only and introduce the
query bar once we see the quick-filter ceiling being hit in analytics.

**Client-side filtering vs. server-side.** Client-side is instant and
offline-friendly, but only works for data already on the page. Server-side
scales but adds latency and needs an API contract. Hybrid: the client
always re-filters the page it has, and also sends the query upstream to
pull the matching window. Users get instant feedback even while the next
page arrives.

**URL-as-state vs. in-app state.** URL-as-state gets free sharing and back
buttons, but URLs can get long. Acceptable; if it becomes a problem, swap
long filter blobs for short ids backed by a saved-views store.

**Observability-specific awareness.**
- Cardinality matters: autocomplete for attribute keys is fine; autocomplete
  for attribute *values* can explode at high cardinality — lazy-load it.
- Time-range queries often anchor on the histogram — click-and-drag on
  the histogram to set the time window is the single highest-leverage
  feature we'd add next.
- Structured log query features (exists/missing/IN lists) matter more
  than free-text for engineers who know their schema.

## License

MIT — this is a take-home project; feel free to read, copy, or learn from
anything here.
