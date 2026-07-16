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

## Response shape

All analysis endpoints return a `BeaconAnalysis`:

```ts
{
  snapshot: RepositorySnapshot;  // the collected raw signals
  score: BeaconScore;            // total, grade, pillars, strengths, warnings
  summary: BeaconSummary;        // provider, model, text, highlights
}
```

See [`packages/core/src/types.ts`](../packages/core/src/types.ts) for the full
type definitions.

## Configuration

All configuration is via environment variables — see
[`.env.example`](../.env.example). Every value is optional.
