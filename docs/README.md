# Beacon documentation

- [Architecture](architecture.md) — how the pieces fit together.
- [The Beacon Score](scoring.md) — the full scoring algorithm.
- [AI Advisor](advisor.md) — actionable recommendations (`beacon insights`, `GET /insights`).
- [Continuous monitoring](monitoring.md) — webhooks → re-score → the event timeline.
- [Widgets](widgets.md) — embeddable SVG cards and badges.
- [GitHub App & webhooks](github-app.md) — automatic re-analysis on repo events.
- [API reference](api.md) — REST endpoints.
- [CLI](../apps/cli/README.md) — the `beacon` command-line tool.
- [Self-hosting](self-hosting.md) — running the full stack yourself.

> The primary, always-current documentation lives on the website (`beacon-web`,
> `/docs`). This folder mirrors the essentials for readers browsing the repo.

New to the codebase? Start with the [analysis engine](../packages/analytics) —
scoring, trends, and the analyze orchestrator. It builds on
[`@beacon/github`](../packages/github) (collection),
[`@beacon/ai`](../packages/ai) (summaries), and
[`@beacon/shared`](../packages/shared) (types). Everything else — the API, the
worker, the CLI, the SDK — is a thin surface over those.
