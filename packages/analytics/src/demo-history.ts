import type { BeaconScore, PillarScore, RepositorySnapshot } from '@beacon/shared';
import { computeBeaconScore, healthGradeForScore, PILLAR_WEIGHTS } from './scoring';

export interface DemoHistoryPoint {
  score: BeaconScore;
  collectedAt: string;
}

export interface DemoHistoryOptions {
  /** Number of historical points, oldest→newest inclusive of "now". */
  points?: number;
  /** Days between points. */
  stepDays?: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Deterministically synthesize a repository's Beacon Score **history** from a
 * single snapshot, so the dashboard and trend endpoints have something real to
 * chart in demo mode. Healthy repositories trend gently upward toward the
 * present; struggling repositories trend downward — with small deterministic
 * wobble so the line looks organic rather than linear.
 *
 * The most recent point always equals the live `computeBeaconScore(snapshot)`,
 * so demo history is consistent with the demo card.
 */
export function generateDemoHistory(
  snapshot: RepositorySnapshot,
  options: DemoHistoryOptions = {},
): DemoHistoryPoint[] {
  const points = Math.max(2, options.points ?? 12);
  const stepDays = options.stepDays ?? 7;
  const base = computeBeaconScore(snapshot);
  const now = Date.parse(snapshot.collectedAt) || Date.now();

  // Improving when currently healthy, declining when currently struggling.
  const direction = base.total >= 65 ? 1 : -1;
  const amplitude = 14;

  const history: DemoHistoryPoint[] = [];
  for (let k = points - 1; k >= 0; k--) {
    // t: 0 at the present (k=0), 1 at the oldest point.
    const t = k / (points - 1);
    const wobble = 2.4 * Math.sin(k * 1.3) + 1.2 * Math.sin(k * 0.7);
    const offset = -direction * amplitude * t + wobble * (k === 0 ? 0 : 1);

    const pillars: PillarScore[] = base.pillars.map((p, i) => ({
      ...p,
      score: k === 0 ? p.score : clamp(p.score + offset + 1.6 * Math.sin(k + i)),
    }));

    const total =
      k === 0
        ? base.total
        : Math.round(pillars.reduce((sum, p) => sum + p.score * PILLAR_WEIGHTS[p.pillar], 0));

    history.push({
      score: {
        total,
        grade: healthGradeForScore(total),
        pillars,
        strengths: k === 0 ? base.strengths : [],
        warnings: k === 0 ? base.warnings : [],
      },
      collectedAt: new Date(now - k * stepDays * DAY_MS).toISOString(),
    });
  }

  return history;
}
