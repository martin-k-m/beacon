# Contributing to Beacon

Thanks for your interest in improving Beacon! This guide covers how to get set
up and the conventions we follow.

## Getting started

1. **Fork and clone** the repository.
2. Install dependencies (Node 20+):
   ```bash
   npm install
   npm run db:generate
   ```
3. Run the stack in watch mode:
   ```bash
   npm run dev
   ```
   Everything runs with zero configuration. To analyze real repositories set a
   `GITHUB_TOKEN` in `.env` (copy from `.env.example`).

## Project layout

| Path | What lives here |
| --- | --- |
| `packages/analytics` | The analysis engine — scoring, trends, the analyze orchestrator |
| `packages/github` · `packages/ai` | GitHub collection and AI summary providers |
| `packages/ai-advisor` · `packages/dependency-engine` | Recommendations and dependency intelligence |
| `packages/database` | Prisma schema + client |
| `packages/config` | Shared TS/ESLint config |
| `apps/api` | Fastify REST API |
| `apps/web` | Next.js dashboard |
| `apps/cli` | The `beacon` CLI |

The engine is deliberately pure and dependency-free (it uses only `fetch`), so
it can run in Node, an edge runtime, or the browser. Keep it that way — no
Node-only APIs in `@beacon/github` or `@beacon/analytics`.

## Before opening a pull request

Run the full check suite locally — CI runs the same commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- **Add tests** for new behavior in `@beacon/analytics`. Scoring changes should
  keep the demo fixtures' scores sensible
  (`packages/analytics/src/scoring.test.ts`).
- **Keep scoring explainable.** Every pillar must return the human-readable
  `reasons` that justify its score.
- **Formatting** is handled by Prettier: `npm run format`.

## Commit & PR conventions

- Write clear, imperative commit messages ("Add release cadence to activity
  pillar").
- Keep pull requests focused. Describe the change and, for scoring changes, how
  it affects the demo fixtures.
- Link any related issue.

## Reporting bugs & proposing features

Open an issue describing the problem or proposal. For scoring changes, include a
concrete repository or snapshot that demonstrates the current behavior and the
behavior you expect.

## Code of conduct

Be respectful and constructive. We want Beacon to be a welcoming project.

## License

By contributing you agree that your contributions are licensed under the MIT
License.
