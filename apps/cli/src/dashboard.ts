/**
 * `beacon dashboard` — a dependency-free terminal dashboard.
 *
 * Renders a "BEACON" header, a list of repositories with their Beacon Scores
 * and a ✓/⚠/✗ status against the configured threshold, and a "Recent Alerts"
 * section. Repositories are sourced from the local repository plus any tracked
 * repositories in project/global config; with none configured it falls back to
 * the bundled demo repositories (whose synthetic history powers trend alerts).
 *
 * When stdout is a TTY the dashboard is interactive: ↑/↓ move the selection,
 * Enter expands a repository, `r` refreshes, and `q`/Ctrl-C quits. When output
 * is piped or in CI it prints a single static snapshot and exits.
 */

import {
  analyzeSnapshot,
  computeTrend,
  generateDemoHistory,
  toHealthSeries,
} from '@beacon/analytics';
import { demoSnapshots, type BeaconAnalysis, type HealthGrade } from '@beacon/shared';

import { analyzeLocal } from './local';
import { isGitRepo } from './git';
import { loadConfig, resolveClient, DEFAULT_SCORE_THRESHOLD, type ResolvedConfig } from './config';
import { createPalette, starRating, type Palette } from './render';

type Status = 'ok' | 'warn' | 'fail';

interface DashboardEntry {
  repo: string;
  score: number | null;
  grade: HealthGrade | null;
  status: Status;
  origin: 'local' | 'tracked' | 'demo';
  analysis: BeaconAnalysis | null;
  error?: string;
}

interface Alert {
  repo: string;
  kind: 'up' | 'down' | 'warn';
  message: string;
}

export interface DashboardData {
  entries: DashboardEntry[];
  alerts: Alert[];
  threshold: number;
  source: 'live' | 'demo';
}

export interface DashboardOptions {
  color: boolean;
  cwd?: string;
  json?: boolean;
  demo?: boolean;
}

function statusFor(score: number | null, threshold: number): Status {
  if (score === null) {
    return 'fail';
  }
  if (score >= threshold) {
    return 'ok';
  }
  if (score >= threshold - 20) {
    return 'warn';
  }
  return 'fail';
}

function statusIcon(status: Status): string {
  switch (status) {
    case 'ok':
      return '✓';
    case 'warn':
      return '⚠';
    case 'fail':
      return '✗';
  }
}

function paintStatus(palette: Palette, status: Status, text: string): string {
  switch (status) {
    case 'ok':
      return palette.green(text);
    case 'warn':
      return palette.yellow(text);
    case 'fail':
      return palette.red(text);
  }
}

/** Collect the unique repositories to display from config. */
function trackedRepos(config: ResolvedConfig): string[] {
  const set = new Set<string>();
  if (config.project.repository) {
    set.add(config.project.repository);
  }
  for (const repo of config.project.tracking ?? []) {
    set.add(repo);
  }
  for (const repo of config.global.tracking ?? []) {
    set.add(repo);
  }
  return [...set];
}

/** Build an entry from a completed analysis. */
function entryFromAnalysis(
  repo: string,
  origin: DashboardEntry['origin'],
  analysis: BeaconAnalysis,
  threshold: number,
): DashboardEntry {
  const score = analysis.score.total;
  return {
    repo,
    score,
    grade: analysis.score.grade,
    status: statusFor(score, threshold),
    origin,
    analysis,
  };
}

/**
 * Gather dashboard data. Never throws — per-repository failures become entries
 * with an error message so one bad repo cannot blank the whole dashboard.
 */
