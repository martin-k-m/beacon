# Beacon CLI

`beacon` is the command-line client for Beacon repository intelligence. It
analyzes the health of any GitHub repository — remotely through the Beacon SDK,
or the repository in your current directory completely offline — and renders
reports, widgets, badges, and an interactive dashboard.

- Package: [`@martin-k-m/beacon-cli`](https://www.npmjs.com/package/@martin-k-m/beacon-cli)
  (source: [`apps/cli`](../apps/cli))
- Binary: `beacon`
- Node.js: `>= 20`
- Zero runtime dependencies — ships as a single self-contained bundle.

```bash
npm install -g @martin-k-m/beacon-cli
# or
npx @martin-k-m/beacon-cli analyze facebook/react
```

## Contents

- [Concepts](#concepts)
- [Authentication](#authentication)
- [Configuration files](#configuration-files)
- [Local (offline) mode](#local-offline-mode)
- [JSON output](#json-output)
- [Commands](#commands)
  - [analyze](#beacon-analyze-repository)
  - [score](#beacon-score-repository)
  - [insights](#beacon-insights-repository)
  - [contributors](#beacon-contributors-repository)
  - [dependencies](#beacon-dependencies)
  - [history](#beacon-history-repository)
  - [report](#beacon-report-repository)
  - [widget](#beacon-widget-repository-type)
  - [badge](#beacon-badge-repository)
  - [watch](#beacon-watch-repository)
  - [dashboard](#beacon-dashboard)
  - [init](#beacon-init)
  - [login / logout / whoami](#beacon-login--logout--whoami)
- [Exit codes](#exit-codes)

## Concepts

Beacon computes a deterministic **Beacon Score** (0–100) from a repository
snapshot, across five weighted pillars:

| Pillar | Weight | What it measures |
| --- | --- | --- |
| Activity | 0.30 | Recency of pushes, commit volume, release cadence. |
| Community | 0.20 | Contributor breadth and engagement. |
| Maintenance | 0.20 | Issue/PR throughput and latency. |
| Documentation | 0.15 | README quality, license, homepage. |
| Security | 0.15 | Security policy, Dependabot, advisories. |

The total maps to a grade: **Excellent** (≥90), **Healthy** (≥75),
**Fair** (≥60), **At risk** (≥40), **Critical** (<40).

### Repository resolution

When a command's `[repository]` argument is omitted, `beacon` resolves it in
order:

1. The explicit `owner/repo` argument.
2. The project config's `repository` (see below).
3. The `origin` remote of the current git repository.

If none resolve, the command exits with a clear error.

## Authentication

Commands work anonymously against public repositories, subject to GitHub's low
unauthenticated rate limit. Sign in to raise the limit and access private
repositories.

### Device flow

```bash
export BEACON_GITHUB_CLIENT_ID=Iv1.your_oauth_app_client_id
beacon login
```

`beacon` prints a one-time code and the URL `https://github.com/login/device`.
Open it, paste the code, and authorize Beacon; the CLI polls until authorization
completes, resolves your GitHub login, and stores the token.

```
First, copy your one-time code:

    WDJB-MJHT

Then open https://github.com/login/device and paste it to authorize Beacon.

Waiting for authorization…

✓ Connected as octocat
```

The device flow requires a GitHub OAuth app client ID in
`BEACON_GITHUB_CLIENT_ID`. Without one, the CLI directs you to `--with-token`.

### Personal access token

```bash
beacon login --with-token ghp_your_token_here
```

Create a token at <https://github.com/settings/tokens> with `repo` and
`read:user` scopes.

### Session

```bash
beacon whoami          # → octocat  (exit 1 + "Not logged in." otherwise)
beacon whoami --json   # → {"login":"octocat"}
beacon logout          # clears the stored token + user
```

## Configuration files

Settings merge with precedence **environment → global → project**.

### Global — `~/.beacon/config.json`

Machine-wide account, written by `beacon login`:

```json
{
  "token": "ghp_…",
  "apiUrl": "https://beacon.example.com",
  "user": { "login": "octocat" },
  "tracking": ["octocat/hello-world"]
}
```

- `token` — GitHub token used for direct analysis.
- `apiUrl` — optional hosted Beacon API base URL. When set, analysis routes
  through the API (falling back to direct GitHub when a token is available).
- `user` — the logged-in user.
- `tracking` — repositories to surface on the dashboard, machine-wide.

The file is created with `600` permissions where the platform supports it.

### Project — `.beacon/config.json` or `.beaconrc`

Per-repository config, discovered by walking up from the current directory:

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

- `repository` — the default repository for commands run in this project.
- `tracking` — repositories shown on the dashboard.
- `widgets` — widget types of interest.
- `ignore` — directory/file names to skip during local analysis.
- `scoreThreshold` — dashboard status boundary (default `70`).
- `watchInterval` — default poll interval (seconds) for `watch`.

### Environment variables

| Variable | Effect |
| --- | --- |
| `BEACON_API_URL` | Hosted Beacon API base URL (overrides global `apiUrl`). |
| `BEACON_TOKEN` | Beacon API bearer token. |
| `GITHUB_TOKEN` | GitHub token (overrides global `token`). |
| `BEACON_GITHUB_CLIENT_ID` | GitHub OAuth app client ID for the device flow. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Keys for hosted AI summaries. |

## Local (offline) mode

`--local` analyzes the repository in the current directory using only local git
history and the filesystem — no network, no account. It is available on
`analyze`, `score`, `insights`, `contributors`, `history`, `report`, `widget`,
`badge`, and `watch`. (`dependencies` is always local and takes no `--local`
flag; `dashboard`, `init`, and the auth commands don't analyze a repository.)

The snapshot is assembled by an extensible **collector registry**, each
collector contributing one slice:

| Signal | Source |
| --- | --- |
| Identity, default branch, created/pushed dates | `git remote`, `git log`, `git rev-parse` |
| Commit activity (52 weekly buckets) | `git log --since=1.year` |
| Contributors | aggregated `git log` authors |
| Releases | `git tag` |
| Languages & size | filesystem walk by extension (TS/JS, Python, Go, Rust, Java, and more) |
| Dependencies | `package.json`, `requirements.txt`/`pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`/`build.gradle`, `Gemfile`, `composer.json` |
| Docs & security | `README`, `LICENSE`, `SECURITY.md`, `.github/dependabot.yml` |

GitHub-only signals — stars, forks, watchers, open issues, and issue/PR
latency — cannot be observed locally. They are left at neutral defaults, and
the CLI prints a note to `stderr` so the result is never misread as complete:

```
note: Offline mode: stars, forks, watchers, open issues, and issue/PR latency
are unavailable without GitHub, so the Beacon Score is weighted toward local
activity, documentation, and security signals.
```

The filesystem walk always skips `.git`, `node_modules`, `dist`, `.next`,
`build`, `coverage`, and similar, plus any `ignore` entries from project config.

## JSON output

Every command that produces data supports `--json`, which prints
machine-readable output to `stdout` and suppresses decorative text. Local-mode
caveats go to `stderr`, so `stdout` stays clean for piping:

```bash
beacon analyze rust-lang/rust --json | jq '.score.total'
beacon score --local --json                 # {"score":72,"grade":"Fair"}
beacon whoami --json                         # {"login":"octocat"}
beacon dashboard --json | jq '.repositories'
```

## Commands

### `beacon analyze [repository]`

Full health report.

| Flag | Description |
| --- | --- |
| `--local` | Analyze the current directory offline. |
| `--refresh` | Bypass cached analysis (API mode). |
| `-t, --token <token>` | GitHub token (defaults to config / `$GITHUB_TOKEN`). |
| `--json` | Print the raw `BeaconAnalysis`. |
| `--demo` | Use bundled demo data. |
| `--source <auto\|api\|github>` | Force the analysis source. |
| `--ai <heuristic\|openai\|anthropic>` | AI summary provider (default `heuristic`). |

```bash
beacon analyze facebook/react
beacon analyze --local
beacon analyze --demo
OPENAI_API_KEY=sk-… beacon analyze vercel/next.js --ai openai
```

### `beacon score [repository]`

Compact score and star rating (`round(total / 20)` stars).

```
$ beacon score --demo
Beacon Score: 87/100
★★★★☆ Healthy

$ beacon score --demo --json
{"score":87,"grade":"Healthy"}
```

Flags: `--local`, `--demo`, `-t/--token`, `--source`, `--refresh`, `--json`.

### `beacon insights [repository]`

Actionable **AI Advisor** output: a headline, a prioritized list of issues (each
with a severity chip, an explanation, and a `→` recommendation), and a summary.
Issues are grounded in the snapshot, score, and — where history is available — a
health trend (synthesized in `--demo`).

| Flag | Description |
| --- | --- |
| `--local` | Advise on the current directory offline. |
| `--demo` | Use bundled demo data (also synthesizes a trend). |
| `-t, --token <token>` | GitHub token (defaults to config / `$GITHUB_TOKEN`). |
| `--ai <heuristic\|openai\|anthropic>` | Provider for the summary prose (default `heuristic`). |
| `--max <n>` | Cap the number of issues shown. |
| `--json` | Print the `AdvisorReport`. |

```bash
beacon insights --demo
beacon insights facebook/react --max 3
beacon insights --local --json | jq '.issues[].title'
```

### `beacon contributors [repository]`

Contributor / team-health signals: active contributors, **bus factor**,
maintainer load, a distribution bar list (top contributors by share), and a
natural-language narrative.

```
$ beacon contributors --demo
  beacon-labs/aurora

  Active contributors  6 of 22
  Bus factor           3
  Maintainer load      38%

  Distribution
  alice          ████████░░░░░░░░  38%
  bob            █████░░░░░░░░░░░░  22%
  …

  22 contributors, bus factor 3. Contribution load is moderately shared.
```

Flags: `--local`, `--demo`, `-t/--token`, `--json`.

### `beacon dependencies`

Analyze the **current project's** dependency manifests. `beacon` parses
`package.json` (npm), `requirements.txt` / `pyproject.toml` (pip), and
`Cargo.toml` (cargo) into a dependency list, then classifies each against its
registry: `current` (green ✓), `outdated` (yellow ⚠), `unmaintained` /
`vulnerable` (red ✗), or `unknown` (dim). A repository argument is not required.

| Flag | Description |
| --- | --- |
| `--offline` | Skip registry lookups — classify everything as `unknown`. |
| `--json` | Print the `DependencyReport`. |

```bash
beacon dependencies
beacon dependencies --offline
beacon dependencies --json | jq '.counts'
```

Registry lookups use each package's native registry (npm, PyPI, crates.io) over
`fetch`; a lookup that fails or times out is reported as `unknown` rather than an
error. With no manifests present the command says so and exits `1`.

### `beacon history [repository]`

A health / event **timeline**. Without a hosted API (or with `--demo` /
`--local`), `beacon` synthesizes a health history from the snapshot and renders
each point newest→oldest with its date, score, and the delta versus the previous
point. With an `apiUrl` configured, it fetches the repository's stored events and
trend and renders the real timeline.

| Flag | Description |
| --- | --- |
| `--range <7d\|30d\|90d\|1y\|all>` | Time range (default `90d`). |
| `--local` | Build the timeline from the current directory offline. |
| `--demo` | Use bundled demo data. |
| `-t, --token <token>` | GitHub token (defaults to config / `$GITHUB_TOKEN`). |
| `--json` | Print the timeline. |

```bash
beacon history --demo
beacon history facebook/react --range 30d
beacon history --demo --json | jq '.points'
```

### `beacon report [repository]`

A full report — repository, score, pillars, activity, contributors, releases,
and the AI summary — in Markdown, HTML, or JSON.

| Flag | Description |
| --- | --- |
| `--markdown` | Markdown (default). |
| `--html` | Self-contained, styled HTML page. |
| `--json` | Raw JSON analysis. |
| `-o, --out <file>` | Write to a file. |
| `--local` / `--demo` / `-t, --token` / `--source` | As for `analyze`. |

```bash
beacon report --demo                       # Markdown to stdout
beacon report --local --html --out r.html  # HTML page to a file
```

### `beacon widget [repository] [type]`

Render an embeddable SVG widget and print Markdown / HTML / URL embed snippets.

- `type` ∈ `health` (default), `activity`, `language`, `contributor`, `release`.
- Snippet URLs use the configured `apiUrl`, or `--host`.

| Flag | Description |
| --- | --- |
| `-t, --type <type>` | Widget type (overrides the positional). |
| `--theme <dark\|light\|transparent>` | Default `dark`. |
| `--size <small\|medium\|large>` | Default `medium`. |
| `-o, --out <file>` | Also write the SVG. |
| `--host <url>` | Embed host for snippet URLs. |
| `--token` / `--demo` / `--local` / `--json` | Standard flags. |

```bash
beacon widget facebook/react activity --theme light --out activity.svg
beacon widget --demo
```

### `beacon badge [repository]`

Render the maintenance badge and print its Markdown embed. Flags: `--theme`,
`--size`, `-o/--out`, `--host`, `--token`, `--demo`, `--local`.

### `beacon watch [repository]`

Poll a repository and print score changes until interrupted (`Ctrl-C`). The
delta versus the previous poll is coloured green (up), red (down), or `—`.

The interval is taken from `--interval`, then the project config's
`watchInterval`, then `300` seconds (minimum `15`).

```
$ beacon watch --demo --interval 15
Watching beacon-labs/aurora every 15s — press Ctrl-C to stop.
2026-07-16T21:34:59.812Z  beacon-labs/aurora  87/100 Healthy  —
2026-07-16T21:35:14.860Z  beacon-labs/aurora  87/100 Healthy  —
```

Flags: `-i/--interval`, `--local`, `--token`, `--demo`, `--source`, `--ai`.

### `beacon dashboard`

An interactive terminal dashboard: a "BEACON" header, repositories with their
scores and a ✓/⚠/✗ status against the configured threshold, and a "Recent
Alerts" section.

Repositories are sourced from the local repository plus any `tracking` entries
in project/global config. With none configured, it falls back to the bundled
demo repositories, whose synthetic history powers the trend alerts.

- **Interactive (TTY):** `↑/↓` move the selection, `Enter` expands a
  repository's pillar breakdown, `r` refreshes, `q`/`Ctrl-C` quits. The terminal
  is always restored on exit.
- **Non-interactive (piped/CI):** prints a static snapshot and exits `0`. With
  `--json`, prints a machine-readable snapshot.

Flags: `--demo`, `--json`.

### `beacon init`

Scaffold project config in the current directory:

- `.beacon/config.json` — with `repository` inferred from the git remote.
- `.beacon/history.json` — an empty history file.

Confirms interactively (simple `y/N`) unless `--yes`.

```bash
beacon init          # interactive
beacon init --yes    # non-interactive
```

### `beacon login` / `logout` / `whoami`

See [Authentication](#authentication).

| Command | Flags | Description |
| --- | --- | --- |
| `beacon login` | `--with-token <token>` | Device flow, or store a PAT directly. |
| `beacon logout` | — | Clear the stored token and user. |
| `beacon whoami` | `--json` | Print the current login. |

## Unknown commands

`beacon` suggests the nearest command for a typo:

```
$ beacon analize facebook/react
Unknown command: analize

Did you mean:
  beacon analyze

Docs: https://github.com/martin-k-m/beacon/blob/main/docs/cli.md
```

## Exit codes

- `0` — the command completed successfully.
- `1` — the repository was not found, GitHub rate-limited the request, the
  repository could not be resolved, or another error occurred. The reason is
  printed to `stderr`.
