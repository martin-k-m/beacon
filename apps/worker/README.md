# @beacon/worker

A long-running background worker that consumes repository-analysis jobs from
Redis (via [BullMQ](https://docs.bullmq.io/)), runs the full analysis with
`@beacon/analytics`, and persists the result with `@beacon/database`.

The API (`@beacon/api`) enqueues a job onto the `beacon:analysis` queue whenever
it receives a relevant GitHub webhook. This worker picks the job up and does the
heavy lifting off the request path.

## Graceful degradation

- **No `REDIS_URL`** — the worker does not crash. It logs a message and idles;
  the API falls back to processing analyses inline. This makes the worker safe
  to run in every environment, including local dev with no infra.
- **No `DATABASE_URL`** — analyses are computed but not persisted (logged).
- A single failing job never crashes the worker; BullMQ retries it with
  exponential backoff.
- `SIGINT` / `SIGTERM` trigger a graceful shutdown (the worker drains and
  closes its Redis connection).

## Scripts

| Script      | Description                                    |
| ----------- | ---------------------------------------------- |
| `dev`       | Run with `tsx watch` (no build step).          |
| `build`     | Compile TypeScript to `dist/`.                 |
| `start`     | Run the compiled worker (`node dist/index.js`).|
| `typecheck` | Type-check without emitting.                   |
| `lint`      | Lint `src/`.                                    |

## Environment

See [`.env.example`](./.env.example). All values are optional; the worker boots
with none of them set.

## Docker

Build from the **monorepo root** (the workspace packages must resolve):

```sh
docker build -f apps/worker/Dockerfile -t beacon-worker .
```

`docker compose up` brings the worker up alongside Postgres, Redis, and the API.
