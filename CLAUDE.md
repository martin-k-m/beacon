# CLAUDE.md

Context for Claude Code (and any AI agent) working in this repository. Read this
first — it explains the architecture, conventions, and the non-obvious gotchas.

## What Beacon is

Beacon is an open-source **GitHub repository intelligence platform**. It collects
a repository's signals, computes an explainable **Beacon Score** (0–100 across
five weighted pillars), generates an AI health summary, tracks health over time,
and exposes everything through a REST API, a dashboard, a CLI, and embeddable SVG
widgets.

The single most important idea: **everything is a pure function of a
`RepositorySnapshot`.** Collection (GitHub) is separated from analysis (scoring +
AI), so scores are deterministic, testable, and reproducible.

## Monorepo layout

Turborepo + npm workspaces. Packages are small and single-purpose.

```
apps/
  api/    Fastify REST API — analysis, persistence, caching, widgets, webhooks
  web/    Next.js 14 dashboard (landing + /dashboard + repo pages + /components)
  cli/    beacon-cli — analyze / widget / badge / watch
packages/
  core/       The engine: GitHub client, scoring, AI providers, analyzer, demo data
  widgets/    Embeddable SVG widgets (health card, badge, language, etc.)
  analytics/  Historical health series + trend computation
  database/   Prisma schema + client (PostgreSQL)
  config/     Shared tsconfig + ESLint presets
docs/         Architecture, scoring, api, widgets, github-app, self-hosting
```

Dependency direction: `core` depends on nothing internal. `widgets`, `analytics`,
`database` depend on `core`. `api` and `cli` depend on those. `web` depends on
`core`. Never introduce a cycle.

## Commands

Run from the repo root (they fan out through Turborepo):

```bash
npm install            # install the workspace
npm run db:generate    # generate the Prisma client (REQUIRED before typecheck/build)
npm run build          # build every package/app
npm run test           # vitest across packages
npm run lint           # eslint / next lint
npm run typecheck      # tsc --noEmit everywhere
npm run dev            # run all apps in watch mode
```

Per-package: `npm run <script> --workspace @beacon/<name>`.

## Conventions

- **Language:** TypeScript, strict, with `noUncheckedIndexedAccess`. Guard array
  indexing (`arr[0]` is `T | undefined`).
- **Modules:** the Node packages (`core`, `widgets`, `analytics`, `database`,
  `api`, `cli`) are **CommonJS** (`"type": "commonjs"`, `module: CommonJS`,
  `moduleResolution: Node`). The web app is ESM/bundler. Keep `@beacon/core` free
  of Node-only APIs so it stays universal (it uses only global `fetch`).
- **tsconfig:** each package extends `@beacon/config/tsconfig/base.json` (Node) or
  `.../react.json` (web).
- **ESLint:** each package's `.eslintrc.cjs` must extend the shared config via
  **`require.resolve`**, not a bare specifier:
  ```js
  module.exports = { extends: [require.resolve('@beacon/config/eslint/base.js')] };
  ```
  ESLint 8's shareable-config name normalization mangles scoped subpaths, so a
  bare `'@beacon/config/eslint/base.js'` fails to resolve. This bit us; use
  `require.resolve`.
- **Prisma:** the generated client lives in `node_modules/@prisma/client`. Run
  `npm run db:generate` before typechecking/building `database`, `api`, or code
  that imports `@beacon/database`. Turborepo's `^build` handles ordering in
  `build`, but `typecheck` on a fresh checkout needs a generate first.
- **Formatting:** Prettier (`npm run format`). Single quotes, semicolons, width 100.

## The Beacon Score (packages/core/src/scoring/score.ts)

Weighted pillars — Activity 0.30, Community 0.20, Maintenance 0.20,
Documentation 0.15, Security 0.15. `computeBeaconScore(snapshot)` is pure. Each
pillar returns `reasons` (human-readable) that power the ✓/! highlights in the
UI, CLI, and widgets. Grades: Excellent ≥90, Healthy ≥75, Fair ≥60, At risk ≥40,
Critical <40. If you change scoring, keep `score.test.ts` passing (demo healthy
≥75, at-risk <60) and keep returning `reasons`. See `docs/scoring.md`.

## AI providers (packages/core/src/ai)

`AIProvider` interface with `HeuristicProvider` (offline default), `OpenAIProvider`,
`AnthropicProvider`. `createAIProvider(config)` resolves from env; hosted providers
fall back to heuristic on any error. Select via `BEACON_AI_PROVIDER`.

## Widgets (packages/widgets)

Pure SVG string renderers keyed by `WidgetType`
(`health|activity|language|contributor|release|badge`). `renderWidget(type,
analysis, options)` and `renderMaintenanceBadge`. Options: `theme`
(dark/light/transparent), `size` (small/medium/large). `embedSnippets(host,
owner, repo, type, options)` builds the Markdown/HTML embed code. Served by the
API at `/widget/:type/:owner/:repo` and `/badge/:owner/:repo`. No external fonts
or assets — everything is inline. See `docs/widgets.md`.

## Analytics (packages/analytics)

`toHealthSeries(analyses)` → `computeTrend(series, range)` where range is
`30d|90d|1y|all`. Produces per-pillar deltas and a narrative
("health improved 12% over the last 30 days"). Pure; accepts an injectable `now`.

## Zero-config guarantee

The API and CLI must run with **no** database, Redis, GitHub token, or AI key:
- No DB → analyses computed on demand, no history stored.
- No Redis → in-memory TTL cache.
- No token → anonymous GitHub (60 req/hr) or demo data.
- No AI key → heuristic summaries.
`GET /api/demo` and `beacon analyze <repo> --demo` always work offline. Do not
break this — it's what makes the project approachable.

## When you add a feature

Keep everything synchronized (this is a stated project goal):
1. Implement in the owning package with tests.
2. Surface it in the API and/or CLI.
3. Update the dashboard (`apps/web`) if it's user-facing.
4. Update the docs — **primarily the website** (`beacon-web` repo, `/docs`), and
   the `docs/` folder here.
5. Update `README.md` and `CHANGELOG.md`.

## Gotchas checklist

- Ran `npm run db:generate`? (Prisma client must exist.)
- New package: `.eslintrc.cjs` uses `require.resolve`; extends `@beacon/config`
  tsconfig; added to the right dependency layer; CommonJS.
- `commitActivity[i].weekStart` is **unix seconds** — ×1000 for `Date`.
- Recharts/Framer/browser code in the web app must be in `'use client'` files.
- Don't put Node-only APIs in `@beacon/core`.
