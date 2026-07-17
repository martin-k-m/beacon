'use client';

import * as React from 'react';
import { Code2 } from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';
import type { LanguageBreakdown } from '@beacon/shared';
import { ChartCard } from '@/components/ui/chart-card';
import { formatCompact, languageColor } from '@/lib/utils';

export interface LanguageDonutProps {
  languages: LanguageBreakdown;
}

interface Slice {
  name: string;
  value: number;
  percent: number;
  bytes: number;
  color: string;
}

// Partial because Recharts injects `active`/`payload` into the cloned element.
function LanguageTooltip({
  active,
  payload,
}: Partial<TooltipContentProps<number, string>>): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0]?.payload as Slice | undefined;
  if (!slice) return null;
  return (
    <div className="glass rounded-md px-3 py-2 text-xs shadow-card">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: slice.color }}
        />
        {slice.name}
      </p>
      <p className="mt-0.5 font-mono text-muted-foreground">
        {slice.percent.toFixed(1)}% · {formatCompact(slice.bytes)}B
      </p>
    </div>
  );
}

/** A donut of language distribution (by bytes) with a color-dotted legend. */
export function LanguageDonut({
  languages,
}: LanguageDonutProps): React.JSX.Element {
  const slices = React.useMemo<Slice[]>(() => {
    const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
    return entries.map(([name, bytes], i) => ({
      name,
      value: bytes,
      bytes,
      percent: (bytes / total) * 100,
      color: languageColor(name, i),
    }));
  }, [languages]);

  return (
    <ChartCard
      title="Languages"
      description="Distribution by bytes of code"
      icon={<Code2 className="size-4" />}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {slices.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip content={<LanguageTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-semibold text-foreground">
              {slices.length}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              languages
            </span>
          </div>
        </div>

        <ul className="grid w-full flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          {slices.map((slice) => (
            <li key={slice.name} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground/90">
                {slice.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {slice.percent.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
