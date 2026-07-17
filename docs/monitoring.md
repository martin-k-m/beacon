# Continuous monitoring

Beacon can watch a repository over time and build a **timeline** of what changed
and how it moved the health score. Monitoring is powered by GitHub webhooks that
re-score the repository and record events; the timeline is then available through
the API and the `beacon history` command.

## How it works

```
GitHub event ──▶ POST /api/github/webhooks ──▶ queue (BullMQ) ──▶ worker
                        │                                            │
                        │ recordEvent (fire-and-forget)              │ re-score
                        ▼                                            ▼
                 repository_events                              analyses (history)
```

1. **Webhook delivery.** GitHub sends an event to
   `POST /api/github/webhooks`. The signature is verified against
   `GITHUB_WEBHOOK_SECRET` when configured (see [github-app.md](github-app.md)).
2. **Event recording.** For repository events (`push`, `pull_request`, `issues`,
   `release`, `star`, `watch`, `fork`) the API records a `RepositoryEvent`
   (`store.recordEvent`) with a short human title and a minimal payload. This is
   fire-and-forget — it never blocks or fails the webhook, and it no-ops without
   a database. This is what populates the timeline from monitoring.
3. **Re-score.** The API enqueues an analysis job for `@beacon/worker`. When
   Redis is not configured it falls back to an inline, best-effort refresh. The
   worker re-collects the snapshot, recomputes the Beacon Score, and appends a new
   `Analysis` row — extending the repository's health history.
4. **Response.** GitHub always receives a fast `202 Accepted`.

Both the event recording and the re-score are best-effort: a repository first
seen through a webhook (before it has ever been analyzed) is created with
placeholder metadata, and a later analysis fills in the real GitHub fields via
the same `fullName` key.

## Data model

Two models back the timeline (see
[`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma)):

### `RepositoryEvent`

| Field | Type | Notes |
| --- | --- | --- |
| `type` | string | `push`, `pull_request`, `issues`, `release`, `star`, `fork`, `scan`. |
| `title` | string | Short human-readable title for the timeline. |
| `detail` | string? | Optional longer description. |
| `pillar` | string? | The pillar most affected, when known. |
| `healthDelta` | int? | Signed health-score delta attributed to the event, when known. |
| `payload` | json? | Minimal event context (e.g. `{ action }`). |
| `occurredAt` | datetime | When the event happened. |

### `Analysis`

Each analysis run is a point-in-time score plus the full collected snapshot
(stored as JSON so historical scores can be recomputed if the algorithm
changes). The ordered series of `Analysis` rows is what the trend endpoints and
charts read.

## Reading the timeline

### API

- `GET /api/repositories/:owner/:repo/events` — stored events, newest first
  (empty `[]` without a database, still `200`).
- `GET /api/repositories/:owner/:repo/trend?range=30d|90d|1y|all` — the health
  trend and underlying series.

See [api.md](api.md) for the full reference.

### CLI — `beacon history`

```bash
# Real events + trend from a configured API
beacon history acme/widget --range 30d

# No API? Synthesize a timeline from the snapshot (also used by --demo/--local)
beacon history --demo
```

With an `apiUrl` configured (and no `--demo` / `--local`), `beacon history`
fetches the repository's stored events and trend and renders the real timeline.
Otherwise it synthesizes a health history from the current snapshot and renders
each point newest→oldest with its date, score, and the delta versus the previous
point. See the [CLI reference](cli.md#beacon-history-repository).
