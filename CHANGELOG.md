# Changelog

All notable changes to Beacon are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **The README's SDK example did not work.** It showed
  `Beacon.analyze('facebook/react')`, but `Beacon` is a class and `analyze` is an
  instance method — there is no static `Beacon.analyze` (verified: it is
  `undefined`). The example now constructs a client, and the one-shot `analyze()`
  helper the SDK also exports is documented alongside it. `docs/architecture.md`
  carried the same wrong call shape in the package table.
- **`docs/cli.md` under-reported `--local`.** It listed the flag as available on
  `analyze`, `score`, `report`, `widget`, `badge`, and `watch`, omitting
  `insights`, `contributors`, and `history`, which have supported it since the
  Phase 2 commands landed.
- **`README.md` claimed "every command supports `--json`".** `badge`, `watch`,
  `init`, `login`, and `logout` don't; the wording now matches `docs/cli.md`
  ("every command that produces data").
- **`CLAUDE.md` listed a package that no longer exists.** The CommonJS
  convention still named `core`, retired in the engine decomposition. The note
  now lists the real set and both frontend exceptions (`apps/web`, `@beacon/ui`).

## [1.2.0] - 2026-07-17

A finalization pass: one correctness fix, the dependency backlog cleared, the
frontend moved onto a supported stack, and the plugin system actually connected
to the product.

### Added

