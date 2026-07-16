import { describe, expect, it } from 'vitest';
import { computeBeaconScore } from '../scoring/score';
import { demoAtRiskSnapshot, demoHealthySnapshot } from './fixtures';
import { generateDemoHistory } from './history';

describe('generateDemoHistory', () => {
  it('returns the requested number of ascending points', () => {
    const history = generateDemoHistory(demoHealthySnapshot, { points: 12 });
    expect(history).toHaveLength(12);
    const times = history.map((p) => Date.parse(p.collectedAt));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeGreaterThan(times[i - 1]!);
    }
  });

  it('ends at the live score for the snapshot', () => {
    const history = generateDemoHistory(demoHealthySnapshot);
    const live = computeBeaconScore(demoHealthySnapshot);
    expect(history[history.length - 1]!.score.total).toBe(live.total);
  });

  it('trends up for a healthy repo and down for a struggling one', () => {
    const healthy = generateDemoHistory(demoHealthySnapshot, { points: 12 });
    expect(healthy[healthy.length - 1]!.score.total).toBeGreaterThan(healthy[0]!.score.total);

    const risky = generateDemoHistory(demoAtRiskSnapshot, { points: 12 });
    expect(risky[risky.length - 1]!.score.total).toBeLessThan(risky[0]!.score.total);
  });

  it('keeps every point within 0–100 and consistent with its grade', () => {
    for (const snap of [demoHealthySnapshot, demoAtRiskSnapshot]) {
      for (const point of generateDemoHistory(snap)) {
        expect(point.score.total).toBeGreaterThanOrEqual(0);
        expect(point.score.total).toBeLessThanOrEqual(100);
        expect(point.score.pillars).toHaveLength(5);
      }
    }
  });

  it('is deterministic', () => {
    const a = generateDemoHistory(demoHealthySnapshot);
    const b = generateDemoHistory(demoHealthySnapshot);
    expect(a.map((p) => p.score.total)).toEqual(b.map((p) => p.score.total));
  });
});
