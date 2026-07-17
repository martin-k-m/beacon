/**
 * `beacon history` — a health / event timeline for a repository.
 *
 * Two modes:
 *  - **Offline / demo** (`--demo`, `--local`, or no API configured): synthesize
 *    a health history from the snapshot with {@link generateDemoHistory} and
 *    render each point newest→oldest with its date, score, and the delta vs the
 *    previous point.
 *  - **API** (an `apiUrl` is configured and neither `--demo` nor `--local`):
 *    fetch the repository's stored `events` and `trend` and render the real
 *    timeline.
 */

import {
  computeTrend,
  filterRange,
  generateDemoHistory,
  toHealthSeries,
  type HealthPoint,
  type TrendRange,
  type TrendResult,
} from '@beacon/analytics';

import { resolveAnalysis, resolveRepository, type AiConfig } from './analysis';
import type { ResolvedConfig } from './config';
import { colorEnabled, describeError, printNotes, writeError } from './output';
import { createPalette, formatDelta } from './render';
import { createSpinner } from './spinner';

/** Ranges the CLI accepts (a superset of the analytics {@link TrendRange}). */
export type HistoryRange = '7d' | '30d' | '90d' | '1y' | 'all';

const RANGE_DAYS: Record<Exclude<HistoryRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const DAY_MS = 1000 * 60 * 60 * 24;

