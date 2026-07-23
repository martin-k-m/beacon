import * as React from 'react';
import { cn } from './utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('shimmer animate-shimmer rounded-md', className)} {...props} />;
}

export { Skeleton };
