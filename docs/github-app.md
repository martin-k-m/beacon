# GitHub App & webhooks

Beacon can run as a **self-hosted GitHub App** so that repositories are
re-analyzed automatically when they change, keeping scores, history, and widgets
fresh without polling.

> Beacon is self-hosted — you register **your own** GitHub App and point it at
> your Beacon deployment. There is no public hosted Beacon App.

## How it works

```
GitHub repo event ──▶ webhook ──▶ POST /api/github/webhooks ──▶ re-analyze ──▶ update
                                    (verify signature)            (score/history/widgets)
```

1. You install your Beacon GitHub App on one or more repositories.
2. GitHub sends webhook deliveries to `POST /api/github/webhooks`.
3. Beacon verifies the payload signature, then re-scores the affected repository
   in the background and returns quickly (`202 Accepted`).

## Handled events

| Event | Effect |
| --- | --- |
| `push` | Re-analyze (commits, activity) |
| `pull_request` | Re-analyze (PR velocity/health) |
| `issues` | Re-analyze (issue health) |
| `release` | Re-analyze (release cadence) |
| `star` / `watch` | Re-analyze (community) |
| `fork` | Re-analyze (community) |
| `ping` | Health check → `200 OK` |

Unknown events are acknowledged (`202`) without work.

## Setup

1. Create a GitHub App (Settings → Developer settings → GitHub Apps):
   - **Webhook URL:** `https://<your-beacon-host>/api/github/webhooks`
   - **Webhook secret:** a strong random string.
   - **Permissions:** read-only repository metadata, contents, issues, and pull
     requests.
   - **Subscribe to events:** Push, Pull request, Issues, Release, Star, Fork.
2. Configure Beacon's environment:
   ```bash
   GITHUB_WEBHOOK_SECRET=your-webhook-secret
   GITHUB_APP_ID=123456
   GITHUB_APP_PRIVATE_KEY=... # optional, for authenticated installs
   ```
3. Install the App on your repositories.

## Security

- Every delivery is verified against `X-Hub-Signature-256` using
  `GITHUB_WEBHOOK_SECRET` and a constant-time comparison. Invalid signatures are
  rejected with `401` when a secret is configured.
- Beacon only performs **read** operations against the GitHub API; it never
  writes to your repositories.
- If no webhook secret is set, Beacon runs in a permissive development mode and
  logs a warning — always set a secret in production.

See [`docs/api.md`](api.md) for the endpoint reference and
[`docs/self-hosting.md`](self-hosting.md) for deployment.
