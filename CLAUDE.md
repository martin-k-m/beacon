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

Beacon is **one product = a frontend (`apps/web`) + a backend (`apps/api`)**,
plus a CLI and shared packages.

```
apps/
  api/        Fastify REST API — the BACKEND (analysis, widgets, webhooks, insights)
  worker/     Background queue consumer (BullMQ) — re-scores on webhook events
  web/        Next.js 15 FRONTEND — landing + dashboard + health-trend charts (+ /components)
  cli/        beacon — terminal client (analyze / insights / contributors / dependencies / …)
              the ONLY published artifact → npm as @martin-k-m/beacon-cli
packages/
  shared/             Domain types + demo fixtures + the job-queue contract
  github/             GitHub REST client (fetch-based)
  ai/                 AI summary providers (heuristic / OpenAI / Anthropic)
  analytics/          The engine: scoring, trends, orchestrator, team health
  ai-advisor/         Recommendations engine (why health changed + what to do)
  dependency-engine/  Dependency classification (npm / PyPI / crates)
  plugins/            Extensibility foundation (analyzers/metrics/widgets/recommendations)
  sdk/                Programmatic client (@beacon/sdk)
  widgets/            Embeddable SVG widgets (health card, badge, language, etc.)
  ui/                 Shared React UI primitives (frontend)
  database/           Prisma schema + client (PostgreSQL)
  config/             Shared tsconfig + ESLint presets
docs/         architecture, scoring, api, cli, widgets, github-app, advisor, monitoring, self-hosting
```

(The public marketing site lives in a **separate repo**, `beacon-web` →
beacon.blinkdev.me. It is not part of this monorepo.)

Dependency direction: `shared` depends on nothing internal. `github`, `ai`,
`widgets`, `ui`, `database`, `dependency-engine`, `plugins` depend on `shared`;
`analytics` depends on `shared`+`github`+`ai`; `ai-advisor` on
`shared`+`analytics`+`ai`; `sdk` on `shared`+`analytics`+`github`. `api`,
`worker`, and `cli` depend on those. `web` depends on `shared`, `analytics`, and
`ui`. Never introduce a cycle.

**`@beacon/ui` is shipped as source** (no build step): its `main` points at
`src/index.ts` and the consuming Next apps must (1) list it in
`transpilePackages` and (2) include `../../packages/ui/src/**/*.{ts,tsx}` in
their Tailwind `content`. The design tokens/CSS variables it references
(`beacon`, `surface`, `.glass`, `--muted`, …) are provided by each app's
`globals.css` + `tailwind.config`, so both apps share one token set.

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
  `moduleResolution: Node`). The web app is ESM/bundler. Keep `@beacon/github`
  and `@beacon/analytics` free of Node-only APIs so they stay universal (they use
  only global `fetch`).
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

## The Beacon Score (packages/analytics/src/scoring.ts)

Weighted pillars — Activity 0.30, Community 0.20, Maintenance 0.20,
Documentation 0.15, Security 0.15. `computeBeaconScore(snapshot)` is pure. Each
pillar returns `reasons` (human-readable) that power the ✓/! highlights in the
UI, CLI, and widgets. Grades: Excellent ≥90, Healthy ≥75, Fair ≥60, At risk ≥40,
Critical <40. If you change scoring, keep `score.test.ts` passing (demo healthy
≥75, at-risk <60) and keep returning `reasons`. See `docs/scoring.md`.

## AI providers (packages/ai/src)

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

## Releasing (the CLI is the only published package)

`apps/cli` publishes to npm as **`@martin-k-m/beacon-cli`** (the command it
installs is still `beacon`). The `@beacon` scope is unavailable on npm, and the
unscoped `beacon`/`beacon-cli` names are taken — hence the maintainer's scope.
Every `@beacon/*` workspace package is `private` and is **never** published.

**The non-obvious part:** `apps/cli` deliberately has **no `dependencies`** —
only `devDependencies`. It is bundled by esbuild into one self-contained
`dist/index.js`, so the published tarball has zero runtime deps. This is
required, not stylistic: the CLI imports `@beacon/*` workspace packages at
version `"*"`, which npm cannot resolve for an end user. If you add a runtime
dependency to `apps/cli`, put it in `devDependencies` and let esbuild bundle it.
Putting it in `dependencies` ships a package that breaks on install.

To cut a release:

1. Bump `apps/cli/package.json`, then `npm install --package-lock-only` (CI runs
   `npm ci`; an unsynced lockfile fails the build).
2. Update `CHANGELOG.md`, commit, and tag — the workflow checks out the release
   ref, so the tag must already contain the change you're shipping.
3. Publish via the **Release CLI** workflow (`.github/workflows/release-cli.yml`)
   — a GitHub Release, or a manual `workflow_dispatch` (`dry_run: true` packs
   without publishing). It builds → tests → packs → `npm publish --provenance`.

