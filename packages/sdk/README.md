# @beacon/sdk

Programmatic client for **Beacon** repository intelligence. Analyze any GitHub
repository from code — through a running Beacon API service or directly from
GitHub in-process — and get a `BeaconAnalysis` (raw snapshot, weighted
`BeaconScore`, and a natural-language summary).

## Install

```bash
npm install @beacon/sdk
```

## Quick start

```ts
import { Beacon } from '@beacon/sdk';

// Direct GitHub mode — collect and score in-process.
const beacon = new Beacon({ githubToken: process.env.GITHUB_TOKEN });

const analysis = await beacon.analyze('owner/project');
console.log(analysis.score.total, analysis.score.grade);

// Just the score:
const score = await beacon.score('owner/project');
```

Or the one-shot convenience function, which reads `BEACON_API_URL`,
`BEACON_TOKEN`, and `GITHUB_TOKEN` from the environment:

```ts
import { analyze } from '@beacon/sdk';

const analysis = await analyze('facebook/react');
```

## Modes

The client resolves an analysis from one of two sources:

- **`github`** (direct) — collects a snapshot from GitHub and scores it in the
  current process. Requires a `githubToken` (or `GITHUB_TOKEN`).
- **`api`** — calls a running Beacon API service (`POST /api/analyze`). Requires
  an `apiUrl` (or `BEACON_API_URL`); pass a `token` for the `Authorization:
  Bearer` header.
- **`auto`** (default) — uses the API when `apiUrl` is configured, otherwise
  falls back to direct GitHub. When `auto` selects the API but the request fails
  and a `githubToken` is available, the client transparently retries via direct
  GitHub mode.

```ts
const beacon = new Beacon({
  apiUrl: 'https://beacon.example.com',
  token: process.env.BEACON_TOKEN,
  githubToken: process.env.GITHUB_TOKEN, // enables auto → github fallback
});

await beacon.analyze('owner/project');                 // auto
await beacon.analyze('owner/project', { source: 'github' });
await beacon.analyze('owner/project', { refresh: true });
```

## Snapshots

Score and summarize an already-collected snapshot, entirely offline (no
network):

```ts
import { demoHealthySnapshot } from '@beacon/shared';

const beacon = new Beacon();
const analysis = await beacon.analyzeSnapshot(demoHealthySnapshot);
```

## Trends (API mode only)

```ts
const beacon = new Beacon({ apiUrl: 'https://beacon.example.com' });
const { range, trend, series } = await beacon.trend('owner/project', '90d');
```

Calling `trend()` without an `apiUrl` throws — direct GitHub mode has no stored
history to build a trend from.

## Embeddable widgets

Build widget/badge URLs for the configured `apiUrl`:

```ts
const beacon = new Beacon({ apiUrl: 'https://beacon.example.com' });

beacon.widgetUrl('owner/project');
// → https://beacon.example.com/widget/health/owner/project

beacon.widgetUrl('owner/project', 'activity', { theme: 'dark', size: 'large' });
// → https://beacon.example.com/widget/activity/owner/project?theme=dark&size=large

beacon.widgetUrl('owner/project', 'badge');
// → https://beacon.example.com/badge/owner/project
```

## API

| Member | Description |
| --- | --- |
| `new Beacon(options?)` | Create a client. `options`: `apiUrl`, `token`, `githubToken`, `ai`, `fetch`. |
| `analyze(repo, options?)` | Analyze `owner/repo` or a GitHub URL → `BeaconAnalysis`. |
| `score(repo, options?)` | Convenience: the `BeaconScore` only. |
| `analyzeSnapshot(snapshot)` | Score + summarize a `RepositorySnapshot` offline. |
| `trend(repo, range?)` | Health trend (`'30d' \| '90d' \| '1y' \| 'all'`); API mode only. |
| `widgetUrl(repo, type?, opts?)` | Build a widget/badge embed URL. |
| `apiUrl` | The configured API base URL, if any. |
| `analyze(repo, options?)` | Standalone convenience using env config. |
| `BEACON_SDK_VERSION` | The SDK version string. |

## License

MIT
