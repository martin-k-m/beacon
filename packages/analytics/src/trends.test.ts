import type { BeaconScore, ScorePillar } from '@beacon/core';
import { describe, expect, it } from 'vitest';
import { computeTrend, filterRange, toHealthSeries, type AnalysisLike } from './trends';

const NOW = Date.parse('2026-07-01T00:00:00.000Z');
const DAY = 1000 * 60 * 60 * 24;

function score(total: number): Pick<BeaconScore, 'total' | 'grade' | 'pillars'> {
  const pillars: { pillar: ScorePillar; score: number; weight: number; reasons: string[] }[] = [
    { pillar: 'activity', score: total, weight: 0.3, reasons: [] },
    { pillar: 'community', score: total, weight: 0.2, reasons: [] },
    { pillar: 'maintenance', score: total, weight: 0.2, reasons: [] },
    { pillar: 'documentation', score: total, weight: 0.15, reasons: [] },
    { pillar: 'security', score: total, weight: 0.15, reasons: [] },
  ];
  return { total, grade: 'Healthy', pillars };
}

function at(daysAgo: number, total: number): AnalysisLike {
  return { score: score(total), collectedAt: new Date(NOW - daysAgo * DAY).toISOString() };
}

describe('toHealthSeries', () => {
  it('sorts ascending by time', () => {
    const series = toHealthSeries([at(0, 90), at(20, 70), at(10, 80)]);
    expect(series.map((p) => p.total)).toEqual([70, 80, 90]);
  });
});

describe('filterRange', () => {
  it('keeps only points within the range', () => {
    const series = toHealthSeries([at(5, 80), at(45, 70), at(200, 60)]);
    expect(filterRange(series, '30d', NOW)).toHaveLength(1);
    expect(filterRange(series, '90d', NOW)).toHaveLength(2);
    expect(filterRange(series, 'all', NOW)).toHaveLength(3);
  });
});

describe('computeTrend', () => {
  it('reports an improving trend with a narrative', () => {
    const series = toHealthSeries([at(28, 80), at(14, 84), at(0, 92)]);
    const trend = computeTrend(series, '30d', NOW);
    expect(trend.direction).toBe('up');
    expect(trend.current).toBe(92);
    expect(trend.previous).toBe(80);
    expect(trend.deltaPoints).toBe(12);
    expect(trend.narrative).toMatch(/improved/);
    expect(trend.narrative).toContain('92/100');
  });

  it('reports a declining trend', () => {
    const series = toHealthSeries([at(28, 90), at(0, 72)]);
    const trend = computeTrend(series, '30d', NOW);
    expect(trend.direction).toBe('down');
    expect(trend.narrative).toMatch(/declined/);
  });

  it('handles empty and single-point history', () => {
    expect(computeTrend([], '30d', NOW).narrative).toMatch(/Not enough history/);
    const single = toHealthSeries([at(0, 88)]);
    expect(computeTrend(single, '30d', NOW).narrative).toMatch(/Not enough history/);
  });

  it('computes per-pillar deltas', () => {
    const series = toHealthSeries([at(20, 70), at(0, 90)]);
    const trend = computeTrend(series, '30d', NOW);
    expect(trend.perPillar).toHaveLength(5);
    expect(trend.perPillar.every((p) => p.delta === 20)).toBe(true);
  });
});