- **Plugins are now reachable.** `@beacon/plugins` was fully built and tested but
  imported by nothing — no plugin could ever run, and because the package is
  private (the CLI is Beacon's only published artifact), its "third parties ship
  plugins" premise was unreachable from both ends. Plugins are now a
  **self-hosting** feature, wired end to end:
  - **`BEACON_PLUGINS`** — comma-separated module specifiers loaded by the API at
    boot. Relative paths resolve against the working directory (not the API's
    build output, which is what a naive dynamic import would have done). A module
    that fails to import, or exports something that isn't a plugin, is logged and
    skipped — **a broken plugin never stops the API booting** (verified).
  - **`GET /api/plugins`** — what's loaded, with each plugin's analyzers,
    recommenders, and widget types.
  - **`GET /api/repositories/:owner/:repo/plugins`** — runs every analyzer and
    recommender against the repository. With no plugins registered it returns
    empty collections *without* contacting GitHub.
  - **Plugin widgets render through the existing `/widget/:type/:owner/:repo`**
    route — same cache, same "unavailable" card. Built-in types always take
    precedence; unknown types fall through to the registry.
  - New [`docs/plugins.md`](docs/plugins.md), plus 12 tests covering the loader,
    the routes, precedence, and failure isolation.

  Unset `BEACON_PLUGINS` remains the default: no plugins, everything works.

Verified from a clean `npm ci`: **lint 26 · typecheck 26 · test 20 (141 tests) ·
build 15**, all green, plus a live API run with a real plugin loaded.

### Fixed

- **Remote analysis no longer reports every repository as having zero
  dependencies.** `GitHubClient.getDependencies()` hardcoded `dependencyCount:
  0` for each detected manifest, so a repository with 50 dependencies reported
  `0` — a factual error, not a missing feature. Remote collection lists the
  repository tree without reading manifest contents, so the count is genuinely
  unknown there; it now reports `null`, matching the honest `null` already used
  for `vulnerabilityAlertCount`. Local analysis (`--local`) parses manifests off
  disk and still reports real counts. Covered by new tests that exercise
  `getSnapshot` through an injected fetch.

### Changed

- **BREAKING (type):** `DependencyManifest.dependencyCount` is now
  `number | null`. **`null` means "unknown", never "none".** Consumers reading
  `dependencyCount` from `beacon analyze --json` or `@beacon/sdk` must handle
  `null` — remote analyses now emit `null` where they previously emitted `0`.

### Security

- **vitest 2.1.8 → 3.2.7** across all nine packages that declare it, clearing
  **10 critical** advisories. Development-only (a test runner is never shipped);
  no test or config changes were needed.
- **Next.js 14.2.35 → 15.5.20**, clearing 28 advisories including 10 high.
  Deliberately Next **15**, not 16: `eslint-config-next@16` requires ESLint ≥9
  and this repo is on ESLint 8 throughout, so Next 16 would force a repo-wide
  flat-config migration. Next 15.5.x clears every current advisory.
- **esbuild 0.24 → 0.25** (development; bundles the CLI).
- The published CLI was never affected by any of the above — it has zero runtime
  dependencies.
- **Two moderate `postcss` findings remain and are accepted, with reasons** —
  see "Known-accepted dependency warnings" in `CLAUDE.md`. They are Next's own
  pinned copy (present in every Next release through 16.x, so unfixable by
  upgrading), an `overrides` entry provably does not apply to it, and postcss
  runs at build time over maintainer-authored CSS only. `npm audit fix --force`
  "resolves" them by installing `next@9.3.3` — do not run it.

### Upgraded (frontend)

- **React 18.3.1 → 19.2.7** (`apps/web` + `@beacon/ui`, moved in lockstep since
  `@beacon/ui` ships as source), aligning the dashboard with `beacon-web`.
- **Recharts 2 → 3.9.2**, required because Recharts 2's types are incompatible
  with React 19's JSX namespace. Custom tooltips now type against
  `TooltipContentProps` instead of `TooltipProps`.
- **Next 15 async params:** dynamic route params are now a `Promise` and are
  awaited in `dashboard/[owner]/[repo]`.
- Deduplicated React. `framer-motion` and `@reduxjs/toolkit` declare
  `peerOptional react`, which let npm park a second React 18 at the root even
  though no workspace declared it; those root-level libraries then produced
  React-18-shaped elements that React 19 rejected at prerender
  (`Minified React error #31`). The lockfile now resolves a single React 19
  through `npm ci`.

## [1.1.2] - 2026-07-16

**Beacon's first release published to npm.** The CLI is now installable by
anyone — no clone, no build:

```bash
npm install -g @martin-k-m/beacon-cli
beacon analyze facebook/react
```

Published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so the tarball is cryptographically linked to the workflow run and commit that
built it.

### Changed

- **Renamed the published CLI package from `@beacon/cli` to
  `@martin-k-m/beacon-cli`.** The `@beacon` scope is not available on npm (and
  the unscoped `beacon` / `beacon-cli` names are taken), so the CLI now ships
  under the maintainer's existing scope. **The command is unchanged — it is
  still `beacon`** — and the package was never published under the old name, so
  nothing to migrate:

  ```bash
  npm install -g @martin-k-m/beacon-cli
  beacon analyze facebook/react
  ```

  The internal workspace packages (`@beacon/analytics`, `@beacon/shared`, …)
  keep their names; they are not published.

## [1.1.1] - 2026-07-16

### Changed

- Documentation only — no code changes. Brought the written context in line with
  the Phase 2 package layout: the README structure tree, the `docs/architecture.md`
  package table and data-flow diagram, `docs/self-hosting.md`, and
  `CONTRIBUTING.md` now describe the decomposed engine (`shared`, `github`, `ai`,
  `analytics`, `ai-advisor`, `dependency-engine`, `plugins`, `worker`), and the
  retired `@beacon/core` references are gone. The marketing site now advertises
  the AI Advisor, dependency intelligence, team health, and continuous monitoring.

## [1.1.0] - 2026-07-16

### Added

- **`@beacon/ai-advisor` — the AI Advisor**: a pure, deterministic rule engine
  (`adviseIssues`) that surfaces grounded, prioritized issues with concrete
  recommendations, plus `generateAdvice` for a headline + narrative summary
  (optionally written by a hosted provider, always falling back to a heuristic).
- **`@beacon/dependency-engine`**: dependency-free classification of a project's
  dependencies (current / outdated / unmaintained / vulnerable / unknown) against
  npm, PyPI, and crates.io, with online (`MultiRegistryClient`) and offline
  (`OfflineRegistryClient`) registry clients.
- **Team-health analytics** (`@beacon/analytics.computeContributorHealth`): bus
  factor, maintainer load, active contributors, and a contribution distribution.
- **Plugins** (`@beacon/plugins`): an extensible surface for third-party analysis.
- **New CLI commands**: `beacon insights` (AI Advisor), `beacon contributors`
  (team health), `beacon dependencies` (local manifest analysis of package.json /
  requirements.txt / pyproject.toml / Cargo.toml), and `beacon history` (health /
  event timeline with `--range`). All support `--json` and `--no-color`.
- **New API endpoints**: `GET /api/repositories/:owner/:repo/insights`,
  `GET /api/repositories/:owner/:repo/contributors`, and
  `GET /api/repositories/:owner/:repo/events`.
- **Event model & timeline**: the `RepositoryEvent` and `AIRecommendation`
  database models; `store.getEvents` / `recordEvent` / `saveRecommendation`; and
  webhook-driven event recording so monitoring populates the timeline. New docs:
  [advisor](docs/advisor.md) and [monitoring](docs/monitoring.md).

## [1.0.0] - 2026-07-16

### Added

- **`@martin-k-m/beacon-cli` — a first-class terminal client** (bundled,
  self-contained, `npm install -g @martin-k-m/beacon-cli`; the command is
  `beacon`): `login` (GitHub device flow + `--with-token`),
  `analyze` (current repo / `owner/repo` / `--local` offline), `score`, `report`
  (`--json`/`--markdown`/`--html`), `widget`, `badge`, `watch`, `init`, and an
  interactive `dashboard` TUI. Offline local analyzer for JS/TS, Python, Go,
  Rust, and Java; config at `~/.beacon/config.json` and `.beacon/config.json`.
- **`@beacon/sdk`**: a programmatic client — `Beacon.analyze('owner/repo')` over
  the API or directly via GitHub.
- **`apps/worker`**: a BullMQ queue consumer that re-scores repositories from
  webhook events; the API enqueues jobs (inline fallback without Redis).
- **Health-history trend charts** in the dashboard (`apps/web`): Beacon Score
  over time with a range toggle (30 / 90 / 365 days), a trend narrative, and
  per-pillar deltas, powered by `@beacon/analytics`.
- **`@beacon/ui`**: a shared React component library (Button, Badge, Card,
  ScoreRing, ProgressBar, StatCard, ChartCard, Skeleton + presentational utils),
  consumed by the `apps/web` frontend.
- **Demo history** (`generateDemoHistory` in `@beacon/analytics`): deterministic
  synthetic score history per demo repository, so trends render with zero data;
  the database seed now inserts a 12-point history per repo.
- **Embeddable widget system** (`@beacon/widgets`): self-contained SVG widgets —
  repository health card, activity graph, language card, contributor card,
  release card, and a shields-style maintenance badge. Themes (dark / light /
  transparent), sizes (small / medium / large), and copy-paste Markdown/HTML
  embed snippets.
- **Widget & badge API endpoints**: `GET /widget/:type/:owner/:repo`,
  `GET /widget/repo/:owner/:repo`, and `GET /badge/:owner/:repo`, with SVG
  caching and graceful error cards so embeds never break.
- **GitHub App webhook receiver**: `POST /api/github/webhooks` with HMAC
  signature verification and event routing (push, pull_request, issues, release,
  star, fork) that re-scores the repository on relevant events.
- **Historical analytics** (`@beacon/analytics`): health series, range filtering
  (30d / 90d / 1y), and trend computation with a natural-language narrative
  ("health improved 12% over the last 30 days"). New `GET
  /api/repositories/:owner/:repo/trend` endpoint.
- **CLI commands**: `beacon widget`, `beacon badge`, and `beacon watch`.
- **Website**: documentation moved primarily to the site (`/docs`), plus
  `/showcase` (widget gallery) and `/pricing`.
- `CLAUDE.md` with full repository context for AI agents.

### Changed

- **Split the monorepo into a clean backend platform.** `@beacon/core` was
  decomposed into `@beacon/shared` (types + demo fixtures + queue contract),
  `@beacon/github` (client), `@beacon/ai` (providers), and `@beacon/analytics`
  (scoring, trends, and the analyze orchestrator). The public marketing site
  lives in the separate `beacon-web` repository.

## [0.1.0] - 2026-07-16

### Added

- Initial release of the Beacon monorepo (Turborepo + npm workspaces).
- **`@beacon/core`**: dependency-free analysis engine — fetch-based GitHub client,
  deterministic five-pillar Beacon Score, pluggable AI providers
  (heuristic / OpenAI / Anthropic), and demo fixtures.
- **`@beacon/database`**: Prisma schema + client (PostgreSQL) with a seed script.
- **`@beacon/config`**: shared TypeScript and ESLint configuration.
- **`apps/api`**: Fastify REST API with Redis / in-memory caching and optional
  persistence; runs zero-config.
- **`apps/web`**: Next.js 14 dashboard — animated score card, Recharts
  visualizations, contributor/language/commit/release views, dark-mode-first.
- **`apps/cli`**: `beacon analyze owner/repo` with a polished terminal report.
- Docker + docker-compose, GitHub Actions CI, documentation, and the MIT license.

[1.1.2]: https://github.com/martin-k-m/beacon/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/martin-k-m/beacon/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/martin-k-m/beacon/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/martin-k-m/beacon/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/martin-k-m/beacon/releases/tag/v0.1.0
