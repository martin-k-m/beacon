<div align="center">

# 🔦 Beacon

**Open-source GitHub repository intelligence.**

Beacon analyzes any public repository and turns its raw signals — commits,
contributors, issues, pull requests, releases, dependencies, and documentation —
into a single, explainable **Beacon Score** and a natural-language health summary.

[Quick start](#quick-start) · [Architecture](#architecture) · [The Beacon Score](#the-beacon-score) · [CLI](#cli) · [Contributing](CONTRIBUTING.md)

`MIT licensed` · `TypeScript` · `Turborepo` · Part of the [Blink Dev](https://blinkdev.me) ecosystem

</div>

---

## What is Beacon?

Point Beacon at `owner/repo` and get an intelligent dashboard answering one
question: **how healthy is this repository?**

- **Repository overview** — stars, forks, watchers, languages, size, license.
- **Activity trends** — a 52-week commit histogram and release cadence.
- **Contributor analytics** — breadth, distribution, and bus-factor signals.
- **Issue & PR health** — response/merge times and 30-day flow.
- **Releases & dependencies** — cadence and detected package ecosystems.
- **Beacon Score** — a transparent 0–100 health score across five pillars.
- **Beacon Summary** — an AI-generated, factual paragraph (works offline).

Everything is a pure function of a collected **snapshot**, so scores are
deterministic, explainable, and reproducible.

## Repository structure

Beacon is a [Turborepo](https://turbo.build/) monorepo of small, focused packages.

```
beacon/
├── apps/
│   ├── web/        Next.js frontend — landing + dashboard with health-trend charts
│   ├── api/        Fastify REST API — the backend (analysis, widgets, webhooks)
│   └── cli/        beacon-cli — analyze repositories from your terminal
├── packages/
│   ├── core/       The analysis engine: GitHub client, scoring, AI providers
│   ├── ui/         Shared React UI primitives (consumed by the web frontend)
│   ├── widgets/    Embeddable SVG widgets (health cards, badges, graphs)
│   ├── analytics/  Historical health series + trend computation
│   ├── database/   Prisma schema + client (PostgreSQL)
│   └── config/     Shared TypeScript + ESLint configuration
└── docs/           Architecture, scoring, API, widgets, GitHub App, self-hosting
```

The heart of the project is [`@beacon/core`](packages/core) — a dependency-free
(uses only `fetch`) engine shared by the API and the CLI.

## Quick start

### The whole stack with Docker

```bash
git clone https://github.com/martin-k-m/beacon.git
cd beacon
cp .env.example .env      # optional — Beacon runs with zero config
docker compose up --build
```

- Dashboard → http://localhost:3000
- API → http://localhost:4000 (try `GET /api/demo`)

### Local development

Requires **Node 20+**.

```bash
npm install
npm run db:generate       # generate the Prisma client
npm run dev               # start every app via Turborepo
```

Beacon is designed to run with **zero configuration**: with no database, no
Redis, and no GitHub token, the API serves computed demo analyses and the
dashboard renders realistic demo data. Add a `GITHUB_TOKEN` to analyze real
repositories, and a `DATABASE_URL` to persist history.

## The Beacon Score

The Beacon Score is a weighted average of five pillars. Each pillar is a pure
function of the collected snapshot and carries the human-readable reasons that
drove it — nothing is a black box.

| Pillar | Weight | What it measures |
| --- | --- | --- |
| **Activity** | 30% | Recency of the last push, commit volume, release cadence |
| **Community** | 20% | Contributor breadth, contribution distribution, popularity |
| **Maintenance** | 20% | Issue/PR response times and 30-day backlog flow |
| **Documentation** | 15% | README presence, depth, and key sections; homepage/topics |
| **Security** | 15% | Security policy, Dependabot, known vulnerability alerts |

Scores map to a grade: **Excellent** (90+), **Healthy** (75+), **Fair** (60+),
**At risk** (40+), **Critical** (<40). See [docs/scoring.md](docs/scoring.md)
for the full algorithm.

## AI summaries

Beacon generates a "Beacon Summary" through a pluggable provider interface:

- **`heuristic`** (default) — deterministic, offline, no API key required.
- **`openai`** — OpenAI Chat Completions.
- **`anthropic`** — Claude Messages API.

Hosted providers transparently fall back to the heuristic provider on any error,
so an analysis never fails because of the AI layer. Select one with
`BEACON_AI_PROVIDER` and the matching API key.

## Embeddable widgets

Beacon renders self-contained **SVG** widgets you can drop into a README,
profile, or portfolio — no external assets, served with caching. Types: health
card, activity graph, language card, contributor card, release card, and a
shields-style maintenance badge. Each supports `dark` / `light` / `transparent`
themes and `small` / `medium` / `large` sizes.

```markdown
[![Beacon health](https://<your-beacon-host>/widget/repo/facebook/react)](https://github.com/facebook/react)
[![Beacon](https://<your-beacon-host>/badge/facebook/react)](https://github.com/facebook/react)
```

Generate embed code from the CLI: `beacon widget facebook/react` /
`beacon badge facebook/react`. See [docs/widgets.md](docs/widgets.md).

## GitHub App & monitoring

Run Beacon as a **self-hosted GitHub App** to re-analyze repositories
automatically on `push`, `pull_request`, `issues`, `release`, `star`, and `fork`
events. Webhooks are verified with an HMAC signature and processed in the
background. See [docs/github-app.md](docs/github-app.md).

## Health history & trends

Every analysis is a timestamped snapshot. `@beacon/analytics` turns that history
into trends over **30 / 90 / 365 days** with a plain-language narrative — e.g.
_"Repository health improved 12% over the last 30 days."_ — exposed at
`GET /api/repositories/:owner/:repo/trend`.

## CLI

```bash
# from the monorepo (after npm install + build)
npm run build
node apps/cli/dist/index.js analyze facebook/react

# or try it with no network using bundled demo data
node apps/cli/dist/index.js analyze beacon-labs/aurora --demo

# generate an embeddable widget / badge, or watch a repo's score over time
node apps/cli/dist/index.js widget facebook/react --type health
node apps/cli/dist/index.js badge facebook/react
node apps/cli/dist/index.js watch facebook/react --interval 300
```

See [apps/cli/README.md](apps/cli/README.md) for full usage.

## Architecture

```
        GitHub REST API
               │
               ▼
        ┌──────────────┐
        │ Beacon Engine│   @beacon/core
        │  · collect   │   snapshot → score → summary
        │  · score     │
        │  · summarize │
        └──────┬───────┘
               │
     ┌─────────┼───────────┐
     ▼         ▼           ▼
  REST API   CLI      PostgreSQL + Redis
 (apps/api) (cli)      (persistence + cache)
     │
     ▼
  Dashboard (apps/web)
```

More detail in [docs/architecture.md](docs/architecture.md).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run all apps in watch mode (Turborepo) |
| `npm run build` | Build every package and app |
| `npm run lint` | Lint the whole workspace |
| `npm run typecheck` | Type-check every package |
| `npm run test` | Run unit tests |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed demo repositories |

## Tech stack

**Frontend** Next.js · React · TypeScript · Tailwind CSS · Framer Motion · Recharts
**Backend** Node.js · Fastify · Prisma · PostgreSQL · Redis · Zod
**Tooling** Turborepo · Vitest · ESLint · Prettier · Docker · GitHub Actions

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Beacon is
MIT licensed (see [LICENSE](LICENSE)).

---

<div align="center">
<sub>Part of the <b>Blink Dev</b> ecosystem — Create with <a href="https://blinkdev.me">Blink</a> · Build with <a href="https://flux.blinkdev.me">Flux</a> · Protect with <a href="https://killer.blinkdev.me">Killer</a> · Understand with Beacon.</sub>
</div>
