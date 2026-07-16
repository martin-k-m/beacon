import type { BeaconScore, HealthGrade, ScorePillar } from '@beacon/core';

/** The minimal shape needed from a stored analysis to build a trend. */
export interface AnalysisLike {
  score: Pick<BeaconScore, 'total' | 'grade' | 'pillars'>;
  collectedAt: string;
}

/** One point in a repository's health history. */
export interface HealthPoint {
  collectedAt: string;
  timestamp: number;
  total: number;
  grade: HealthGrade;
  pillars: { pillar: ScorePillar; score: number }[];
}

export type TrendRange = '30d' | '90d' | '1y' | 'all';

export interface PillarTrend {
  pillar: ScorePillar;
  current: number;
  previous: number;
  delta: number;
}

export interface TrendResult {
  range: TrendRange;
  points: number;
  current: number | null;
  previous: number | null;
  deltaPoints: number;
  deltaPercent: number;
  direction: 'up' | 'down' | 'flat';
  perPillar: PillarTrend[];
  narrative: string;
}

const RANGE_DAYS: Record<Exclude<TrendRange, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const DAY = 1000 * 60 * 60 * 24;

/** Convert stored analyses into an ascending, timestamped health series. */
export function toHealthSeries(items: AnalysisLike[]): HealthPoint[] {
  return items
    .map((item) => ({
      collectedAt: item.collectedAt,
      timestamp: Date.parse(item.collectedAt),
      total: item.score.total,
      grade: item.score.grade,
      pillars: item.score.pillars.map((p) => ({ pillar: p.pillar, score: p.score })),
    }))
    .filter((p) => Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Keep only the points inside a time range (relative to `now`). */
export function filterRange(
  series: HealthPoint[],
  range: TrendRange,
  now: number = Date.now(),
): HealthPoint[] {
  if (range === 'all') return series;
  const cutoff = now - RANGE_DAYS[range] * DAY;
  return series.filter((p) => p.timestamp >= cutoff);
}

/** Extract just the score values, e.g. for a sparkline. */
export function sparkline(series: HealthPoint[]): number[] {
  return series.map((p) => p.total);
}

function describeRange(range: TrendRange): string {
  switch (range) {
    case '30d':
      return 'over the last 30 days';
    case '90d':
      return 'over the last 90 days';
    case '1y':
      return 'over the last year';
    case 'all':
      return 'over its recorded history';
  }
}

/**
 * Compute the trend for a repository's health over a range. Compares the most
 * recent point to the earliest point within the range and produces per-pillar
 * deltas plus a natural-language narrative.
 */
export function computeTrend(
  series: HealthPoint[],
  range: TrendRange = '30d',
  now: number = Date.now(),
): TrendResult {
  const windowed = filterRange(series, range, now);

  if (windowed.length === 0) {
    return {
      range,
      points: 0,
      current: null,
      previous: null,
      deltaPoints: 0,
      deltaPercent: 0,
      direction: 'flat',
      perPillar: [],
      narrative: 'Not enough history yet to compute a trend.',
    };
  }

  const first = windowed[0]!;
  const last = windowed[windowed.length - 1]!;
  const current = last.total;
  const previous = first.total;
  const deltaPoints = current - previous;
  const deltaPercent = previous > 0 ? (deltaPoints / previous) * 100 : 0;
  const direction: TrendResult['direction'] =
    deltaPoints > 0 ? 'up' : deltaPoints < 0 ? 'down' : 'flat';

  const perPillar: PillarTrend[] = last.pillars.map((p) => {
    const before = first.pillars.find((x) => x.pillar === p.pillar);
    return {
      pillar: p.pillar,
      current: p.score,
      previous: before?.score ?? p.score,
      delta: p.score - (before?.score ?? p.score),
    };
  });

  const narrative = buildNarrative(windowed.length, current, deltaPercent, direction, range);

  return {
    range,
    points: windowed.length,
    current,
    previous,
    deltaPoints,
    deltaPercent: Math.round(deltaPercent * 10) / 10,
    direction,
    perPillar,
    narrative,
  };
}

function buildNarrative(
  points: number,
  current: number,
  deltaPercent: number,
  direction: TrendResult['direction'],
  range: TrendRange,
): string {
  if (points < 2) {
    return `Beacon Score is ${current}/100. Not enough history yet to show a trend.`;
  }
  const magnitude = Math.abs(Math.round(deltaPercent));
  const window = describeRange(range);
  if (direction === 'flat' || magnitude === 0) {
    return `Repository health held steady at ${current}/100 ${window}.`;
  }
  const verb = direction === 'up' ? 'improved' : 'declined';
  return `Repository health ${verb} ${magnitude}% ${window}, now ${current}/100.`;
}

export const BEACON_ANALYTICS_VERSION = '0.1.0';
