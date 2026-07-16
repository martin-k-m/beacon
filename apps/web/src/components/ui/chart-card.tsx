import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

export interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** A Card wrapper with a titled header, tuned for holding a chart. */
export function ChartCard({
  title,
  description,
  icon,
  action,
  className,
  bodyClassName,
  children,
}: ChartCardProps): React.JSX.Element {
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-4 p-6 pb-2">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-beacon">{icon}</span>}
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className={cn('flex-1 p-6 pt-2', bodyClassName)}>{children}</div>
    </Card>
  );
}
