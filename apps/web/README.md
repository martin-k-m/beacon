# @beacon/web

The Beacon dashboard — the flagship Next.js UI for GitHub repository
intelligence. Dark-mode-first, built with the App Router, Tailwind, Framer
Motion, and Recharts.

## Pages

| Route | Description |
| --- | --- |
| `/` | Landing page — hero with a repository search box, features grid, and a live preview built from demo data. |
| `/dashboard` | Control center — a search box plus a grid of cards for every analyzed repository, each with a mini score ring. |
| `/dashboard/[owner]/[repo]` | The main analytics surface — animated Beacon Score, pillar breakdown, commit timeline, language donut, contributors, releases, and issue/PR health. Renders a not-found state for unknown repos. |
| `/components` | A living style guide rendering every reusable UI primitive. |

## Data: demo mode vs. API mode

All data flows through a single typed client in `src/lib/api.ts`. It has two
modes, chosen at runtime by the `NEXT_PUBLIC_API_URL` environment variable:

- **Demo mode (default).** When `NEXT_PUBLIC_API_URL` is unset, the app renders
  from the deterministic demo fixtures bundled in `@beacon/core`
  (`demoSnapshots`). Scores are computed synchronously via `computeBeaconScore`,
  and a natural-language summary is generated locally (`src/lib/data.ts`). No
  network, no API keys — the UI is always fully populated.
- **API mode.** When `NEXT_PUBLIC_API_URL` is set (e.g.
  `http://localhost:4000`), the client fetches:
  - `GET {base}/api/repositories/:owner/:repo` for a single analysis, and
  - `GET {base}/api/demo` for the dashboard list.

  Every request is wrapped in `try/catch` and **falls back to demo data** on any
  transport or parse error, so the dashboard never renders empty.

Set the base URL by copying `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
# then edit:
# NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Architecture notes

- **Data module.** `src/lib/data.ts` (demo fixtures → analyses) and
  `src/lib/api.ts` (typed client) are the only sources of data. Components never
  hardcode metrics.
- **Server vs. client.** Pages are Server Components and call the async data
  client directly. Anything using Recharts, Framer Motion, or browser APIs is a
  `'use client'` component (charts, `ScoreRing`, `RepoSearch`, `Reveal`, etc.).
- **`commitActivity.weekStart` is unix seconds** and is multiplied by 1000
  before constructing a `Date` (see `commit-timeline.tsx`).
- **Design system.** Tokens live in `tailwind.config.ts` + `globals.css`
  (near-black background, amber `beacon` accent, cyan secondary, Inter + JetBrains
  Mono via `next/font`). The `.glass` utility provides the frosted card surface.

## Scripts

```bash
npm run dev        # next dev on http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm run clean      # remove .next
```

Part of the [Blink Dev](https://blinkdev.me) ecosystem. MIT licensed.
