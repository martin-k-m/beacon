# AI Advisor

The AI Advisor turns a Beacon analysis into **actionable advice**: it explains
why a repository's health looks the way it does, surfaces concrete problems
grounded in the snapshot / score / trend, and pairs each with a specific
recommendation. It is implemented in
[`@beacon/ai-advisor`](../packages/ai-advisor).

## Surfaces

- **CLI:** `beacon insights [repository]` — see the
  [CLI reference](cli.md#beacon-insights-repository).
- **API:** `GET /api/repositories/:owner/:repo/insights` — see
  [api.md](api.md).

Both produce the same `AdvisorReport`:

```ts
interface AdvisorReport {
  headline: string;              // trend-driven when available, else grade-driven
  score: number;                 // current Beacon Score
  grade: string;                 // current health grade
  healthDeltaPercent?: number;   // present when a trend was supplied
  issues: AdvisorIssue[];        // prioritized high → low
  summary: string;               // 2–4 sentence narrative
  generatedAt: string;           // ISO timestamp
}

interface AdvisorIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  pillar?: 'activity' | 'community' | 'maintenance' | 'documentation' | 'security';
  title: string;
  detail: string;                // why it's a problem, grounded in the data
  recommendation: string;        // a concrete action to take
}
```

## The rule set

Issue detection (`adviseIssues`) is a **pure, deterministic** engine — identical
input always yields identical output, with no clock, randomness, or I/O. Rules
are grouped by pillar and grounded in snapshot signals:

| Area | Example rules |
| --- | --- |
| **Security** | open vulnerability alerts (high); no `SECURITY.md`; dependencies without Dependabot. |
| **Maintenance** | slow issue response (median close > 14 days); slow PR velocity (median merge > 7 days); a backlog growing faster than it's worked down. |
| **Documentation** | no README; thin README missing installation / usage guidance. |
| **Community** | single-maintainer / low bus factor (top contributor > 60% of contributions). |
| **Activity** | little recent activity (last push > 120 days); no published releases. |
| **Trend** | a per-pillar decline over the trend window (explains and recommends a reversal). |

Issues are de-duplicated by `id` and sorted **high → low by severity**, then by
pillar weight (heavier pillars first), then by a stable id tiebreak. The report
includes the top `maxIssues` (default 5).

The **headline** is driven by the trend when one is supplied and shows real
movement ("Health increased 8% this month."); otherwise it reflects the grade
and the count of pressing issues.

## Provider selection

Only the narrative **summary** may consult a hosted AI provider; the issue list
is always the deterministic engine. Provider selection follows the same
`AIProviderConfig` used elsewhere in Beacon:

- **`heuristic`** (default) — a fully offline, deterministic narrative. No keys,
  no network.
- **`openai`** — set `--ai openai` (CLI) or `BEACON_AI_PROVIDER=openai` (API)
  with `OPENAI_API_KEY`.
- **`anthropic`** — set `--ai anthropic` / `BEACON_AI_PROVIDER=anthropic` with
  `ANTHROPIC_API_KEY`.

Summary generation is defensive: a missing key, a provider error, or an empty
response transparently falls back to the heuristic narrative, so `insights` never
fails because of the AI layer.

## Persistence

When a database is configured, the API persists each advisor run as an
`AIRecommendation` (`headline`, `summary`, `healthDeltaPercent`, the `issues`
JSON, and the `provider`) via `store.saveRecommendation`. This is best-effort and
no-ops without a database.
