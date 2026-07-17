# Architecture

Beacon is a Turborepo monorepo. Its center of gravity is a small, pure analysis
engine that every surface (API, CLI, dashboard) is built on.

```
                         GitHub REST API
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │              the engine (focused packages)                 │
   │                                                            │
   │  @beacon/github ─► RepositorySnapshot ─► @beacon/analytics │
   │  (GitHubClient)                          (computeBeaconScore)
   │                                       └─► @beacon/ai ─► Summary
   └──────────────────────────────────────────────────────────┘
        │                        │                     │
        ▼                        ▼                     ▼
   apps/api (Fastify)       apps/cli (commander)   apps/web (Next.js)
        │                                              ▲
        ▼                                              │
   PostgreSQL (Prisma) + Redis  ──────────────────────┘
   persistence + cache            (dashboard reads the API)
```

## Data flow

1. **Collect.** `GitHubClient.getSnapshot(owner, repo)` issues a bounded set of
   GitHub REST reads (metadata, languages, contributors, commit activity,
   releases, issues/PRs via search, README, security files, manifests) and
   assembles a `RepositorySnapshot`. Every sub-request degrades gracefully, so a
   single failing endpoint never aborts the snapshot.
2. **Score.** `computeBeaconScore(snapshot)` reduces the snapshot to a
   `BeaconScore` — a pure, deterministic function (see [scoring.md](scoring.md)).
3. **Summarize.** An `AIProvider` turns the snapshot + score into a
   `BeaconSummary`. Providers are interchangeable; the default is offline.
4. **Serve / persist.** The API caches results (Redis or in-memory) and
   optionally persists them (PostgreSQL via Prisma) so scores can be tracked over
   time. The dashboard renders the analysis.

## Why a pure engine?

Keeping `@beacon/github` and `@beacon/analytics` free of Node-only APIs and heavy SDKs (they use only the
global `fetch`) means:

- The **CLI** and **API** share exactly one implementation of the logic.
- Scoring is **deterministic and testable** without mocking a database or network
  — the demo fixtures are ordinary data.
- The engine can run anywhere: Node, an edge function, or a browser.

## Packages

| Package | Responsibility |
| --- | --- |
| `@beacon/shared` | Domain types, demo fixtures, and the job-queue contract |
| `@beacon/github` | Dependency-free GitHub REST client (`fetch`-based) |
| `@beacon/ai` | Pluggable AI summary providers (heuristic / OpenAI / Anthropic) |
| `@beacon/analytics` | The engine: scoring, trends, the analyze orchestrator, team health |
| `@beacon/ai-advisor` | Recommendations engine — why health changed and what to do |
| `@beacon/dependency-engine` | Dependency classification (npm / PyPI / crates.io) |
| `@beacon/plugins` | Extensibility — analyzers / recommenders / widget contributors, loaded by `apps/api` via `BEACON_PLUGINS` ([plugins.md](plugins.md)) |
| `@beacon/widgets` | Embeddable SVG widgets and badges |
| `@beacon/sdk` | Programmatic client (`Beacon.analyze(...)`) |
| `@beacon/ui` | Shared React UI primitives (frontend) |
| `@beacon/database` | Prisma schema + client singleton (PostgreSQL) |
| `@beacon/config` | Shared `tsconfig` bases and ESLint presets |
| `@beacon/api` | REST API — analysis, caching, persistence, widgets, webhooks |
| `@beacon/worker` | Background BullMQ consumer that re-scores on webhook events |
| `@beacon/web` | Dashboard UI (landing + analytics) |
| `@martin-k-m/beacon-cli` | Terminal client (published to npm; the command is `beacon`) |

Dependency direction: `shared` is the leaf; `github`, `ai`, `widgets`, `ui`,
`database`, `dependency-engine`, `plugins` build on it; `analytics` depends on
`shared` + `github` + `ai`; `ai-advisor` on `shared` + `analytics` + `ai`; `sdk`
on `shared` + `analytics` + `github`. The apps depend on those. No cycles.

## Degraded modes

Beacon is built to run with as little infrastructure as you give it:

| Missing | Behavior |
| --- | --- |
| `GITHUB_TOKEN` | Works, but subject to GitHub's 60 req/hour anonymous limit |
| `DATABASE_URL` | Analyses are computed on demand; no history is stored |
| `REDIS_URL` | An in-process TTL cache is used instead |
| AI provider key | Falls back to the offline heuristic summary |

This makes the demo experience frictionless while keeping a clear upgrade path to
a full, stateful deployment.
