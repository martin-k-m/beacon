'use client';

import * as React from 'react';
import { motion, useInView } from 'framer-motion';
import { scoreColor } from '@/lib/utils';

export interface ScoreRingProps {
  /** 0–100. */
  value: number;
  /** Diameter in px. */
  size?: number;
  /** Stroke width in px. */
  strokeWidth?: number;
  /** Override the ring color; defaults to a score-derived color. */
  color?: string;
  /** Text shown under the number (e.g. the grade). */
  label?: string;
  /** Show the numeric value in the center. */
  showValue?: boolean;
  className?: string;
}

/**
 * An animated circular progress ring. The stroke sweeps from 0 to `value` on
 * first view and the number counts up in sync.
 */
export function ScoreRing({
  value,
  size = 160,
  strokeWidth = 12,
  color,
  label,
  showValue = true,
  className,
}: ScoreRingProps): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const clamped = Math.max(0, Math.min(100, value));
  const ringColor = color ?? scoreColor(clamped);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * clamped));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, clamped]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: size, height: size, position: 'relative' }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: offset } : {}}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${ringColor}66)` }}
        />
      </svg>
      {showValue && (
        <div
          style={{ position: 'absolute', inset: 0 }}
          className="flex flex-col items-center justify-center"
        >
          <span
            className="font-mono font-bold leading-none tabular-nums"
            style={{ fontSize: size * 0.28, color: ringColor }}
          >
            {display}
          </span>
          {label && (
            <span
              className="mt-1 font-medium uppercase tracking-wider text-muted-foreground"
              style={{ fontSize: size * 0.075 }}
            >
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
