import { demoAtRiskSnapshot, demoHealthySnapshot } from '@beacon/shared';
import { describe, expect, it } from 'vitest';
import { computeContributorHealth } from './team-health';

describe('computeContributorHealth', () => {
  it('reports a higher bus factor for a broad contributor base', () => {
    const healthy = computeContributorHealth(demoHealthySnapshot);
    const atRisk = computeContributorHealth(demoAtRiskSnapshot);
    expect(healthy.busFactor).toBeGreaterThan(atRisk.busFactor);
    expect(atRisk.busFactor).toBe(1);
  });

  it('keeps maintainer load in [0, 1] and higher when concentrated', () => {
    const healthy = computeContributorHealth(demoHealthySnapshot);
    const atRisk = computeContributorHealth(demoAtRiskSnapshot);
    for (const health of [healthy, atRisk]) {
      expect(health.maintainerLoad).toBeGreaterThanOrEqual(0);
      expect(health.maintainerLoad).toBeLessThanOrEqual(1);
    }
    expect(atRisk.maintainerLoad).toBeGreaterThan(healthy.maintainerLoad);
  });

  it('produces shares that sum to the covered fraction of contributions', () => {
    const health = computeContributorHealth(demoHealthySnapshot, 8);
    const total = demoHealthySnapshot.contributors.reduce(
      (sum, c) => sum + c.contributions,
      0,
    );
    const coveredContributions = health.distribution.reduce(
      (sum, d) => sum + d.contributions,
      0,
    );
    const shareSum = health.distribution.reduce((sum, d) => sum + d.share, 0);
    expect(shareSum).toBeCloseTo(coveredContributions / total, 6);
    // Each individual share is a fraction.
    for (const entry of health.distribution) {
      expect(entry.share).toBeGreaterThan(0);
      expect(entry.share).toBeLessThanOrEqual(1);
    }
  });

  it('respects topN and counts active contributors', () => {
    const health = computeContributorHealth(demoHealthySnapshot, 5);
    expect(health.distribution).toHaveLength(5);
    expect(health.totalContributors).toBe(demoHealthySnapshot.contributors.length);
    expect(health.activeContributors).toBeGreaterThanOrEqual(1);
    expect(health.activeContributors).toBeLessThanOrEqual(health.totalContributors);
  });

  it('produces distinct narratives for healthy vs at-risk repos', () => {
    const healthy = computeContributorHealth(demoHealthySnapshot);
    const atRisk = computeContributorHealth(demoAtRiskSnapshot);
    expect(healthy.narrative).not.toBe(atRisk.narrative);
    expect(atRisk.narrative.toLowerCase()).toContain('concentrated');
  });

  it('handles a snapshot with no contributors', () => {
    const empty = { ...demoHealthySnapshot, contributors: [] };
    const health = computeContributorHealth(empty);
    expect(health.busFactor).toBe(0);
    expect(health.maintainerLoad).toBe(0);
    expect(health.activeContributors).toBe(0);
    expect(health.distribution).toHaveLength(0);
  });
});
