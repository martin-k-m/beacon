import { describe, expect, it } from 'vitest';
import { demoAtRiskSnapshot, demoHealthySnapshot } from '../demo/fixtures';
import { computeBeaconScore, PILLAR_WEIGHTS } from './score';

describe('computeBeaconScore', () => {
  it('pillar weights sum to 1', () => {
    const sum = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('rates a healthy repo highly', () => {
    const score = computeBeaconScore(demoHealthySnapshot);
    expect(score.total).toBeGreaterThanOrEqual(75);
    expect(['Healthy', 'Excellent']).toContain(score.grade);
    expect(score.pillars).toHaveLength(5);
  });

  it('rates a stalled repo lower and surfaces warnings', () => {
    const score = computeBeaconScore(demoAtRiskSnapshot);
    expect(score.total).toBeLessThan(60);
    expect(score.warnings.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same snapshot', () => {
    const a = computeBeaconScore(demoHealthySnapshot);
    const b = computeBeaconScore(demoHealthySnapshot);
    expect(a.total).toBe(b.total);
  });

  it('keeps every pillar score within 0–100', () => {
    for (const snapshot of [demoHealthySnapshot, demoAtRiskSnapshot]) {
      const score = computeBeaconScore(snapshot);
      for (const pillar of score.pillars) {
        expect(pillar.score).toBeGreaterThanOrEqual(0);
        expect(pillar.score).toBeLessThanOrEqual(100);
      }
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
    }
  });
});
