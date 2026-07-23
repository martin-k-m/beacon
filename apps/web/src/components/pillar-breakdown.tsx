'use client';

import * as React from 'react';
import { Layers } from 'lucide-react';
import type { PillarScore } from '@beacon/shared';
import { ChartCard } from '@/components/ui/chart-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { pillarLabel, scoreColor } from '@/lib/utils';

export interface PillarBreakdownProps {
  pillars: PillarScore[];
}

/** The five weighted pillars as animated bars, each with its top reason. */
export function PillarBreakdown({ pillars }: PillarBreakdownProps): React.JSX.Element {
  return (
    <ChartCard
      title="Pillar breakdown"
      description="The five weighted signals behind the Beacon Score"
      icon={<Layers className="size-4" />}
    >
      <div className="space-y-5">
        {pillars.map((pillar, i) => {
          const color = scoreColor(pillar.score);
          const reason = pillar.reasons[0];
          return (
            <div key={pillar.pillar}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {pillarLabel(pillar.pillar)}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {Math.round(pillar.weight * 100)}% weight
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums" style={{ color }}>
                  {pillar.score}
                </span>
              </div>
              <ProgressBar value={pillar.score} color={color} delay={i * 0.08} height={8} />
              {reason && <p className="mt-1.5 text-xs text-muted-foreground">{reason}</p>}
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