export async function gatherDashboard(
  options: DashboardOptions = { color: false },
): Promise<DashboardData> {
  const cwd = options.cwd ?? process.cwd();
  const config = loadConfig(cwd);
  const threshold = config.project.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;

  const entries: DashboardEntry[] = [];
  const alerts: Alert[] = [];

  const tracked = trackedRepos(config);
  const wantLive = !options.demo;

  // Local repository (offline).
  if (wantLive && isGitRepo(cwd)) {
    try {
      const { analysis } = await analyzeLocal({ cwd });
      entries.push(
        entryFromAnalysis(analysis.snapshot.metadata.fullName, 'local', analysis, threshold),
      );
    } catch {
      // Not fatal — just skip the local entry.
    }
  }

  // Tracked repositories (via the SDK, when a client can reach them).
  if (wantLive && tracked.length > 0) {
    const client = resolveClient(config);
    for (const repo of tracked) {
      try {
        const analysis = await client.analyze(repo);
        entries.push(entryFromAnalysis(repo, 'tracked', analysis, threshold));
      } catch (error) {
        entries.push({
          repo,
          score: null,
          grade: null,
          status: 'fail',
          origin: 'tracked',
          analysis: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Fall back to demo data when nothing else is available.
  if (entries.length === 0 || options.demo) {
    for (const [repo, snapshot] of Object.entries(demoSnapshots)) {
      const analysis = await analyzeSnapshot(snapshot, { ai: { provider: 'heuristic' } });
      entries.push(entryFromAnalysis(repo, 'demo', analysis, threshold));

      const history = generateDemoHistory(snapshot);
      const trend = computeTrend(toHealthSeries(history), '30d');
      if (trend.direction !== 'flat' && Math.abs(trend.deltaPercent) >= 1) {
        alerts.push({
          repo,
          kind: trend.direction === 'up' ? 'up' : 'down',
          message: `health ${trend.direction === 'up' ? '+' : ''}${Math.round(
            trend.deltaPercent,
          )}% over the last 30 days`,
        });
      }
    }
  }

  // Warning-based alerts for every entry that carries an analysis.
  for (const entry of entries) {
    const warning = entry.analysis?.score.warnings[0];
    if (warning) {
      alerts.push({ repo: entry.repo, kind: 'warn', message: warning });
    }
    if (entry.error) {
      alerts.push({ repo: entry.repo, kind: 'warn', message: entry.error });
    }
  }

  const source: DashboardData['source'] = entries.some((e) => e.origin !== 'demo')
    ? 'live'
    : 'demo';

  return { entries, alerts: alerts.slice(0, 8), threshold, source };
}

const HEADER = [
  '██████╗ ███████╗ █████╗  ██████╗ ██████╗ ███╗   ██╗',
  '██╔══██╗██╔════╝██╔══██╗██╔════╝██╔═══██╗████╗  ██║',
  '██████╔╝█████╗  ███████║██║     ██║   ██║██╔██╗ ██║',
  '██╔══██╗██╔══╝  ██╔══██║██║     ██║   ██║██║╚██╗██║',
  '██████╔╝███████╗██║  ██║╚██████╗╚██████╔╝██║ ╚████║',
  '╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝',
];

function alertIcon(kind: Alert['kind']): string {
  switch (kind) {
    case 'up':
      return '▲';
    case 'down':
      return '▼';
    case 'warn':
      return '⚠';
  }
}

function paintAlert(palette: Palette, kind: Alert['kind'], text: string): string {
  switch (kind) {
    case 'up':
      return palette.green(text);
    case 'down':
      return palette.red(text);
    case 'warn':
      return palette.yellow(text);
  }
}

export interface RenderDashboardOptions {
  color: boolean;
  /** Index of the highlighted row (interactive mode). */
  selected?: number;
  /** Whether the selected row is expanded (interactive mode). */
  expanded?: boolean;
  /** Show the interactive key hints. */
  interactive?: boolean;
}

/** Render the dashboard to a string (used for both static and interactive). */
export function renderDashboard(data: DashboardData, options: RenderDashboardOptions): string {
  const palette = createPalette(options.color);
  const lines: string[] = [];

  lines.push('');
  for (const row of HEADER) {
    lines.push(`  ${palette.cyan(row)}`);
  }
  lines.push('');
  const subtitle = `Repository health dashboard${data.source === 'demo' ? ' (demo data)' : ''}`;
  lines.push(`  ${palette.dim(subtitle)}  ${palette.dim(`· threshold ${data.threshold}`)}`);
  lines.push('');

  const nameWidth = Math.min(40, Math.max(12, ...data.entries.map((e) => e.repo.length)));

  lines.push(`  ${palette.bold('Repositories')}`);
  data.entries.forEach((entry, index) => {
    const selected = options.interactive && options.selected === index;
    const pointer = selected ? palette.cyan('›') : ' ';
    const icon = paintStatus(palette, entry.status, statusIcon(entry.status));
    const name = entry.repo.padEnd(nameWidth, ' ');
    const scoreText =
      entry.score === null
        ? palette.red('  —  ')
        : paintStatus(palette, entry.status, `${entry.score}`.padStart(3, ' ') + '/100');
    const grade = entry.grade ? palette.dim(entry.grade) : palette.red('unavailable');
    const rowName = selected ? palette.bold(name) : name;
    lines.push(`  ${pointer} ${icon}  ${rowName}  ${scoreText}  ${grade}`);

    if (selected && options.expanded && entry.analysis) {
      for (const detail of expandEntry(entry.analysis, palette)) {
        lines.push(`        ${detail}`);
      }
    } else if (selected && options.expanded && entry.error) {
      lines.push(`        ${palette.red(entry.error)}`);
    }
  });
  lines.push('');

  lines.push(`  ${palette.bold('Recent Alerts')}`);
  if (data.alerts.length === 0) {
    lines.push(`  ${palette.dim('No alerts. All tracked repositories look healthy.')}`);
  } else {
    for (const alert of data.alerts) {
      const icon = paintAlert(palette, alert.kind, alertIcon(alert.kind));
      lines.push(`  ${icon} ${palette.bold(alert.repo)} ${palette.gray('·')} ${alert.message}`);
    }
  }
  lines.push('');

  if (options.interactive) {
    lines.push(`  ${palette.dim('↑/↓ move · enter expand · r refresh · q quit')}`);
    lines.push('');
  }

  return lines.join('\n');
}

/** Detail lines shown when a repository row is expanded. */
function expandEntry(analysis: BeaconAnalysis, palette: Palette): string[] {
  const { score, snapshot } = analysis;
  const details: string[] = [];
  details.push(`${palette.dim('Stars')} ${starRating(score.total)}`);
  for (const pillar of score.pillars) {
    const label = pillar.pillar.padEnd(13, ' ');
    details.push(`${palette.gray(label)} ${`${pillar.score}`.padStart(3, ' ')}/100`);
  }
  details.push(
    palette.dim(
      `${snapshot.contributors.length} contributors · ${snapshot.metadata.primaryLanguage ?? 'n/a'}`,
    ),
  );
  return details;
}

const CLEAR_SCREEN = '[2J[H';
const HIDE_CURSOR = '[?25l';
const SHOW_CURSOR = '[?25h';

/**
 * Run the dashboard. Interactive when stdout is a TTY; otherwise prints a
 * single static snapshot and returns. Always restores the terminal on exit.
 */
export async function runDashboard(options: DashboardOptions): Promise<void> {
  const out = process.stdout;
  const stdin = process.stdin;
  const interactive = Boolean(out.isTTY) && Boolean(stdin.isTTY) && !options.json;

  let data = await gatherDashboard(options);

  if (options.json) {
    out.write(
      `${JSON.stringify(
        {
          source: data.source,
          threshold: data.threshold,
          repositories: data.entries.map((e) => ({
            repo: e.repo,
            score: e.score,
            grade: e.grade,
            status: e.status,
          })),
          alerts: data.alerts,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (!interactive) {
    out.write(`${renderDashboard(data, { color: options.color, interactive: false })}\n`);
    return;
  }

  let selected = 0;
  let expanded = false;
  let running = true;

  const draw = (): void => {
    out.write(CLEAR_SCREEN);
    out.write(
      renderDashboard(data, {
        color: options.color,
        selected,
        expanded,
        interactive: true,
      }),
    );
  };

  const restore = (): void => {
    try {
      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }
    } catch {
      // Ignore — best effort.
    }
    stdin.pause();
    stdin.removeListener('data', onData);
    out.write(SHOW_CURSOR);
    out.write('\n');
  };

  const quit = (): void => {
    if (!running) {
      return;
    }
    running = false;
    restore();
  };

  const refresh = async (): Promise<void> => {
    data = await gatherDashboard(options);
    if (selected >= data.entries.length) {
      selected = Math.max(0, data.entries.length - 1);
    }
    draw();
  };

  function onData(chunk: Buffer): void {
    const key = chunk.toString('utf8');
    if (key === '' || key === 'q') {
      quit();
      return;
    }
    if (key === '[A' || key === 'k') {
      selected = Math.max(0, selected - 1);
      expanded = false;
      draw();
      return;
    }
    if (key === '[B' || key === 'j') {
      selected = Math.min(data.entries.length - 1, selected + 1);
      expanded = false;
      draw();
      return;
    }
    if (key === '\r' || key === '\n') {
      expanded = !expanded;
      draw();
      return;
    }
    if (key === 'r') {
      void refresh();
    }
  }

  out.write(HIDE_CURSOR);
  try {
    stdin.setRawMode(true);
  } catch {
    // If raw mode is unavailable, fall back to a static render.
    out.write(SHOW_CURSOR);
    out.write(`${renderDashboard(data, { color: options.color, interactive: false })}\n`);
    return;
  }
  stdin.resume();
  stdin.on('data', onData);
  draw();

  // Resolve when the user quits, so callers can await the dashboard.
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (!running) {
        clearInterval(timer);
        resolve();
      }
    }, 80);
    timer.unref?.();
  });
}
