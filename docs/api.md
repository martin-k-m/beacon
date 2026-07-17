# API reference

The Beacon API is a Fastify service (`apps/api`). It runs with zero
configuration — with no database or Redis it still serves computed analyses.

Base URL (local): `http://localhost:4000`

## Endpoints

### `GET /health`

Liveness + service status.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 12.4,
  "services": { "database": false, "redis": false, "aiProvider": "heuristic" }
}
```

### `GET /api/demo`

Returns analyses for the bundled demo repositories. Works fully offline — the
easiest way to see the shape of a `BeaconAnalysis`.

### `POST /api/analyze`

Analyze a repository.

```bash
curl -X POST http://localhost:4000/api/analyze \
  -H 'content-type: application/json' \
  -d '{ "repo": "facebook/react" }'
```

Body:

| Field | Type | Description |
| --- | --- | --- |
| `repo` | string | `owner/repo` or a GitHub URL (required) |
| `refresh` | boolean | Bypass the cache and re-collect (optional) |

Errors: `404` (repository not found), `429` (GitHub rate limit — set a token).

### `GET /api/repositories`

List repositories that have been analyzed and stored (empty without a database).

### `GET /api/repositories/:owner/:repo`

Latest stored/cached analysis for a repository. `404` if it has not been analyzed
yet (POST to `/api/analyze` first).

### `GET /api/repositories/:owner/:repo/history`

Past analysis runs for a repository (requires a database).

### `GET /api/repositories/:owner/:repo/trend`

Health trend over a range. Query `range=30d|90d|1y|all` (default `30d`). Returns
`{ range, trend, series }` where `trend` includes the delta, direction, per-pillar
changes, and a narrative. Without stored history, returns a `points: 0` trend
(still `200`).

### `GET /api/repositories/:owner/:repo/insights`

AI Advisor recommendations. Analyzes the repository, builds a health trend from
stored history when available, and returns an `AdvisorReport` (`headline`,
`score`, `grade`, `healthDeltaPercent?`, `issues[]`, `summary`, `generatedAt`).
Errors: `404` (not found), `429` (GitHub rate limit). When a database is
configured the run is persisted as an `AIRecommendation`. See
[advisor.md](advisor.md).

### `GET /api/repositories/:owner/:repo/contributors`

Contributor / team-health signals — a `ContributorHealth`: `totalContributors`,
`activeContributors`, `busFactor`, `maintainerLoad`, a `distribution[]`
(login + share), and a `narrative`. Errors: `404`, `429`.

### `GET /api/repositories/:owner/:repo/events`

The stored repository timeline — `RepositoryEvent`s newest first (`type`,
`title`, `detail`, `pillar`, `healthDelta`, `occurredAt`). Returns `[]` without a
database (still `200`). Populated by monitoring — see [monitoring.md](monitoring.md).

### Widget & badge endpoints (SVG)

```
GET /widget/repo/:owner/:repo       # canonical health card
GET /widget/:type/:owner/:repo      # health | activity | language | contributor | release | badge
GET /badge/:owner/:repo             # maintenance badge
```

Query: `theme=dark|light|transparent`, `size=small|medium|large`, `accent=<css color>`.
Responds with `image/svg+xml`, cache headers, and a graceful "unavailable" SVG
(still `200`) if the repository can't be analyzed. See [widgets.md](widgets.md).

### `POST /api/github/webhooks`

GitHub App webhook receiver. Verifies `X-Hub-Signature-256` against
`GITHUB_WEBHOOK_SECRET`, routes events (`push`, `pull_request`, `issues`,
`release`, `star`, `fork`, `ping`), and re-analyzes the repository in the
background (`202 Accepted`). See [github-app.md](github-app.md).

## Response shape

All analysis endpoints return a `BeaconAnalysis`:

```ts
{
  snapshot: RepositorySnapshot;  // the collected raw signals
  score: BeaconScore;            // total, grade, pillars, strengths, warnings
  summary: BeaconSummary;        // provider, model, text, highlights
}
```

See [`packages/shared/src/types.ts`](../packages/shared/src/types.ts) for the
full type definitions.

## Configuration

All configuration is via environment variables — see
[`.env.example`](../.env.example). Every value is optional.
