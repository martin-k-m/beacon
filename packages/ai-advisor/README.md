# @beacon/ai-advisor

Turns a Beacon repository analysis into **actionable advice** — why a
repository's health looks the way it does, what concrete problems exist, and a
specific recommendation for each one.

It builds on the deterministic scoring in `@beacon/analytics` and the AI
providers in `@beacon/ai`. The rule engine ([`adviseIssues`](#rule-engine)) is
pure and deterministic; only the narrative summary may consult a hosted model,
and it falls back to an offline heuristic on any error.

## Install

```bash
npm install @beacon/ai-advisor
```

## Usage

```ts
import { computeBeaconScore } from '@beacon/analytics';
import { demoAtRiskSnapshot } from '@beacon/shared';
import { generateAdvice, adviseIssues } from '@beacon/ai-advisor';

const snapshot = demoAtRiskSnapshot;
const analysis = {
  snapshot,
  score: computeBeaconScore(snapshot),
  summary: /* a BeaconSummary from @beacon/ai */ undefined as never,
};

// Deterministic, offline: the pure rule engine.
const issues = adviseIssues({ analysis });
for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.title} — ${issue.recommendation}`);
}

// Full report (headline + prioritized issues + narrative summary).
const report = await generateAdvice({ analysis }, { maxIssues: 5 });
console.log(report.headline);
console.log(report.summary);
```

With a trend (from `@beacon/analytics` `computeTrend`), the headline and summary
become change-aware ("Health decreased 8% this month.") and per-pillar declines
turn into their own issues:

```ts
const report = await generateAdvice({ analysis, trend });
```

To let a hosted model write a nicer summary (falls back to the heuristic on any
error, and never affects the issue list):

```ts
const report = await generateAdvice(
  { analysis, trend },
  { ai: { provider: 'openai', openaiApiKey: process.env.OPENAI_API_KEY } },
);
```

## Rule engine

`adviseIssues(input)` is a pure function of the snapshot, score, and optional
trend. It covers:

| Area | Signal | Severity |
| --- | --- | --- |
| Maintenance | Slow issue close time (> 14 days median) | medium |
| Maintenance | Slow PR merge time (> 7 days median) | medium |
| Maintenance | Backlog growing (closed ≪ opened, last 30 days) | medium |
| Security | Open vulnerability alerts | **high** |
| Security | No `SECURITY.md` | medium |
| Security | Dependencies present but Dependabot off | medium |
| Documentation | README missing install/usage, or too short | low |
| Community | One contributor > ~60% of contributions (low bus factor) | medium |
| Activity | Stale (last push > 120 days) | medium |
| Activity | No published releases | low |
| Trend | Any pillar dropped ≥ 5 points | medium |

Issues are de-duplicated and sorted high → low by severity, then by pillar
weight, then by a stable id. `generateAdvice` trims the list to `maxIssues`
(default 5).

## API

- `generateAdvice(input, options?): Promise<AdvisorReport>`
- `adviseIssues(input): AdvisorIssue[]` — pure, deterministic
- Types: `AdvisorReport`, `AdvisorIssue`, `AdvisorSeverity`, `AdviseInput`,
  `AdviseOptions`
- `BEACON_AI_ADVISOR_VERSION`

## License

MIT
