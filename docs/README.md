# Beacon documentation

- [Architecture](architecture.md) — how the pieces fit together.
- [The Beacon Score](scoring.md) — the full scoring algorithm.
- [Widgets](widgets.md) — embeddable SVG cards and badges.
- [GitHub App & webhooks](github-app.md) — automatic re-analysis on repo events.
- [API reference](api.md) — REST endpoints.
- [CLI](../apps/cli/README.md) — the `beacon` command-line tool.
- [Self-hosting](self-hosting.md) — running the full stack yourself.

> The primary, always-current documentation lives on the website (`beacon-web`,
> `/docs`). This folder mirrors the essentials for readers browsing the repo.

New to the codebase? Start with the [analysis engine](../packages/core) — it's
where scoring, the GitHub client, and the AI providers live, and everything else
is a thin surface over it.
