# The Beacon Score

The Beacon Score is a single **0–100** number summarizing repository health. It
is a weighted average of five pillars, each computed as a **pure function** of a
collected [`RepositorySnapshot`](../packages/core/src/types.ts). The same
snapshot always produces the same score.

Implementation: [`packages/core/src/scoring/score.ts`](../packages/core/src/scoring/score.ts).

## Pillars and weights

| Pillar | Weight |
| --- | --- |
| Activity | 0.30 |
| Community | 0.20 |
| Maintenance | 0.20 |
| Documentation | 0.15 |
| Security | 0.15 |

The total is `Σ (pillar.score × pillar.weight)`, rounded to the nearest integer.

### Activity (30%)

- **Recency** (50%) — days since the last push. 100 at ≤7 days, decaying
  linearly to 0 at ~365 days.
- **Commit volume** (30%) — commits over the last 12 weeks; 60+ earns full marks.
- **Release cadence** (20%) — 100 for a release in the last 120 days, decaying to
  0 at ~2 years; repositories with no releases are capped.

### Community (20%)

- **Breadth** (50%) — a logarithmic curve over distinct contributors (25+ ≈ full).
- **Distribution** (30%) — the share of contributions *not* owned by the top
  contributor (a bus-factor signal).
- **Popularity** (20%) — a weak logarithmic signal from stars.

### Maintenance (20%)

- **Issue responsiveness** (40%) — median time-to-close (100 at ≤48h).
- **PR merge velocity** (35%) — median time-to-merge (100 at ≤48h).
- **Backlog flow** (25%) — closed vs. opened issues over the last 30 days.
- Archived repositories are heavily penalized.

### Documentation (15%)

Additive from README signals: presence, length, install/usage/license sections,
badges, plus homepage and topic metadata. No README floors the pillar at 10.

### Security (15%)

Starts at a neutral baseline and adjusts for a security policy, Dependabot
configuration, and known vulnerability alerts (when the authenticated scope
makes them available).

## Grades

| Score | Grade |
| --- | --- |
| 90–100 | Excellent |
| 75–89 | Healthy |
| 60–74 | Fair |
| 40–59 | At risk |
| 0–39 | Critical |

## Strengths & warnings

Pillars scoring ≥75 surface as **strengths**; pillars below 55 surface as
**warnings**, each carrying the specific reason that triggered it. This is what
powers the ✓/! highlights in the dashboard and CLI.

## Extending the algorithm

Because scoring is pure and snapshots are stored, you can re-score history after
changing the algorithm. When you change a pillar:

1. Keep returning `reasons` — the UI and CLI depend on them.
2. Update `packages/core/src/scoring/score.test.ts` so the demo fixtures still
   grade sensibly (healthy ≥75, at-risk <60).
