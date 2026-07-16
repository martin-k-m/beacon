# @beacon/api

Fastify HTTP API for **Beacon**, an open-source GitHub repository intelligence
platform. It wraps [`@beacon/core`](../../packages/core) (collection, scoring,
AI summaries) and [`@beacon/database`](../../packages/database) (persistence)
behind a small REST surface.

## Design: zero-config runnability

The service is designed to boot and serve useful data with **no external
infrastructure**:

| Dependency | When absent | Behaviour |
| ---------- | ----------- | --------- |
| `DATABASE_URL` | no Postgres | persistence disabled; `/api/repositories*` return `[]` / `404`, live analysis still works |
| `REDIS_URL` | no Redis | falls back to an in-process TTL cache |
| `GITHUB_TOKEN` | unauthenticated | live analysis works but hits low GitHub rate limits |
| AI keys | heuristic provider | deterministic offline summaries |

`GET /api/demo` is fully offline and always works.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/health` | Liveness + which services are enabled. |
| `GET` | `/api/demo` | Analyses for the built-in demo repos. Zero-config. |
| `POST` | `/api/analyze` | Analyze a repo. Body `{ "repo": "owner/name", "refresh": false }`. |
| `GET` | `/api/repositories` | Stored repositories with their latest score (`[]` without a DB). |
| `GET` | `/api/repositories/:owner/:repo` | Latest analysis (cache → store), else `404`. |
| `GET` | `/api/repositories/:owner/:repo/history` | Past analyses, newest first (`[]` without a DB). |

### `POST /api/analyze`

Request:

```json
{ "repo": "facebook/react", "refresh": false }
```

- `repo` — `owner/name` or a full GitHub URL (required).
- `refresh` — when `true`, bypass cache/store and force a fresh GitHub collection.

Read path (default): cache → database → live collection. Successful live
collections are written to the store (if configured) and cached.

Error mapping:

| Condition | Status |
| --------- | ------ |
| Malformed body / `owner/repo` | `400` |
| Repository not found | `404` |
| GitHub rate limit (403) | `429` |
| Other GitHub 403 | `403` |
| Other GitHub failure | `502` |

## Environment

See [`.env.example`](./.env.example).

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `PORT` | `4000` | |
| `HOST` | `0.0.0.0` | |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `DATABASE_URL` | – | Postgres connection string; enables persistence. |
| `REDIS_URL` | – | Enables the Redis cache. |
| `CACHE_TTL_SECONDS` | `3600` | Cache entry lifetime. |
| `GITHUB_TOKEN` | – | GitHub PAT for higher rate limits. |
| `BEACON_AI_PROVIDER` | `heuristic` | `heuristic` \| `openai` \| `anthropic` |
| `OPENAI_API_KEY` | – | Required for the `openai` provider. |
| `ANTHROPIC_API_KEY` | – | Required for the `anthropic` provider. |
| `CORS_ORIGIN` | `*` | `*` or a comma-separated allow-list. |

## Scripts

```bash
npm run dev        # tsx watch (hot reload)
npm run build      # tsc -> dist/
npm run start      # node dist/server.js
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run (offline; no infra needed)
```

## Docker

The [`Dockerfile`](./Dockerfile) is multi-stage and expects the **monorepo
root** as its build context so workspace packages resolve:

```bash
# From the repository root:
docker build -f apps/api/Dockerfile -t beacon-api .
docker run -p 4000:4000 --env-file apps/api/.env beacon-api
```
