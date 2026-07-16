import type { HealthGrade } from '@beacon/shared';

export type WidgetTheme = 'dark' | 'light' | 'transparent';
export type WidgetSize = 'small' | 'medium' | 'large';

export interface WidgetOptions {
  theme?: WidgetTheme;
  size?: WidgetSize;
  /** Accent color override (any valid CSS color). Defaults to Beacon amber. */
  accent?: string;
  /** Hide the small "Beacon" attribution mark. */
  hideAttribution?: boolean;
}

export interface ResolvedTheme {
  bg: string;
  panel: string;
  border: string;
  text: string;
  subtext: string;
  track: string;
  accent: string;
}

export const BEACON_ACCENT = '#f5b544';

const PALETTES: Record<WidgetTheme, Omit<ResolvedTheme, 'accent'>> = {
  dark: {
    bg: '#0d1117',
    panel: '#161b22',
    border: '#30363d',
    text: '#e6edf3',
    subtext: '#8b949e',
    track: '#21262d',
  },
  light: {
    bg: '#ffffff',
    panel: '#f6f8fa',
    border: '#d0d7de',
    text: '#1f2328',
    subtext: '#59636e',
    track: '#eaeef2',
  },
  transparent: {
    bg: 'transparent',
    panel: 'rgba(127,127,127,0.06)',
    border: 'rgba(127,127,127,0.25)',
    text: '#c9d1d9',
    subtext: '#8b949e',
    track: 'rgba(127,127,127,0.2)',
  },
};

export function resolveTheme(options: WidgetOptions): ResolvedTheme {
  const theme = options.theme ?? 'dark';
  return { ...PALETTES[theme], accent: options.accent ?? BEACON_ACCENT };
}

/** Grade → color, consistent across all widgets and the dashboard. */
export function gradeColor(grade: HealthGrade): string {
  switch (grade) {
    case 'Excellent':
      return '#2ea043';
    case 'Healthy':
      return '#3fb950';
    case 'Fair':
      return '#d29922';
    case 'At risk':
      return '#db6d28';
    case 'Critical':
      return '#f85149';
    default:
      return '#8b949e';
  }
}

/** Score → color on a red→amber→green ramp. */
export function scoreColor(score: number): string {
  if (score >= 90) return '#2ea043';
  if (score >= 75) return '#3fb950';
  if (score >= 60) return '#d29922';
  if (score >= 40) return '#db6d28';
  return '#f85149';
}
