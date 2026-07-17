'use client';

import * as React from 'react';
import { Activity } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { CommitActivityWeek } from '@beacon/shared';
import { ChartCard } from '@/components/ui/chart-card';

export interface CommitTimelineProps {
  activity: CommitActivityWeek[];
}

interface Point {
  date: number;
  label: string;
  commits: number;
}

// Recharts injects `active`/`payload` when it clones the element passed to
// `content`, so they are optional at the call site — hence Partial. The guards
// below are what make that safe.
function CommitTooltip({
  active,
  payload,
}: Partial<TooltipContentProps<number, string>>): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as Point | undefined;
  if (!point) return null;
  return (
    <div className="glass rounded-md px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{point.label}</p>
      <p className="mt-0.5 font-mono text-beacon">
        {point.commits} commit{point.commits === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/** A gradient area chart of the 52-week commit histogram. */
export function CommitTimeline({
  activity,
}: CommitTimelineProps): React.JSX.Element {
  const data = React.useMemo<Point[]>(
    () =>
      activity.map((week) => {
        // weekStart is unix SECONDS → ms.
        const date = week.weekStart * 1000;
        return {
          date,
          label: new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          commits: week.total,
        };
      }),
    [activity],
  );

  const total = React.useMemo(
    () => data.reduce((sum, d) => sum + d.commits, 0),
    [data],
  );

  return (
    <ChartCard
      title="Commit activity"
      description={`${total.toLocaleString('en-US')} commits over the last 52 weeks`}
      icon={<Activity className="size-4" />}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="commitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(42 96% 62%)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(42 96% 62%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="hsl(240 5% 16%)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(240 5% 55%)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
            />
            <YAxis
              tick={{ fill: 'hsl(240 5% 55%)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              content={<CommitTooltip />}
              cursor={{ stroke: 'hsl(42 96% 62%)', strokeOpacity: 0.3 }}
            />
            <Area
              type="monotone"
              dataKey="commits"
              stroke="hsl(42 96% 62%)"
              strokeWidth={2}
              fill="url(#commitFill)"
              activeDot={{ r: 4, fill: 'hsl(42 96% 62%)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
