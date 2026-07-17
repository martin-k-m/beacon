# Changelog

All notable changes to Beacon are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **`@beacon/cli` — a first-class terminal client** (bundled, self-contained,
  `npm install -g @beacon/cli`): `login` (GitHub device flow + `--with-token`),
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

[1.1.0]: https://github.com/martin-k-m/beacon/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/martin-k-m/beacon/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/martin-k-m/beacon/releases/tag/v0.1.0
