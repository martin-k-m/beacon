/**
 * Terminal rendering for a {@link BeaconAnalysis}.
 *
 * All output is built as a single string so it can be unit-tested without a
 * TTY, and every colour goes through {@link palette} so that `color: false`
 * produces clean, ANSI-free text (useful for pipes, CI logs, and snapshots).
 */

import type {
  BeaconAnalysis,
  HealthGrade,
  PillarScore,
  ScorePillar,
} from '@beacon/core';
import pc from 'picocolors';

export interface RenderOptions {
  /** When false, no ANSI escape codes are emitted. */
  color: boolean;
  /** Target wrap width for prose. Defaults to 80. */
  width?: number;
}

/** A minimal colour surface so we can flip ANSI on and off in one place. */
export type Colorizer = (text: string) => string;

export interface Palette {
  bold: Colorizer;
  dim: Colorizer;
  green: Colorizer;
  yellow: Colorizer;
  red: Colorizer;
  cyan: Colorizer;
  gray: Colorizer;
  underline: Colorizer;
}

const identity: Colorizer = (text) => text;

/** Build a colour palette that emits ANSI only when `color` is true. */
export function createPalette(color: boolean): Palette {
  if (!color) {
    return {
      bold: identity,
      dim: identity,
      green: identity,
      yellow: identity,
      red: identity,
      cyan: identity,
      gray: identity,
      underline: identity,
    };
  }
  return {
    bold: (t) => pc.bold(t),
    dim: (t) => pc.dim(t),
    green: (t) => pc.green(t),
    yellow: (t) => pc.yellow(t),
    red: (t) => pc.red(t),
    cyan: (t) => pc.cyan(t),
    gray: (t) => pc.gray(t),
    underline: (t) => pc.underline(t),
  };
}

const PILLAR_LABELS: Record<ScorePillar, string> = {
  activity: 'Activity',
  community: 'Community',
  maintenance: 'Maintenance',
  documentation: 'Documentation',
  security: 'Security',
};

const BAR_FILLED = '█';
const BAR_EMPTY = '░';

/** Classify a grade into a semantic colour bucket. */
function gradeColor(palette: Palette, grade: HealthGrade): Colorizer {
  switch (grade) {
    case 'Excellent':
    case 'Healthy':
      return palette.green;
    case 'Fair':
      return palette.yellow;
    case 'At risk':
    case 'Critical':
      return palette.red;
    default:
      return palette.gray;
  }
}

/** Colour a 0–100 score the same way a grade would be coloured. */
function scoreColor(palette: Palette, score: number): Colorizer {
  if (score >= 75) {
    return palette.green;
  }
  if (score >= 50) {
    return palette.yellow;
  }
  return palette.red;
}

/** Render a fixed-width `[███░░░]` bar for a 0–100 value. */
function bar(score: number, width: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * width);
  const empty = Math.max(0, width - filled);
  return `[${BAR_FILLED.repeat(filled)}${BAR_EMPTY.repeat(empty)}]`;
}

/** Wrap prose to `width` columns without breaking mid-word. */
function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

/** `1234` → `1,234`. Locale-independent for stable test output. */
function formatNumber(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * When the score engine surfaces no explicit strengths, fall back to the
 * leading reasons of the highest-scoring pillars so the report is never empty.
 */
function deriveStrengths(pillars: PillarScore[]): string[] {
  return [...pillars]
    .filter((pillar) => pillar.score >= 70)
    .sort((a, b) => b.score - a.score)
    .flatMap((pillar) => pillar.reasons.slice(0, 1))
    .slice(0, 4);
}

/**
 * Render a full analysis report as a printable string.
 */
export function renderAnalysis(
  analysis: BeaconAnalysis,
  options: RenderOptions,
): string {
  const palette = createPalette(options.color);
  const width = options.width ?? 80;
  const { snapshot, score, summary } = analysis;
  const { metadata } = snapshot;
  const lines: string[] = [];

  // ---- Header -------------------------------------------------------------
  lines.push('');
  lines.push(palette.bold(palette.cyan(metadata.fullName)));
  if (metadata.description) {
    lines.push(palette.dim(wrap(metadata.description, width).join('\n')));
  }
  lines.push(palette.dim(palette.underline(metadata.htmlUrl)));
  lines.push('');

  // ---- Headline score -----------------------------------------------------
  const paint = gradeColor(palette, score.grade);
  const headline = `${palette.bold(`${score.total}`)}/100`;
  lines.push(
    `  ${paint(palette.bold(headline))}  ${paint(palette.bold(score.grade))}`,
  );
  lines.push(`  ${paint(bar(score.total, 24))}`);
  lines.push('');

  // ---- Pillar breakdown ---------------------------------------------------
  lines.push(palette.bold('Pillars'));
  const labelWidth = Math.max(
    ...score.pillars.map((pillar) => PILLAR_LABELS[pillar.pillar].length),
  );
  for (const pillar of score.pillars) {
    const label = PILLAR_LABELS[pillar.pillar].padEnd(labelWidth, ' ');
    const paintPillar = scoreColor(palette, pillar.score);
    const value = `${pillar.score}`.padStart(3, ' ');
    lines.push(
      `  ${palette.gray(label)}  ${paintPillar(bar(pillar.score, 16))}  ${paintPillar(value)}`,
    );
  }
  lines.push('');

  // ---- Strengths ----------------------------------------------------------
  const strengths =
    score.strengths.length > 0
      ? score.strengths
      : deriveStrengths(score.pillars);
  if (strengths.length > 0) {
    lines.push(palette.bold('Strengths'));
    for (const strength of strengths) {
      for (const [index, wrapped] of wrap(strength, width - 4).entries()) {
        const marker = index === 0 ? palette.green('✓') : ' ';
        lines.push(`  ${marker} ${wrapped}`);
      }
    }
    lines.push('');
  }

  // ---- Warnings -----------------------------------------------------------
  if (score.warnings.length > 0) {
    lines.push(palette.bold('Warnings'));
    for (const warning of score.warnings) {
      for (const [index, wrapped] of wrap(warning, width - 4).entries()) {
        const marker = index === 0 ? palette.yellow('!') : ' ';
        lines.push(`  ${marker} ${wrapped}`);
      }
    }
    lines.push('');
  }

  // ---- Quick stats --------------------------------------------------------
  const stats = [
    `${palette.bold(formatNumber(metadata.stars))} stars`,
    `${palette.bold(formatNumber(metadata.forks))} forks`,
    `${palette.bold(formatNumber(snapshot.contributors.length))} contributors`,
    `${palette.bold(metadata.primaryLanguage ?? 'n/a')}`,
    `${palette.bold(formatNumber(metadata.openIssues))} open issues`,
  ];
  lines.push(palette.gray(stats.join(palette.dim('  •  '))));
  lines.push('');

  // ---- Beacon Summary -----------------------------------------------------
  lines.push(palette.bold('Beacon Summary'));
  const model = summary.model ? `${summary.provider}/${summary.model}` : summary.provider;
  lines.push(palette.dim(`via ${model}`));
  for (const wrapped of wrap(summary.text, width)) {
    lines.push(wrapped);
  }
  if (summary.highlights.length > 0) {
    lines.push('');
    for (const highlight of summary.highlights) {
      for (const [index, wrapped] of wrap(highlight, width - 4).entries()) {
        const marker = index === 0 ? palette.cyan('›') : ' ';
        lines.push(`  ${marker} ${wrapped}`);
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}
