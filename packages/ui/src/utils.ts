import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { HealthGrade, ScorePillar } from '@beacon/shared';

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a number compactly: 18432 → "18.4k", 2_140_000 → "2.1M". */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.round(value));
  if (abs < 1_000_000) {
    return `${trimZero(value / 1000)}k`;
  }
  if (abs < 1_000_000_000) {
    return `${trimZero(value / 1_000_000)}M`;
  }
  return `${trimZero(value / 1_000_000_000)}B`;
}

function trimZero(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Format an integer with thousands separators: 1893 → "1,893". */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

/** A human, relative description of an ISO timestamp: "3 days ago". */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'unknown';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'unknown';
  const diffMs = now - then;
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  const fmt = (value: number, unit: string): string => {
    const rounded = Math.max(1, Math.round(value));
    const label = `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
    return future ? `in ${label}` : `${label} ago`;
  };

  if (abs < minute) return 'just now';
  if (abs < hour) return fmt(abs / minute, 'minute');
  if (abs < day) return fmt(abs / hour, 'hour');
  if (abs < week) return fmt(abs / day, 'day');
  if (abs < month) return fmt(abs / week, 'week');
  if (abs < year) return fmt(abs / month, 'month');
  return fmt(abs / year, 'year');
}

/** Convert a duration in hours into a compact human string: 62 → "2.6d". */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${trimZero(hours)}h`;
  return `${trimZero(hours / 24)}d`;
}

/** Tailwind text/border/bg classes keyed to a health grade. */
export function gradeColor(grade: HealthGrade): {
  text: string;
  bg: string;
  border: string;
  ring: string;
  hsl: string;
} {
  switch (grade) {
    case 'Excellent':
      return {
        text: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/30',
        ring: 'ring-success/30',
        hsl: 'hsl(152 62% 47%)',
      };
    case 'Healthy':
      return {
        text: 'text-cyan',
        bg: 'bg-cyan/10',
        border: 'border-cyan/30',
        ring: 'ring-cyan/30',
        hsl: 'hsl(190 95% 55%)',
      };
    case 'Fair':
      return {
        text: 'text-beacon',
        bg: 'bg-beacon/10',
        border: 'border-beacon/30',
        ring: 'ring-beacon/30',
        hsl: 'hsl(42 96% 62%)',
      };
    case 'At risk':
      return {
        text: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/30',
        ring: 'ring-warning/30',
        hsl: 'hsl(38 92% 55%)',
      };
    case 'Critical':
    default:
      return {
        text: 'text-danger',
        bg: 'bg-danger/10',
        border: 'border-danger/30',
        ring: 'ring-danger/30',
        hsl: 'hsl(0 78% 62%)',
      };
  }
}

/** A stable accent color (hsl string) for a raw 0–100 score. */
export function scoreColor(score: number): string {
  if (score >= 90) return 'hsl(152 62% 47%)';
  if (score >= 75) return 'hsl(190 95% 55%)';
  if (score >= 60) return 'hsl(42 96% 62%)';
  if (score >= 40) return 'hsl(38 92% 55%)';
  return 'hsl(0 78% 62%)';
}

const PILLAR_LABELS: Record<ScorePillar, string> = {
  activity: 'Activity',
  community: 'Community',
  maintenance: 'Maintenance',
  documentation: 'Documentation',
  security: 'Security',
};

export function pillarLabel(pillar: ScorePillar): string {
  return PILLAR_LABELS[pillar] ?? pillar;
}

/** GitHub-style brand colors for common languages, with a stable fallback. */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Scala: '#c22d40',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Lua: '#000080',
  Makefile: '#427819',
  Dockerfile: '#384d54',
};

const FALLBACK_LANGUAGE_COLORS = ['#f5b544', '#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fb923c'];

export function languageColor(language: string, index = 0): string {
  return (
    LANGUAGE_COLORS[language] ??
    FALLBACK_LANGUAGE_COLORS[index % FALLBACK_LANGUAGE_COLORS.length] ??
    '#8b8b8b'
  );
}
