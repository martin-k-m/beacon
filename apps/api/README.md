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
| `GET` | `/api/repositories/:owner/:repo/trend` | Health trend + series over `?range=30d\|90d\|1y\|all` (default `30d`). |
| `GET` | `/widget/:type/:owner/:repo` | Embeddable SVG widget. `type` ∈ `health,activity,language,contributor,release,badge`. |
| `GET` | `/widget/repo/:owner/:repo` | Canonical health-card SVG (simple embed). |
| `GET` | `/badge/:owner/:repo` | Maintenance badge SVG (shields.io-style). |
| `POST` | `/api/github/webhooks` | GitHub App webhook receiver (signature-verified). |

### Widgets & badges

`GET /widget/:type/:owner/:repo`, `GET /widget/repo/:owner/:repo`, and
`GET /badge/:owner/:repo` return standalone SVGs (`image/svg+xml`) suitable for
embedding in a README or profile.

- Query options: `theme` (`dark` \| `light` \| `transparent`), `size`
  (`small` \| `medium` \| `large`), `accent` (a hex/rgb/hsl color). Invalid
  values are ignored, not rejected.
- Responses set `Cache-Control: public, max-age=1800, s-maxage=1800`; rendered
  SVGs are also cached server-side for `CACHE_TTL_SECONDS`.
- **Graceful degradation:** any failure (unknown repo, rate limit, transient
  error) still returns **200** with a small `beacon · unavailable` SVG and a
  short 60s cache, so an image embed never breaks.

An unknown widget `type` returns a `404` JSON error (not an SVG).

### `POST /api/github/webhooks`

GitHub App webhook receiver.

- Verifies `X-Hub-Signature-256` (HMAC-SHA256 over the **raw** body) when
  `GITHUB_WEBHOOK_SECRET` is set — missing/invalid → `401`. Without a secret,
  verification is skipped (dev mode, logged) but events are still processed.
- `ping` → `200 { ok: true }`.
- `push`, `pull_request`, `issues`, `release`, `star`, `watch`, `fork` →
  fire-and-forget refresh of the repo's analysis, `202 { accepted: true, event, repository }`.
- Any other event → `202 { accepted: false, event }`.

### `GET /api/repositories/:owner/:repo/trend`

Returns `{ range, trend, series }` where `trend` is the computed delta/direction
/narrative and `series` is the health points for charting. With no stored
history (or no database) it returns a zero-point trend and an empty series —
still `200`, never an error.

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
| `PUBLIC_URL` | `http://localhost:${PORT}` | Public base URL for embed snippets. |
| `BEACON_HOST` | – | Alias for `PUBLIC_URL`. |
| `GITHUB_WEBHOOK_SECRET` | – | Enables webhook signature verification. |
| `GITHUB_APP_ID` | – | GitHub App ID (architecture-ready; unused today). |
| `GITHUB_APP_PRIVATE_KEY` | – | GitHub App private key (architecture-ready). |

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
