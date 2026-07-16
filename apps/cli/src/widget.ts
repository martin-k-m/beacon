/**
 * Helpers for the `widget`, `badge`, and `watch` commands.
 *
 * Everything here is pure and side-effect free: functions take an analysis (or
 * its scalar fields) and return strings. The command layer in {@link ./index}
 * owns all I/O (spinner, file writes, stdout), so these helpers stay trivially
 * unit-testable without a TTY, filesystem, or network.
 */

import { parseRepoIdentifier } from '@beacon/github';
import { type BeaconAnalysis, type HealthGrade } from '@beacon/shared';
import {
  embedSnippets,
  isWidgetType,
  renderMaintenanceBadge,
  renderWidget,
  type WidgetOptions,
  type WidgetSize,
  type WidgetTheme,
} from '@beacon/widgets';

import { BeaconCliError } from './analysis';
import { createPalette, type Palette } from './render';

/** Widget types the `widget` command accepts (everything but the badge). */
const WIDGET_COMMAND_TYPES = ['health', 'activity', 'language', 'contributor', 'release'] as const;

const THEMES: readonly WidgetTheme[] = ['dark', 'light', 'transparent'];
const SIZES: readonly WidgetSize[] = ['small', 'medium', 'large'];

/** The pixel-free reassurance printed alongside a written SVG. */
export const PIXEL_FREE_NOTE =
  'The SVG is self-contained — no external fonts, scripts, or tracking pixels.';

export interface EmbedSnippets {
  url: string;
  markdown: string;
  html: string;
}

/** Validate a `--theme` value, throwing a friendly error otherwise. */
export function normalizeTheme(value: string): WidgetTheme {
  const theme = value.toLowerCase();
  if ((THEMES as readonly string[]).includes(theme)) {
    return theme as WidgetTheme;
  }
  throw new BeaconCliError(
    `Unknown --theme "${value}". Expected one of: ${THEMES.join(', ')}.`,
  );
}

/** Validate a `--size` value, throwing a friendly error otherwise. */
export function normalizeSize(value: string): WidgetSize {
  const size = value.toLowerCase();
  if ((SIZES as readonly string[]).includes(size)) {
    return size as WidgetSize;
  }
  throw new BeaconCliError(
    `Unknown --size "${value}". Expected one of: ${SIZES.join(', ')}.`,
  );
}

/** Derive `owner`/`repo` from an analysis (works for demo + live alike). */
export function ownerRepo(analysis: BeaconAnalysis): { owner: string; repo: string } {
  return parseRepoIdentifier(analysis.snapshot.metadata.fullName);
}

export interface BuiltWidget {
  svg: string;
  snippets: EmbedSnippets;
}

/**
 * Render a widget SVG and its embed snippets. `type` is validated with
 * {@link isWidgetType}; the `badge` type is rejected here since it has its own
 * command and renderer ({@link buildBadge}).
 */
export function buildWidget(
  analysis: BeaconAnalysis,
  options: { type: string; host: string; theme: WidgetTheme; size: WidgetSize },
): BuiltWidget {
  const { type, host, theme, size } = options;
  if (!isWidgetType(type)) {
    throw new BeaconCliError(
      `Unknown widget type "${type}". Expected one of: ${WIDGET_COMMAND_TYPES.join(', ')}.`,
    );
  }
  if (type === 'badge') {
    throw new BeaconCliError('Use "beacon badge" to render the maintenance badge.');
  }
  const widgetOptions: WidgetOptions = { theme, size };
  const svg = renderWidget(type, analysis, widgetOptions);
  const { owner, repo } = ownerRepo(analysis);
  const snippets = embedSnippets(host, owner, repo, type, widgetOptions);
  return { svg, snippets };
}

/** Render the maintenance badge SVG and its (badge-typed) embed snippets. */
export function buildBadge(
  analysis: BeaconAnalysis,
  options: { host: string; theme: WidgetTheme; size: WidgetSize },
): BuiltWidget {
  const { host, theme, size } = options;
  const widgetOptions: WidgetOptions = { theme, size };
  const svg = renderMaintenanceBadge(analysis, widgetOptions);
  const { owner, repo } = ownerRepo(analysis);
  const snippets = embedSnippets(host, owner, repo, 'badge', widgetOptions);
  return { svg, snippets };
}

export interface FormatEmbedOptions {
  color: boolean;
  /** Restrict the block to the Markdown snippet only (used by `badge`). */
  markdownOnly?: boolean;
}

/** Format embed snippets as an indented, optionally-coloured block. */
export function formatEmbedSnippets(
  snippets: EmbedSnippets,
  options: FormatEmbedOptions,
): string {
  const palette = createPalette(options.color);
  const lines: string[] = [];
  lines.push(palette.bold('Embed'));
  lines.push(`  ${palette.gray('URL')}`);
  lines.push(`  ${palette.cyan(palette.underline(snippets.url))}`);
  lines.push('');
  lines.push(`  ${palette.gray('Markdown')}`);
  lines.push(`  ${snippets.markdown}`);
  if (!options.markdownOnly) {
    lines.push('');
    lines.push(`  ${palette.gray('HTML')}`);
    lines.push(`  ${snippets.html}`);
  }
  return lines.join('\n');
}

/** Signed delta between two scores, e.g. `+2`, `-1`, or `—` for no change. */
export function formatDelta(current: number, previous: number | null, palette: Palette): string {
  if (previous === null) {
    return palette.dim('—');
  }
  const diff = current - previous;
  if (diff > 0) {
    return palette.green(`+${diff}`);
  }
  if (diff < 0) {
    return palette.red(`${diff}`);
  }
  return palette.dim('—');
}

/**
 * Build one timestamped watch line: repo, score/grade, and the delta versus the
 * previous poll.
 */
export function formatWatchLine(
  repository: string,
  score: number,
  grade: HealthGrade,
  previous: number | null,
  options: { color: boolean; timestamp?: Date },
): string {
  const palette = createPalette(options.color);
  const timestamp = (options.timestamp ?? new Date()).toISOString();
  const delta = formatDelta(score, previous, palette);
  return `${palette.dim(timestamp)}  ${palette.bold(repository)}  ${palette.bold(`${score}`)}/100 ${palette.gray(grade)}  ${delta}`;
}
