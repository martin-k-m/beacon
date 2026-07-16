# @beacon/dashboard — Beacon Analytics

A dedicated **repository health analytics** app for the Beacon monorepo. Its
signature feature is **historical health trend charts**: it shows how a
repository's Beacon Score and its five pillars move over time, not just where
they stand today.

Built with Next.js 14 (App Router), it consumes the shared **`@beacon/ui`**
component library and is powered by **`@beacon/core`** (scoring + demo history)
and the new **`@beacon/analytics`** package (trends + narratives).

## How this differs from `apps/web`

| | `apps/web` | `apps/dashboard` (this app) |
| --- | --- | --- |
| Focus | Marketing + point-in-time analysis | **Historical trends over time** |
| Headline feature | AI health summary | **Health History & Trend** chart with range toggle + per-pillar deltas |
| Trend engine | — | **`@beacon/analytics`** (`computeTrend`, `toHealthSeries`) |
| History source | — | **`@beacon/core`** `generateDemoHistory` (or live `/trend` API) |
| UI primitives | local `src/components/ui/*` | shared **`@beacon/ui`** package |
| Dev port | 3000 | **3001** |

Both apps share the same Beacon design language (dark theme, amber `beacon`
accent, glass cards, smooth Framer Motion animation) via a copied `globals.css`
and Tailwind token config, so the shared `@beacon/ui` components render
identically.

## The signature feature — Health History & Trend

`src/components/health-trend.tsx` (a `'use client'` component) renders:

- a Recharts **area chart** of Beacon Score (0–100) over time, gradient fill
  colored by trend direction, with a dark glass tooltip;
- a natural-language **trend narrative** (e.g. _"Repository health improved 12%
  over the last 90 days"_) plus a colored **delta chip** (green up / red down /
  amber flat), all from `computeTrend`;
- a **range toggle** (30d / 90d / 1y / All) that re-windows the series entirely
  client-side via `filterRange`;
- **per-pillar movement** tiles with up/down deltas.

## Data flow

`src/lib/data.ts` mirrors `apps/web`'s `buildDemoAnalysis` / `DemoAnalysis` /
`getDemoAnalyses` / `getDemoAnalysis`, and adds:

- **`getDemoTrend(owner, repo, range)`** →
  `computeTrend(toHealthSeries(generateDemoHistory(snapshot)), range)`,
  returning the full `series` (for charting) plus the computed `trend`. The
  trend is measured relative to the **newest point** in the series rather than
  the wall clock, so every range window always has data in demo mode.

`src/lib/api.ts` is a resilient typed client:

- **Demo mode** (default, `NEXT_PUBLIC_API_URL` unset): renders from
  `@beacon/core` fixtures + synthesized history.
- **Live mode** (`NEXT_PUBLIC_API_URL` set): fetches
  `GET {base}/api/repositories/:owner/:repo` and
  `GET {base}/api/repositories/:owner/:repo/trend?range=`. Any transport/parse
  error falls back to demo data, so the UI is always populated.

## Routes

| Route | Description |
| --- | --- |
| `/` | Dashboard home: repo search (parses `owner/repo` or a GitHub URL) + a grid of demo repo cards. |
| `/[owner]/[repo]` | Deep analytics: repo header + quick stats, score + AI summary, **Health History & Trend**, pillar breakdown, commit activity, languages, contributors, releases, and issue/PR health. Shows a not-found state for unknown repos in demo mode. |
| `/components` | Living style guide for every `@beacon/ui` primitive. |

## Scripts

```bash
npm run dev        # next dev on port 3001
npm run build      # next build
npm run start      # next start (port 3001 via PORT env / start script)
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm run clean      # rimraf .next
```

## Configuration

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to point at a
running Beacon API for live data. Leave it unset for demo mode.

## Notes

- Strict TypeScript with `noUncheckedIndexedAccess`; all array indexing is
  guarded.
- `commitActivity[i].weekStart` is a **unix timestamp in seconds** — multiply by
  1000 before constructing a `Date`.
- Any Recharts / Framer Motion / stateful component is a `'use client'`
  component.
