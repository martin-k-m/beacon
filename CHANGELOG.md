# Changelog

All notable changes to Beacon are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

[Unreleased]: https://github.com/martin-k-m/beacon/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/martin-k-m/beacon/releases/tag/v0.1.0