export interface HistoryCommandOptions {
  range: HistoryRange;
  local?: boolean;
  demo?: boolean;
  token?: string;
  json?: boolean;
  ai: AiConfig;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

/** A single event from the API `events` endpoint (defensively typed). */
interface TimelineEvent {
  type: string;
  title: string;
  detail?: string;
  pillar?: string;
  healthDelta?: number;
  occurredAt: string;
}

function describeRange(range: HistoryRange): string {
  switch (range) {
    case '7d':
      return 'last 7 days';
    case '30d':
      return 'last 30 days';
    case '90d':
      return 'last 90 days';
    case '1y':
      return 'last year';
    case 'all':
      return 'all time';
  }
}

/** `2026-07-16T…` → `2026-07-16`. Falls back to the raw string. */
function formatDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

/** Filter a health series to a range (handles `7d`, which analytics omits). */
function filterHistory(series: HealthPoint[], range: HistoryRange, now: number): HealthPoint[] {
  if (range === 'all') {
    return series;
  }
  if (range === '7d') {
    const cutoff = now - RANGE_DAYS['7d'] * DAY_MS;
    return series.filter((point) => point.timestamp >= cutoff);
  }
  return filterRange(series, range, now);
}

/** Map the CLI range onto a valid analytics/API {@link TrendRange}. */
function toTrendRange(range: HistoryRange): TrendRange {
  return range === '7d' ? '30d' : range;
}

// ---------------------------------------------------------------------------
// Synthetic (demo / offline) timeline
// ---------------------------------------------------------------------------

/** Render a synthetic health timeline from a health series (newest→oldest). */
export function renderHealthTimeline(
  series: HealthPoint[],
  fullName: string,
  range: HistoryRange,
  color: boolean,
): string {
  const palette = createPalette(color);
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${palette.bold(palette.cyan(fullName))}  ${palette.dim(`· ${describeRange(range)}`)}`);
  lines.push('');

  if (series.length === 0) {
    lines.push(`  ${palette.dim('No history in this range.')}`);
    lines.push('');
    return lines.join('\n');
  }

  // Newest first; delta compares each point to the chronologically previous one.
  for (let i = series.length - 1; i >= 0; i--) {
    const point = series[i]!;
    const date = formatDate(point.collectedAt);
    const score = `${point.total}/100`.padStart(7, ' ');
    const older = i > 0 ? series[i - 1] : undefined;
    const delta = older ? formatDelta(point.total - older.total, palette) : palette.dim('  —');
    lines.push(`  ${palette.gray(date)}  ${palette.cyan('●')} ${palette.bold(score)}  ${delta}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// API (real) timeline
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Parse the loosely-typed `events` payload into {@link TimelineEvent}s. */
function parseEvents(payload: unknown): TimelineEvent[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const events: TimelineEvent[] = [];
  for (const raw of payload) {
    const record = asRecord(raw);
    if (!record) {
      continue;
    }
    const type = asString(record['type']);
    const title = asString(record['title']);
    const occurredAt = asString(record['occurredAt']);
    if (!type || !title || !occurredAt) {
      continue;
    }
    const event: TimelineEvent = { type, title, occurredAt };
    const detail = asString(record['detail']);
    if (detail) {
      event.detail = detail;
    }
    const pillar = asString(record['pillar']);
    if (pillar) {
      event.pillar = pillar;
    }
    if (typeof record['healthDelta'] === 'number') {
      event.healthDelta = record['healthDelta'];
    }
    events.push(event);
  }
  return events;
}

/** Fetch JSON from the API, or null on any failure. Never throws. */
async function fetchJson(url: string, token: string | undefined): Promise<unknown | null> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/** Render a real event timeline plus the trend narrative. */
export function renderEventTimeline(
  events: TimelineEvent[],
  trend: TrendResult | null,
  fullName: string,
  range: HistoryRange,
  color: boolean,
): string {
  const palette = createPalette(color);
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${palette.bold(palette.cyan(fullName))}  ${palette.dim(`· ${describeRange(range)}`)}`);
  if (trend && trend.points >= 2) {
    lines.push(`  ${palette.dim(trend.narrative)}`);
  }
  lines.push('');

  if (events.length === 0) {
    lines.push(`  ${palette.dim('No recorded events in this range yet.')}`);
    lines.push('');
    return lines.join('\n');
  }

  const typeWidth = Math.min(14, Math.max(6, ...events.map((e) => e.type.length)));
  for (const event of events) {
    const date = formatDate(event.occurredAt);
    const type = event.type.padEnd(typeWidth, ' ');
    const delta =
      typeof event.healthDelta === 'number' && event.healthDelta !== 0
        ? `  ${formatDelta(event.healthDelta, palette)}`
        : '';
    lines.push(`  ${palette.gray(date)}  ${palette.cyan(type)}  ${event.title}${delta}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

async function runHistory(
  repositoryArg: string | undefined,
  options: HistoryCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);
  const now = Date.now();

  // Decide the mode. The API path needs a configured apiUrl and a real repo
  // (not --demo / --local).
  const useApi = Boolean(options.config.apiUrl) && !options.demo && !options.local;

  let repository: string;
  try {
    repository = options.local
      ? 'local'
      : options.demo
        ? repositoryArg ?? ''
        : resolveRepository(repositoryArg, options.config, options.cwd);
  } catch (error) {
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  // ---- API path ----------------------------------------------------------
  if (useApi) {
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      writeError(`Expected "owner/repo", got "${repository}".`, color);
      process.exitCode = 1;
      return;
    }
    const base = options.config.apiUrl!.replace(/\/$/, '');
    const token = options.config.apiToken;

    const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
    spinner.start(`Fetching timeline for ${repository}…`);

    const [eventsPayload, trendPayload] = await Promise.all([
      fetchJson(`${base}/api/repositories/${owner}/${repo}/events`, token),
      fetchJson(
        `${base}/api/repositories/${owner}/${repo}/trend?range=${toTrendRange(options.range)}`,
        token,
      ),
    ]);

    spinner.stop();

    let events = parseEvents(eventsPayload);
    // Filter events to the requested range locally (7d is CLI-only).
    if (options.range !== 'all') {
      const days = RANGE_DAYS[options.range];
      const cutoff = now - days * DAY_MS;
      events = events.filter((event) => {
        const at = Date.parse(event.occurredAt);
        return !Number.isFinite(at) || at >= cutoff;
      });
    }
    // Newest first.
    events.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

    const trendRecord = asRecord(trendPayload);
    const trend = (trendRecord?.['trend'] as TrendResult | undefined) ?? null;

    if (options.json) {
      process.stdout.write(`${JSON.stringify({ events, trend }, null, 2)}\n`);
      return;
    }

    process.stdout.write(renderEventTimeline(events, trend, repository, options.range, color));
    return;
  }

  // ---- Synthetic / offline path ------------------------------------------
  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(
    options.local ? 'Analyzing local repository…' : `Building timeline for ${repository}…`,
  );

  let series: HealthPoint[];
  let fullName: string;
  let notes: string[] = [];
  try {
    const result = await resolveAnalysis(repository, {
      demo: options.demo,
      local: options.local,
      token: options.token,
      ai: options.ai,
      config: options.config,
      cwd: options.cwd,
    });
    notes = result.notes;
    fullName = result.analysis.snapshot.metadata.fullName;
    const history = generateDemoHistory(result.analysis.snapshot);
    const full = toHealthSeries(history);
    const lastTs = full.length > 0 ? full[full.length - 1]!.timestamp : now;
    series = filterHistory(full, options.range, lastTs);
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.json) {
    const trend = computeTrend(series, toTrendRange(options.range), series.length > 0 ? series[series.length - 1]!.timestamp : now);
    const points = series
      .slice()
      .reverse()
      .map((point, index, reversed) => {
        const older = reversed[index + 1];
        return {
          date: formatDate(point.collectedAt),
          score: point.total,
          grade: point.grade,
          delta: older ? point.total - older.total : null,
        };
      });
    process.stdout.write(`${JSON.stringify({ range: options.range, points, trend }, null, 2)}\n`);
    printNotes(notes, color);
    return;
  }

  process.stdout.write(renderHealthTimeline(series, fullName, options.range, color));
  printNotes(notes, color);
}

export { runHistory };