The workflow needs the repo secret **`NPM_TOKEN`** (an npm granular token with
read+write on `@martin-k-m/beacon-cli`). It is already configured. The publish
step is guarded by `if: env.NPM_TOKEN != ''`, so a fork without the secret packs
and skips publishing instead of failing. Note that GitHub secrets are
write-only and npm shows a token value only at creation — if the token is lost
or expires, it must be regenerated, not recovered.

## Frontend stack constraints (apps/web)

`apps/web` runs **Next 15 + React 19 + Recharts 3**. Three non-obvious ties:

- **ESLint 8 pins Next to 15.** `eslint-config-next@16` requires **ESLint ≥9**,
  and this monorepo is on ESLint 8 everywhere (that's also why the
  `require.resolve` rule above exists). Going to Next 16 means a repo-wide flat-
  config migration first. Next 15.5.x already clears every current advisory.
- **Only ever ONE copy of React may exist.** React 19 rejects React-18-shaped
  elements (`Minified React error #31` while prerendering). The trap: nothing
  needs to *declare* React 18 for a second copy to appear — `framer-motion` and
  `@reduxjs/toolkit` (via Recharts) declare `peerOptional react`, which npm can
  satisfy by parking an old React at the root. Those root-level libs then build
  React 18 elements that React 19 refuses. If prerender dies, run:
  `find . -path "*/node_modules/react/package.json" -not -path "*/react-dom/*"`
  — more than one hit is the bug; `npm dedupe` collapses it, and the lockfile
  keeps it collapsed through `npm ci`.
- **Recharts 3 split the tooltip types.** `TooltipProps` is now the `<Tooltip>`
  component's own props (`active`/`payload` omitted — they come from context); a
  custom `content` renderer receives **`TooltipContentProps`**. Since Recharts
  injects those fields when it clones the element, custom tooltips type their
  props as `Partial<TooltipContentProps<…>>` and guard at runtime.

## Known-accepted dependency warnings

`npm audit` reports **2 moderate** findings for `postcss <8.5.10`
(GHSA-qx2v-qp2m-jg93, XSS via unescaped `</style>` in stringify output). This is
**accepted, not neglected**:

- It is `postcss` pinned inside **Next's own** dependency tree, not ours (our
  own postcss is 8.5.x). Every Next release through 16.x ships it, so upgrading
  Next does **not** clear it — `npm audit` even "fixes" it by proposing
  `next@9.3.3`, a four-year downgrade. Do not run `npm audit fix --force`.
- An `overrides` entry was tried and **does not work** — npm declines to override
  Next's pinned nested copy, so shipping one would imply a fix that isn't real.
- Impact is nil in practice: postcss runs at **build time** over CSS the
  maintainers author, never over untrusted input, and never ships to users.

Revisit when Next ships a patched postcss.

## Gotchas checklist

- Ran `npm run db:generate`? (Prisma client must exist.)
- New package: `.eslintrc.cjs` uses `require.resolve`; extends `@beacon/config`
  tsconfig; added to the right dependency layer; CommonJS.
- `commitActivity[i].weekStart` is **unix seconds** — ×1000 for `Date`.
- Recharts/Framer/browser code in the web app must be in `'use client'` files.
- Don't put Node-only APIs in `@beacon/github`/`@beacon/analytics` (keep them universal).
- `DependencyManifest.dependencyCount` is `number | null`. **`null` means
  "unknown", never "none"** — remote GitHub collection lists the repo tree but
  doesn't read manifest contents, so only local analysis reports a real count.
- Dynamic route params in `apps/web` are **async** (Next 15): `await params`.
- npm may add an `allowScripts` field to `package.json` in sandboxed
  environments. It's a local artifact — don't commit it.
- **Never regenerate `package-lock.json` from scratch on Windows** (i.e. delete
  it and `npm install`). The lock must carry the platform-specific optional
  packages for **every** OS — `@rollup/rollup-linux-x64-gnu` (vitest→vite→rollup)
  and `@esbuild/linux-x64` (the CLI bundler). A Windows-only regeneration keeps
  just the win32 ones, everything still passes locally, and then **CI dies on
  Linux** with "Cannot find module @rollup/rollup-linux-x64-gnu" (npm/cli#4828).
  The published lock should list ~25 rollup and ~26 esbuild platform entries —
  check with:
  `grep -o '"node_modules/@rollup/rollup-[a-z0-9-]*"' package-lock.json | sort -u | wc -l`
  Prefer targeted edits (`npm install --package-lock-only` over the existing
  lock). If the lock must be rebuilt, use the same npm major CI uses — Node 20 →
  `npx npm@10 install --package-lock-only` — and re-check the counts above.
