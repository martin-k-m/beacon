'use client';

import * as React from 'react';
import { LineChart as LineChartIcon, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { computeTrend, filterRange, type HealthPoint, type TrendRange } from '@beacon/analytics';
import { Card, cn, pillarLabel } from '@beacon/ui';

export interface HealthTrendProps {
  /** The full, ascending health series. Windowed client-side per range. */
  series: HealthPoint[];
  /** Reference "now" the ranges are measured against (ms since epoch). */
  now: number;
  /** The range selected on first paint. */
  initialRange?: TrendRange;
}

interface ChartPoint {
  timestamp: number;
  label: string;
  score: number;
  grade: string;
}

const RANGES: Array<{ value: TrendRange; label: string }> = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
  { value: 'all', label: 'All' },
];

/** hsl colors keyed to trend direction. */
const DIRECTION_COLOR: Record<'up' | 'down' | 'flat', string> = {
  up: 'hsl(152 62% 47%)',
  down: 'hsl(0 78% 62%)',
  flat: 'hsl(42 96% 62%)',
};

// Partial because Recharts injects `active`/`payload` into the cloned element.
function TrendTooltip({
  active,
  payload,
}: Partial<TooltipContentProps<number, string>>): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) return null;
  return (
    <div className="glass rounded-md px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{point.label}</p>
      <p className="mt-0.5 font-mono text-beacon">{point.score}/100</p>
      <p className="mt-0.5 text-muted-foreground">{point.grade}</p>
    </div>
  );
}

/**
 * The headline analytics feature: a repository's Beacon Score plotted over time,
 * with a range toggle, a natural-language trend narrative, a colored delta chip,
 * and per-pillar movement — all recomputed client-side from `@beacon/analytics`
 * as the range changes.
 */
export function HealthTrend({
  series,
  now,
  initialRange = '90d',
}: HealthTrendProps): React.JSX.Element {
  const [range, setRange] = React.useState<TrendRange>(initialRange);

  const trend = React.useMemo(() => computeTrend(series, range, now), [series, range, now]);

  const data = React.useMemo<ChartPoint[]>(
    () =>
      filterRange(series, range, now).map((p) => ({
        timestamp: p.timestamp,
        label: new Date(p.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        score: p.total,
        grade: p.grade,
      })),
    [series, range, now],
  );

  const color = DIRECTION_COLOR[trend.direction];
  const DirIcon =
    trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const deltaGood = trend.direction === 'up';
  const deltaNeutral = trend.direction === 'flat';
  const sign = trend.deltaPoints > 0 ? '+' : '';

  return (
    <Card className="relative overflow-hidden border-beacon/20">
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-beacon/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex flex-col gap-4 p-6 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-beacon">
            <LineChartIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Health history &amp; trend</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Beacon Score over time · {trend.points} data point
              {trend.points === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Range toggle */}
        <div
          role="tablist"
          aria-label="Trend range"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-2/60 p-1"
        >
          {RANGES.map((r) => {
            const active = r.value === range;
            return (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-beacon text-beacon-foreground shadow-[0_0_14px_-4px_hsl(var(--beacon)/0.8)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Narrative + delta */}
      <div className="relative flex flex-wrap items-center gap-3 px-6 pt-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
            deltaNeutral
              ? 'border-beacon/30 bg-beacon/10 text-beacon'
              : deltaGood
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-danger/30 bg-danger/10 text-danger',
          )}
        >
          <DirIcon className="size-3.5" />
          {sign}
          {trend.deltaPoints} pts
          <span className="opacity-70">
            ({sign}
            {trend.deltaPercent}%)
          </span>
        </span>
        <p className="min-w-0 flex-1 text-sm text-foreground/90">{trend.narrative}</p>
      </div>

      {/* Chart */}
      <div className="relative mt-3 px-2">
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(240 5% 16%)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'hsl(240 5% 55%)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: 'hsl(240 5% 55%)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <ReferenceLine
                y={75}
                stroke="hsl(190 95% 55%)"
                strokeDasharray="2 4"
                strokeOpacity={0.35}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: color, strokeOpacity: 0.35 }} />
              <Area
                type="monotone"
                dataKey="score"
                stroke={color}
                strokeWidth={2.5}
                fill="url(#trendFill)"
                activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                dot={{ r: 2, fill: color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-pillar trend */}
      {trend.perPillar.length > 0 && (
        <div className="relative border-t border-border/60 p-6 pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Per-pillar movement
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {trend.perPillar.map((p) => {
              const up = p.delta > 0;
              const flat = p.delta === 0;
              const PillarIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
              return (
                <div key={p.pillar} className="rounded-lg border border-border bg-surface-2/50 p-3">
                  <p className="truncate text-xs text-muted-foreground">{pillarLabel(p.pillar)}</p>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                      {p.current}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 text-xs font-medium',
                        flat ? 'text-muted-foreground' : up ? 'text-success' : 'text-danger',
                      )}
                    >
                      <PillarIcon className="size-3" />
                      {up ? '+' : ''}
                      {p.delta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
