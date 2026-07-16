'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  /** 0–100. */
  value: number;
  /** CSS color for the fill (hsl string or var). */
  color?: string;
  className?: string;
  /** Height token; defaults to a slim 8px bar. */
  height?: number;
  /** Delay the fill animation, in seconds. */
  delay?: number;
  label?: string;
  valueLabel?: string;
}

/** An animated horizontal progress bar that fills on mount. */
export function ProgressBar({
  value,
  color = 'hsl(var(--beacon))',
  className,
  height = 8,
  delay = 0,
  label,
  valueLabel,
}: ProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full', className)}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          {valueLabel && (
            <span className="font-mono font-medium text-foreground">{valueLabel}</span>
          )}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full bg-muted"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 12px -2px ${color}` }}
          initial={{ width: '0%' }}
          whileInView={{ width: `${clamped}%` }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
