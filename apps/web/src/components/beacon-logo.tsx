import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BeaconLogoProps {
  size?: number;
  className?: string;
  /** Show the "Beacon" wordmark next to the mark. */
  withWordmark?: boolean;
}

/**
 * The Beacon mark — a stylized lighthouse emitting a signal beam. Rendered as
 * inline SVG so it inherits currentColor and needs no assets.
 */
export function BeaconLogo({
  size = 28,
  className,
  withWordmark = false,
}: BeaconLogoProps): React.JSX.Element {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id="beacon-body"
          x1="16"
          y1="8"
          x2="16"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="hsl(42 96% 68%)" />
          <stop offset="1" stopColor="hsl(38 90% 52%)" />
        </linearGradient>
        <radialGradient id="beacon-glow" cx="16" cy="8" r="9" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(42 100% 70%)" stopOpacity="0.95" />
          <stop offset="1" stopColor="hsl(42 100% 70%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Signal beams */}
      <path d="M14 8 L4 3.5 L4.8 6.6 L13.2 9.2 Z" fill="hsl(42 96% 62%)" opacity="0.55" />
      <path d="M18 8 L28 3.5 L27.2 6.6 L18.8 9.2 Z" fill="hsl(42 96% 62%)" opacity="0.55" />
      {/* Lamp glow */}
      <circle cx="16" cy="8" r="8" fill="url(#beacon-glow)" />
      {/* Lamp */}
      <circle cx="16" cy="8" r="3.4" fill="hsl(42 100% 72%)" />
      {/* Tower */}
      <path
        d="M12.4 12 H19.6 L18 29 A0.6 0.6 0 0 1 17.4 29.5 H14.6 A0.6 0.6 0 0 1 14 29 Z"
        fill="url(#beacon-body)"
      />
      {/* Tower stripes */}
      <path d="M12.9 16 H19.1 L18.95 18 H13.05 Z" fill="hsl(30 40% 12%)" opacity="0.65" />
      <path d="M13.25 21 H18.75 L18.6 23 H13.4 Z" fill="hsl(30 40% 12%)" opacity="0.65" />
      {/* Gallery railing */}
      <rect x="11.4" y="11.2" width="9.2" height="1.6" rx="0.8" fill="hsl(38 80% 46%)" />
    </svg>
  );

  if (!withWordmark) return <span className={cn('inline-flex', className)}>{mark}</span>;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {mark}
      <span className="text-lg font-semibold tracking-tight text-foreground">Beacon</span>
    </span>
  );
}
