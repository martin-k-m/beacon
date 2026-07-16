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
│   ├── api/        Fastify REST API (analysis, persistence, caching)
│   ├── web/        Next.js dashboard (the product UI)
│   └── cli/        beacon-cli — analyze repositories from your terminal
├── packages/
│   ├── core/       The analysis engine: GitHub client, scoring, AI providers
│   ├── database/   Prisma schema + client (PostgreSQL)
│   └── config/     Shared TypeScript + ESLint configuration
└── docs/           Architecture, scoring, API, CLI, and self-hosting guides
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

## CLI

```bash
# from the monorepo (after npm install + build)
npm run build
node apps/cli/dist/index.js analyze facebook/react

# or try it with no network using bundled demo data
node apps/cli/dist/index.js analyze beacon-labs/aurora --demo
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
