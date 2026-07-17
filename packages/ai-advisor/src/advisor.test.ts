import { describe, expect, it } from 'vitest';
import {
  demoAtRiskSnapshot,
  demoHealthySnapshot,
  type BeaconAnalysis,
  type BeaconSummary,
  type RepositorySnapshot,
} from '@beacon/shared';
import { computeBeaconScore } from '@beacon/analytics';
import type { TrendResult } from '@beacon/analytics';
import { adviseIssues, generateAdvice } from './index';
import type { AdviseInput } from './index';

function summaryFor(): BeaconSummary {
  return {
    provider: 'heuristic',
    model: null,
    text: 'stub summary',
    highlights: [],
    generatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function analysisFor(snapshot: RepositorySnapshot): BeaconAnalysis {
  return {
    snapshot,
    score: computeBeaconScore(snapshot),
    summary: summaryFor(),
  };
}

describe('adviseIssues', () => {
  it('flags a high-severity dependency/security issue for an at-risk repo', () => {
    const issues = adviseIssues({ analysis: analysisFor(demoAtRiskSnapshot) });

    expect(issues.length).toBeGreaterThan(0);

    const high = issues.filter((i) => i.severity === 'high');
    expect(high.length).toBeGreaterThan(0);
    // The at-risk demo has open vulnerability alerts.
    expect(high.some((i) => i.pillar === 'security')).toBe(true);
    expect(issues.some((i) => i.id === 'vulnerable-dependencies')).toBe(true);
  });

  it('produces a non-empty recommendation for every issue', () => {
    const issues = adviseIssues({ analysis: analysisFor(demoAtRiskSnapshot) });
    for (const issue of issues) {
      expect(issue.recommendation.trim().length).toBeGreaterThan(0);
      expect(issue.title.trim().length).toBeGreaterThan(0);
      expect(issue.detail.trim().length).toBeGreaterThan(0);
    }
  });

  it('sorts high-severity issues ahead of lower ones', () => {
    const issues = adviseIssues({ analysis: analysisFor(demoAtRiskSnapshot) });
    const rank = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < issues.length; i++) {
      const prev = issues[i - 1]!;
      const cur = issues[i]!;
      expect(rank[prev.severity]).toBeLessThanOrEqual(rank[cur.severity]);
    }
  });

  it('is deterministic for identical input', () => {
    const input: AdviseInput = { analysis: analysisFor(demoAtRiskSnapshot) };
    expect(adviseIssues(input)).toEqual(adviseIssues(input));
  });

  it('yields fewer high-severity issues for a healthy repo', () => {
    const risky = adviseIssues({ analysis: analysisFor(demoAtRiskSnapshot) });
    const healthy = adviseIssues({ analysis: analysisFor(demoHealthySnapshot) });

    const riskyHigh = risky.filter((i) => i.severity === 'high').length;
    const healthyHigh = healthy.filter((i) => i.severity === 'high').length;

    expect(healthyHigh).toBe(0);
    expect(healthyHigh).toBeLessThan(riskyHigh);
  });

  it('adds trend-driven issues for meaningful per-pillar declines', () => {
    const trend: TrendResult = {
      range: '30d',
      points: 4,
      current: 70,
      previous: 82,
      deltaPoints: -12,
      deltaPercent: -14.6,
      direction: 'down',
      perPillar: [
        { pillar: 'documentation', current: 60, previous: 80, delta: -20 },
        { pillar: 'activity', current: 78, previous: 79, delta: -1 },
      ],
      narrative: 'Repository health declined 15% over the last 30 days, now 70/100.',
    };

    const issues = adviseIssues({ analysis: analysisFor(demoHealthySnapshot), trend });
    const decline = issues.find((i) => i.id === 'trend-decline-documentation');
    expect(decline).toBeDefined();
    expect(decline?.pillar).toBe('documentation');
    expect(decline?.recommendation.trim().length).toBeGreaterThan(0);
    // A one-point drop should not generate an issue.
    expect(issues.some((i) => i.id === 'trend-decline-activity')).toBe(false);
  });
});

describe('generateAdvice', () => {
  it('builds a report and respects maxIssues (offline, heuristic summary)', async () => {
    const report = await generateAdvice(
      { analysis: analysisFor(demoAtRiskSnapshot) },
      { maxIssues: 3 },
    );

    expect(report.issues.length).toBeLessThanOrEqual(3);
    expect(report.score).toBe(computeBeaconScore(demoAtRiskSnapshot).total);
    expect(report.grade.length).toBeGreaterThan(0);
    expect(report.summary.trim().length).toBeGreaterThan(0);
    expect(report.headline.trim().length).toBeGreaterThan(0);
    expect(Date.parse(report.generatedAt)).not.toBeNaN();
  });

  it('drives the headline and delta from the trend when provided', async () => {
    const trend: TrendResult = {
      range: '30d',
      points: 3,
      current: 60,
      previous: 65,
      deltaPoints: -5,
      deltaPercent: -8,
      direction: 'down',
      perPillar: [],
      narrative: 'Repository health declined 8% over the last 30 days, now 60/100.',
    };

    const report = await generateAdvice({ analysis: analysisFor(demoAtRiskSnapshot), trend });
    expect(report.healthDeltaPercent).toBe(-8);
    expect(report.headline).toContain('decreased');
    expect(report.headline).toContain('8%');
  });

  it('produces a healthy headline with no high issues for a healthy repo', async () => {
    const report = await generateAdvice({ analysis: analysisFor(demoHealthySnapshot) });
    expect(report.issues.filter((i) => i.severity === 'high').length).toBe(0);
    expect(report.healthDeltaPercent).toBeUndefined();
  });
});
