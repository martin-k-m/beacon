# @martin-k-m/beacon-cli

[![npm](https://img.shields.io/npm/v/@martin-k-m/beacon-cli?color=0b7285)](https://www.npmjs.com/package/@martin-k-m/beacon-cli)
[![node](https://img.shields.io/node/v/@martin-k-m/beacon-cli)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@martin-k-m/beacon-cli?color=0b7285)](https://github.com/martin-k-m/beacon/blob/main/LICENSE)

A first-class terminal client for [Beacon](https://github.com/martin-k-m/beacon) —
analyze the health of any GitHub repository, online or offline, right from your
shell.

`beacon` collects a snapshot of a repository, computes a deterministic **Beacon
Score** across five pillars (activity, community, maintenance, documentation,
security), and prints a polished report — with an optional AI-written summary.
It can analyze remote repositories through the Beacon SDK, or the repository in
your current directory completely **offline, with no account**.

## Install

```bash
npm install -g @martin-k-m/beacon-cli
```

Or run it once, without installing:

```bash
npx @martin-k-m/beacon-cli analyze facebook/react
```

Requires Node.js >= 20.

## Quick start

```bash
# Analyze a public repository
beacon analyze facebook/react

# Analyze the repository in the current directory — offline, no account
beacon analyze --local

# Compact score
beacon score vercel/next.js

# Try everything offline with bundled demo data
beacon analyze --demo
```

## Commands

| Command | Description |
| --- | --- |
| `beacon analyze [repository]` | Full health report. |
| `beacon score [repository]` | Compact score + star rating. |
| `beacon insights [repository]` | AI Advisor recommendations (issues + fixes). |
| `beacon contributors [repository]` | Bus factor, maintainer load, distribution. |
| `beacon dependencies` | Analyze the current project's dependency manifests. |
| `beacon history [repository]` | Health / event timeline over a range. |
| `beacon report [repository]` | Full report as Markdown / HTML / JSON. |
| `beacon widget [repository] [type]` | Render an embeddable SVG widget + snippets. |
| `beacon badge [repository]` | Render the maintenance badge + Markdown embed. |
| `beacon watch [repository]` | Poll a repository and print score changes. |
| `beacon dashboard` | Interactive terminal dashboard. |
| `beacon init` | Scaffold `.beacon/config.json` in the current directory. |
| `beacon login` | Sign in with GitHub (device flow) or a token. |
| `beacon logout` | Clear stored credentials. |
| `beacon whoami` | Print the current user. |

When `[repository]` is omitted, `beacon` resolves it from (in order) the
project config's `repository`, then the `origin` remote of the current git
repository.

Global flags: `--no-color` disables ANSI output; `--json` (where supported)
prints machine-readable output and suppresses decorative text; `-v/--version`
and `-h/--help` behave as usual. Every command prints a `Docs:` footer in
`--help`.

## Authentication

Most commands work anonymously (subject to GitHub's low unauthenticated rate
limit). Sign in to raise your limit and reach private repositories.

```bash
# Device flow (needs a GitHub OAuth app client ID)
BEACON_GITHUB_CLIENT_ID=Iv1.xxxx beacon login

# …or store a Personal Access Token directly
beacon login --with-token ghp_your_token_here

beacon whoami   # → your-login
beacon logout
```

The device flow prints a one-time code and a URL
(`https://github.com/login/device`); authorize there and the CLI finishes
automatically. Credentials are stored in `~/.beacon/config.json` (created with
`600` permissions where supported). Create a token at
<https://github.com/settings/tokens> with the `repo` and `read:user` scopes.

## Local (offline) analysis

`--local` analyzes the repository in the current directory using only local
git history and the filesystem — no network and no account:

```bash
beacon analyze --local
beacon score --local
beacon report --local --html --out health.html
```

Local mode builds a snapshot from an **extensible collector registry**:

- **Identity / dates** — parsed from the `origin` remote (falling back to the
  folder name); created/pushed dates from the first and last commits; default
  branch from `git rev-parse`.
- **Commit activity** — 52 weekly buckets from `git log --since=1.year`.
- **Contributors** — aggregated author counts from `git log`.
- **Releases** — from git tags.
- **Languages** — a filesystem walk sizing files by extension (TypeScript,
  JavaScript, Python, Go, Rust, Java, and many more), skipping `.git`,
  `node_modules`, `dist`, `.next`, and your configured `ignore` entries.
- **Dependencies** — detects `package.json`, `requirements.txt` /
  `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml` / `build.gradle`,
  `Gemfile`, and `composer.json`.
- **Docs & security** — README presence/sections, `LICENSE`, `SECURITY.md`,
  and `.github/dependabot.yml`.

GitHub-only signals (stars, forks, watchers, open issues, and issue/PR latency)
are unknowable locally, so they are left neutral and the CLI prints a clear
note that the score is weighted toward local activity, documentation, and
security signals.

## Configuration

### Global — `~/.beacon/config.json`

```json
{
  "token": "ghp_…",
  "apiUrl": "https://beacon.example.com",
  "user": { "login": "octocat" }
}
```

Written by `beacon login`. `apiUrl` (optional) routes analysis through a hosted
Beacon API service instead of direct GitHub.

### Project — `.beacon/config.json` or `.beaconrc`

```json
{
  "repository": "acme/widget",
  "tracking": ["acme/widget", "acme/api"],
  "widgets": ["health"],
  "ignore": ["fixtures", "generated"],
  "scoreThreshold": 75,
  "watchInterval": 120
}
```

Create one with `beacon init`. Settings merge as **environment → global →
project**: `BEACON_API_URL`, `BEACON_TOKEN`, and `GITHUB_TOKEN` override the
global config for the API URL and tokens; the project config supplies the
repository, dashboard watch-list, ignore globs, threshold, and watch interval.

## Command reference

### `beacon analyze [repository]`

| Flag | Description |
| --- | --- |
| `--local` | Analyze the current directory offline. |
| `--refresh` | Bypass cached analysis (API mode). |
| `-t, --token <token>` | GitHub token (defaults to config / `$GITHUB_TOKEN`). |
| `--json` | Print the raw `BeaconAnalysis` as JSON. |
| `--demo` | Use bundled demo data. |
| `--source <auto\|api\|github>` | Force the analysis source. |
| `--ai <provider>` | `heuristic` (default), `openai`, `anthropic`. |

### `beacon score [repository]`

Prints a compact two-line result and (with `--json`) `{ "score", "grade" }`:

```
Beacon Score: 96/100
★★★★★ Excellent
```

Supports `--local`, `--demo`, `--token`, `--source`, `--refresh`, `--json`.
Stars are `round(total / 20)`.

### `beacon insights [repository]`

AI Advisor output: a headline, a prioritized list of issues (severity chip,
explanation, and a `→` recommendation), and a summary. Builds a health trend
when history is available (synthesized in `--demo`).

| Flag | Description |
| --- | --- |
| `--local` / `--demo` / `-t, --token` | Standard resolution flags. |
| `--ai <provider>` | Provider for summary prose: `heuristic` (default), `openai`, `anthropic`. |
| `--max <n>` | Cap the number of issues shown. |
| `--json` | Print the `AdvisorReport`. |

### `beacon contributors [repository]`

Bus factor, active contributors, maintainer load, a distribution bar list, and a
narrative. Supports `--local`, `--demo`, `--token`, `--json`.

### `beacon dependencies`

Analyzes the current project's manifests (`package.json`, `requirements.txt`,
`pyproject.toml`, `Cargo.toml`) and classifies each dependency against its
registry. A repository argument is not required.

| Flag | Description |
| --- | --- |
| `--offline` | Skip registry lookups (classify everything as `unknown`). |
| `--json` | Print the `DependencyReport`. |

### `beacon history [repository]`

A health / event timeline. Synthesizes a timeline from the snapshot in `--demo` /
`--local` / no-API mode; fetches real stored events + trend when an `apiUrl` is
configured.

| Flag | Description |
| --- | --- |
| `--range <7d\|30d\|90d\|1y\|all>` | Time range (default `90d`). |
| `--local` / `--demo` / `-t, --token` | Standard resolution flags. |
| `--json` | Print the timeline. |

### `beacon report [repository]`

| Flag | Description |
| --- | --- |
| `--markdown` | Markdown output (default). |
| `--html` | Self-contained, styled HTML page. |
| `--json` | Raw JSON analysis. |
| `-o, --out <file>` | Write to a file instead of stdout. |
| `--local` / `--demo` / `--token` / `--source` | As for `analyze`. |

### `beacon widget [repository] [type]`

`type` ∈ `health` (default), `activity`, `language`, `contributor`, `release`.
Prints Markdown / HTML / URL embed snippets; `-o/--out` also writes the SVG.
Snippet URLs use the configured `apiUrl`, or `--host`.

```bash
beacon widget facebook/react activity --theme light --out activity.svg
```

### `beacon badge [repository]`

Renders the maintenance badge and prints its Markdown embed. Supports
`--theme`, `--size`, `--out`, `--host`, `--token`, `--demo`, `--local`.

### `beacon watch [repository]`

Polls on an interval and prints the score delta versus the previous poll (green
up, red down, `—` for no change). Interval comes from `--interval`, then the
project config's `watchInterval`, then `300s` (minimum `15s`).

### `beacon dashboard`

An interactive terminal dashboard: a "BEACON" header, repositories with scores
and ✓/⚠/✗ status against your threshold, and a "Recent Alerts" section. Sources
repositories from the local repository plus any `tracking` entries in config;
with none configured it falls back to the bundled demo repositories.

In a TTY: `↑/↓` move, `Enter` expands a repository, `r` refreshes, `q`/`Ctrl-C`
quits. When piped or in CI it prints a static snapshot (or JSON with `--json`)
and exits.

### `beacon init`

Scaffolds `.beacon/config.json` and an empty `history.json`, inferring
`repository` from the git remote. Confirms interactively unless `--yes`.

## Examples

```bash
# Machine-readable score for scripting
beacon score rust-lang/rust --json | jq '.score'

# A shareable HTML report of your current project
beacon report --local --html --out beacon-report.html

# Embed a health widget in your README
beacon widget --demo

# Watch a repo every 60 seconds
beacon watch facebook/react --interval 60
```

Example report (from the bundled demo dataset, `beacon analyze --demo`, so the
numbers are illustrative):

```
beacon-labs/aurora
A fast, composable state management library for modern web apps.
https://github.com/beacon-labs/aurora

  87/100  Healthy
  [█████████████████████░░░]

Pillars
  Activity       [██████████████░░]   88
  Community      [█████████████░░░]   82
  Maintenance    [███████████████░]   91
  Documentation  [██████████████░░]   85
  Security       [██████████████░░]   84

Beacon Summary
via heuristic
Aurora is in healthy shape: development is brisk, a broad contributor base
keeps the bus factor comfortable, and maintainers merge changes quickly.
```

## Exit codes

- `0` — the command completed.
- `1` — the repository was not found, GitHub rate-limited the request, or
  another error occurred. The reason is printed in red to `stderr`.

## Docs

Full command documentation: <https://github.com/martin-k-m/beacon/blob/main/docs/cli.md>

## License

MIT
