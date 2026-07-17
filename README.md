<div align="center">

# 🔦 Beacon

**Open-source GitHub repository intelligence.**

Beacon analyzes any public repository and turns its raw signals — commits,
contributors, issues, pull requests, releases, dependencies, and documentation —
into a single, explainable **Beacon Score** and a natural-language health summary.

[Quick start](#quick-start) · [Architecture](#architecture) · [The Beacon Score](#the-beacon-score) · [CLI](#cli) · [Contributing](CONTRIBUTING.md)

[![npm](https://img.shields.io/npm/v/@martin-k-m/beacon-cli?label=%40martin-k-m%2Fbeacon-cli&color=0b7285)](https://www.npmjs.com/package/@martin-k-m/beacon-cli)

`MIT licensed` · `TypeScript` · `Turborepo`

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
│   ├── api/        Fastify REST API — the backend (analysis, widgets, webhooks)
│   ├── worker/     Background queue consumer (BullMQ) that re-scores on events
│   ├── web/        Next.js frontend — landing + dashboard
│   └── cli/        beacon — the terminal client
├── packages/
│   ├── shared/             Domain types + demo fixtures + the job-queue contract
│   ├── github/             GitHub REST client (dependency-free, fetch-based)
│   ├── ai/                 AI summary providers (heuristic / OpenAI / Anthropic)
│   ├── analytics/          The engine: scoring, trends, orchestrator, team health
│   ├── ai-advisor/         Recommendations engine (why health changed + what to do)
│   ├── dependency-engine/  Dependency classification (npm / PyPI / crates)
│   ├── plugins/            Extensibility foundation (analyzers/metrics/widgets/recs)
│   ├── sdk/                Programmatic client (@beacon/sdk)
│   ├── widgets/            Embeddable SVG widgets (health cards, badges, graphs)
│   ├── ui/                 Shared React UI primitives (frontend)
│   ├── database/           Prisma schema + client (PostgreSQL)
│   └── config/             Shared TypeScript + ESLint configuration
└── docs/                   Architecture, scoring, API, CLI, widgets, advisor, monitoring, …
```

The engine is split into focused packages: `@beacon/github` (collection),
`@beacon/analytics` (scoring + trends + orchestration), and `@beacon/ai`
(summaries), all built on `@beacon/shared` types. The API, worker, CLI, and
[`@beacon/sdk`](packages/sdk) share them.

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

## Continuous intelligence

Beyond scoring, Beacon adds a layer of **Phase 2 intelligence** packages:

- **AI Advisor** (`@beacon/ai-advisor`) — actionable, grounded recommendations:
  prioritized issues, each with an explanation and a concrete fix. Available as
  `beacon insights` and `GET /api/repositories/:owner/:repo/insights`. See
  [docs/advisor.md](docs/advisor.md).
- **Team health** (`@beacon/analytics`) — bus factor, maintainer load, and
  contributor distribution via `beacon contributors` and `.../contributors`.
- **Dependency engine** (`@beacon/dependency-engine`) — classifies a project's
  dependencies (current / outdated / unmaintained / unknown) against npm, PyPI,
  and crates.io via `beacon dependencies`.
- **Event timeline** — webhooks record `RepositoryEvent`s and re-score the
  repository, building a timeline you can read with `beacon history` or
  `GET /api/repositories/:owner/:repo/events`. See
  [docs/monitoring.md](docs/monitoring.md).

## CLI

A first-class terminal client — install it globally (it ships as a single
self-contained bundle with no runtime dependencies):

```bash
npm install -g @martin-k-m/beacon-cli

beacon login                       # GitHub device flow (or --with-token <PAT>)
beacon analyze                     # analyze the repo in the current directory
beacon analyze facebook/react      # …or any GitHub repository
beacon analyze --local             # offline analysis (git + manifests, no account)
beacon score vercel/next.js        # quick score:  96/100  ★★★★★ Excellent
beacon insights facebook/react     # AI Advisor: prioritized issues + fixes
beacon contributors --demo         # bus factor, maintainer load, distribution
beacon dependencies                # classify the current project's dependencies
beacon history --demo              # health / event timeline over a range
beacon dashboard                   # interactive TUI across your repositories
beacon widget facebook/react       # copy-paste embed snippets
beacon report --markdown           # export a report (--json / --html too)
```

Every command supports `--json` for scripting. See [docs/cli.md](docs/cli.md)
for the full reference.

## SDK

Use Beacon programmatically with [`@beacon/sdk`](packages/sdk):

```ts
import { Beacon } from '@beacon/sdk';

const analysis = await Beacon.analyze('facebook/react');
console.log(analysis.score.total); // 96
```

## Architecture

```
        GitHub REST API
               │
               ▼
        ┌──────────────┐
        │ Beacon Engine│   @beacon/github + @beacon/analytics + @beacon/ai
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
<sub>Beacon — understand any GitHub repository. MIT licensed.</sub>
</div>
