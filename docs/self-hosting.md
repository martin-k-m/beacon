# Self-hosting Beacon

Beacon is designed to be self-hosted. This guide covers the full, stateful
deployment (PostgreSQL + Redis + API + dashboard).

## With Docker Compose (recommended)

```bash
git clone https://github.com/martin-k-m/beacon.git
cd beacon
cp .env.example .env
# set GITHUB_TOKEN in .env to analyze real repositories
docker compose up --build -d
```

This starts:

| Service | Port | Purpose |
| --- | --- | --- |
| `web` | 3000 | Dashboard |
| `api` | 4000 | REST API |
| `postgres` | 5432 | Persistence |
| `redis` | 6379 | Cache |

## Manual deployment

1. **Database.** Provision PostgreSQL and set `DATABASE_URL`. Apply the schema:
   ```bash
   npm run db:generate
   npm run db:migrate      # or: npm run db:push for a quick start
   npm run db:seed         # optional demo data
   ```
2. **API.** Build and run:
   ```bash
   npm run build
   node apps/api/dist/server.js
   ```
   Configure it with the environment variables in [`.env.example`](../.env.example).
3. **Dashboard.** Set `NEXT_PUBLIC_API_URL` to your API's public URL and run:
   ```bash
   npm run build
   npm run start --workspace @beacon/web
   ```

## Environment variables

See [`.env.example`](../.env.example). The important ones for a production
deployment:

| Variable | Recommended |
| --- | --- |
| `GITHUB_TOKEN` | A token with public-repo read access (raises rate limits) |
| `DATABASE_URL` | Your PostgreSQL connection string |
| `REDIS_URL` | Your Redis connection string |
| `BEACON_AI_PROVIDER` | `heuristic`, `openai`, or `anthropic` |
| `CORS_ORIGIN` | Your dashboard's origin (avoid `*` in production) |

## Rate limits

Analyzing real repositories consumes GitHub API quota. Always run with a
`GITHUB_TOKEN` in production, and rely on the cache (`CACHE_TTL_SECONDS`) to avoid
re-collecting the same repository repeatedly.

## Scaling notes

- The API is stateless apart from PostgreSQL and Redis — run multiple replicas
  behind a load balancer.
- Redis is shared cache; PostgreSQL holds the durable analysis history.
- The analysis engine (`@beacon/core`) does the heavy lifting and is CPU-light;
  the bound is GitHub API latency, which the cache mitigates.
