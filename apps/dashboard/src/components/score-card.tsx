'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { BeaconScore } from '@beacon/core';
import { Card, ScoreRing, gradeColor } from '@beacon/ui';

export interface ScoreCardProps {
  score: BeaconScore;
  summary: string;
  highlights: string[];
}

/**
 * The hero analytics card: an animated Beacon Score ring beside the
 * heuristic/AI summary and highlight chips.
 */
export function ScoreCard({
  score,
  summary,
  highlights,
}: ScoreCardProps): React.JSX.Element {
  const colors = gradeColor(score.grade);

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-beacon/10 blur-3xl" />
      <div className="relative grid gap-8 p-6 md:grid-cols-[auto_1fr] md:items-center md:p-8">
        <div className="flex flex-col items-center gap-4">
          <ScoreRing value={score.total} size={188} strokeWidth={14} color={colors.hsl} />
          <div className="text-center">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${colors.text} ${colors.bg} ${colors.border}`}
            >
              {score.grade}
            </span>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              Beacon Score
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-beacon/25 bg-beacon/10 px-2.5 py-1 text-xs font-medium text-beacon">
            <Sparkles className="size-3.5" />
            AI health summary
          </div>
          <p className="text-pretty text-base leading-relaxed text-foreground/90">
            {summary}
          </p>

          {highlights.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {highlights.map((h, i) => {
                const isWarning = h.trimStart().startsWith('!');
                const text = h.replace(/^[✓!]\s*/, '');
                return (
                  <motion.span
                    key={h}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      isWarning
                        ? 'border-warning/30 bg-warning/10 text-warning'
                        : 'border-success/30 bg-success/10 text-success'
                    }`}
                  >
                    <span aria-hidden>{isWarning ? '!' : '✓'}</span>
                    {text}
                  </motion.span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
