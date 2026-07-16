# @beacon/cli

Analyze the health of any GitHub repository from your terminal.

`beacon` is the command-line face of [Beacon](https://github.com/beacon-labs),
an open-source GitHub repository intelligence platform. It collects a snapshot
of a repository, computes a deterministic **Beacon Score** across five pillars
(activity, community, maintenance, documentation, security), and prints a
polished health report — with an optional AI-written summary.

## Install

```bash
npm install -g @beacon/cli
```

Or run it once, without installing:

```bash
npx @beacon/cli analyze facebook/react
```

## Usage

```bash
beacon analyze <owner/repo> [options]
```

### Options

| Option                  | Description                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `-t, --token <token>`   | GitHub token. Defaults to `$GITHUB_TOKEN`.                          |
| `--json`                | Print the raw analysis as JSON instead of the report.              |
| `--demo`                | Use bundled demo data instead of calling GitHub (no network).      |
| `--ai <provider>`       | AI summary provider: `heuristic` (default), `openai`, `anthropic`. |
| `--no-color`            | Disable coloured output.                                           |
| `-v, --version`         | Print the version.                                                 |
| `-h, --help`            | Show help.                                                         |

A GitHub token is optional but recommended — without one you share the small
anonymous rate limit. Hosted AI providers read their keys from the environment
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) and transparently fall back to the
offline heuristic summary when no key is present.

### Examples

```bash
# Analyze a public repository
beacon analyze facebook/react

# Use a token for higher rate limits / private repos
beacon analyze your-org/private-repo --token "$GITHUB_TOKEN"

# Get an AI-written summary from OpenAI
OPENAI_API_KEY=sk-... beacon analyze vercel/next.js --ai openai

# Machine-readable output for scripting
beacon analyze rust-lang/rust --json | jq '.score.total'

# Try it offline with bundled demo data
beacon analyze beacon-labs/aurora --demo
```

## Embeddable widgets

Turn any analysis into a self-contained SVG widget for your README, profile, or
dashboard, and print ready-to-paste embed snippets. Widgets have no external
fonts, scripts, or tracking pixels.

```bash
beacon widget <owner/repo> [options]
```

### `widget` options

| Option                | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| `-t, --type <type>`   | Widget type: `health` (default), `activity`, `language`, `contributor`, `release`. |
| `--theme <theme>`     | `dark` (default), `light`, `transparent`.                                       |
| `--size <size>`       | `small`, `medium` (default), `large`.                                           |
| `-o, --out <file>`    | Write the rendered SVG to a file.                                               |
| `--host <url>`        | Embed host for snippet URLs. Defaults to `https://beacon.example.com`.          |
| `--token <token>`     | GitHub token. Defaults to `$GITHUB_TOKEN`.                                       |
| `--demo`              | Use bundled demo data instead of calling GitHub (no network).                   |

```bash
# Print embed snippets for the health widget
beacon widget facebook/react

# Render an activity graph and save the SVG
beacon widget vercel/next.js --type activity --theme light --out next-activity.svg

# Try it offline with bundled demo data
beacon widget beacon-labs/aurora --demo
```

Example embed snippets (from `beacon widget beacon-labs/aurora --demo`):

```
Embed
  URL
  https://beacon.example.com/widget/health/beacon-labs/aurora?theme=dark&size=medium

  Markdown
  [![Beacon health — beacon-labs/aurora](https://beacon.example.com/widget/health/beacon-labs/aurora?theme=dark&size=medium)](https://github.com/beacon-labs/aurora)

  HTML
  <a href="https://github.com/beacon-labs/aurora"><img src="https://beacon.example.com/widget/health/beacon-labs/aurora?theme=dark&size=medium" alt="Beacon health — beacon-labs/aurora" /></a>
```

## Maintenance badge

`beacon badge` renders a compact maintenance badge and prints its Markdown embed
— perfect for the top of a README.

```bash
beacon badge <owner/repo> [options]
```

### `badge` options

| Option             | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `--theme <theme>`  | `dark` (default), `light`, `transparent`.                              |
| `--size <size>`    | `small` (default), `medium`, `large`.                                  |
| `-o, --out <file>` | Write the rendered SVG to a file.                                      |
| `--host <url>`     | Embed host for snippet URLs. Defaults to `https://beacon.example.com`. |
| `--token <token>`  | GitHub token. Defaults to `$GITHUB_TOKEN`.                             |
| `--demo`           | Use bundled demo data instead of calling GitHub (no network).         |

Example (from `beacon badge beacon-labs/aurora --demo`):

```
Embed
  URL
  https://beacon.example.com/badge/beacon-labs/aurora?theme=dark&size=small

  Markdown
  [![Beacon badge — beacon-labs/aurora](https://beacon.example.com/badge/beacon-labs/aurora?theme=dark&size=small)](https://github.com/beacon-labs/aurora)
```

## Watch a repository

`beacon watch` polls a repository on an interval and prints score changes,
showing the delta versus the previous poll (green up, red down, `—` for no
change). It runs until you press Ctrl-C.

```bash
beacon watch <owner/repo> [options]
```

### `watch` options

| Option                     | Description                                                       |
| -------------------------- | ---------------------------------------------------------------- |
| `-i, --interval <seconds>` | Seconds between polls. Default `300`, minimum `15`.              |
| `--token <token>`          | GitHub token. Defaults to `$GITHUB_TOKEN`.                       |
| `--demo`                   | Use bundled demo data instead of calling GitHub (no network).    |
| `--ai <provider>`          | AI summary provider: `heuristic` (default), `openai`, `anthropic`. |

Example (from `beacon watch beacon-labs/aurora --demo`, whose demo data is
static, so the delta stays flat):

```
Watching beacon-labs/aurora every 15s — press Ctrl-C to stop.
2026-07-16T21:34:59.812Z  beacon-labs/aurora  97/100 Excellent  —
2026-07-16T21:35:14.860Z  beacon-labs/aurora  97/100 Excellent  —
^C
Stopped watching.
```

## Example output

The following is rendered from the bundled **demo** dataset
(`beacon analyze beacon-labs/aurora --demo`), so the numbers are illustrative:

```
beacon-labs/aurora
A batteries-included realtime data framework for modern web apps.
https://github.com/beacon-labs/aurora

  87/100  Healthy
  [█████████████████████░░░]

Pillars
  Activity       [██████████████░░]   88
  Community      [█████████████░░░]   82
  Maintenance    [███████████████░]   91
  Documentation  [██████████████░░]   85
  Security       [██████████████░░]   84

Strengths
  ✓ 340 commits in the last 90 days across 24 contributors
  ✓ Median pull request merges in under 18 hours
  ✓ README documents install, usage, and licensing

Warnings
  ! 12 issues opened in the last 30 days are still awaiting a first response

340 stars  •  58 forks  •  24 contributors  •  TypeScript  •  27 open issues

Beacon Summary
via heuristic
Aurora is in healthy shape: development is brisk, a broad contributor base
keeps the bus factor comfortable, and maintainers merge changes quickly. Watch
the recent uptick in unanswered issues to keep community momentum high.

  › Strong, sustained commit activity
  › Fast, consistent review turnaround
```

## Exit codes

- `0` — analysis completed.
- `1` — the repository was not found, GitHub rate-limited the request, or
  another error occurred. The reason is printed in red to `stderr`.

## License

MIT
