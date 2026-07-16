import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from './utils';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  /** Signed percentage/number delta; sign drives the up/down chip. */
  delta?: number;
  /** For deltas where a decrease is good (e.g. time-to-close), flip colors. */
  invertDelta?: boolean;
  className?: string;
}

/** A compact metric tile: label, big value, optional trend chip. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  invertDelta = false,
  className,
}: StatCardProps): React.JSX.Element {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta) && delta !== 0;
  const positive = hasDelta && delta! > 0;
  const good = hasDelta && (invertDelta ? !positive : positive);

  return (
    <div className={cn('glass card-hover rounded-lg p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground/70" />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
              good ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta!)}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
