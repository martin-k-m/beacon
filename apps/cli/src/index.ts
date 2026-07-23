#!/usr/bin/env node
/**
 * `beacon` — a first-class terminal client for Beacon repository intelligence.
 *
 * Analyze any GitHub repository (remotely, or the current directory offline),
 * score it across five pillars, render embeddable widgets, generate shareable
 * reports, watch a repository over time, and browse an interactive dashboard —
 * all with `gh`/`vercel`-grade ergonomics.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

import { CommanderError, Command } from 'commander';
import pc from 'picocolors';

import { BeaconCliError, resolveAnalysis, resolveRepository, type AiConfig } from './analysis';
import { runLogin, runLogout, runWhoami } from './auth';
import { loadConfig, type ResolvedConfig } from './config';
import { runContributors } from './contributors';
import { runDashboard } from './dashboard';
import { runDependencies } from './dependencies';
import { gitRemoteRepo } from './git';
import { runHistory } from './history';
import { runInsights } from './insights';
import { colorEnabled, describeError, printNotes, writeError } from './output';
import { renderAnalysis, renderScoreLine } from './render';
import { renderReport, type ReportFormat } from './report';
import { createSpinner } from './spinner';
import { formatUnknownCommand } from './suggest';
import {
  buildBadge,
  buildWidget,
  formatEmbedSnippets,
  formatWatchLine,
  normalizeSize,
  normalizeTheme,
  PIXEL_FREE_NOTE,
  type BuiltWidget,
} from './widget';

type AiProvider = 'heuristic' | 'openai' | 'anthropic';

const DOCS_URL = 'https://github.com/martin-k-m/beacon/blob/main/docs/cli.md';

/** Every top-level command, for "did you mean" suggestions. */
const KNOWN_COMMANDS = [
  'analyze',
  'score',
  'insights',
  'contributors',
  'dependencies',
  'history',
  'widget',
  'badge',
  'watch',
  'report',
  'dashboard',
  'init',
  'login',
  'logout',
  'whoami',
] as const;

/** Read this package's version at runtime without breaking `rootDir`. */
function readVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const raw = readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function normalizeProvider(value: string): AiProvider {
  const provider = value.toLowerCase();
  if (provider === 'openai' || provider === 'anthropic' || provider === 'heuristic') {
    return provider;
  }
  throw new BeaconCliError(
    `Unknown --ai provider "${value}". Expected one of: heuristic, openai, anthropic.`,
  );
}

/** Build the AI config from the selected provider + environment keys. */
function buildAiConfig(provider: AiProvider): AiConfig {
  return {
    provider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}

function normalizeRange(value: string | undefined): '7d' | '30d' | '90d' | '1y' | 'all' {
  if (!value) {
    return '90d';
  }
  const range = value.toLowerCase();
  if (range === '7d' || range === '30d' || range === '90d' || range === '1y' || range === 'all') {
    return range;
  }
  throw new BeaconCliError(`Unknown --range "${value}". Expected one of: 7d, 30d, 90d, 1y, all.`);
}

function normalizeSource(value: string | undefined): 'auto' | 'api' | 'github' | undefined {
  if (!value) {
    return undefined;
  }
  const source = value.toLowerCase();
  if (source === 'auto' || source === 'api' || source === 'github') {
    return source;
  }
  throw new BeaconCliError(`Unknown --source "${value}". Expected one of: auto, api, github.`);
}

// ---------------------------------------------------------------------------
// analyze
// ---------------------------------------------------------------------------

interface AnalyzeCommandOptions {
  local?: boolean;
  refresh?: boolean;
  token?: string;
  json?: boolean;
  demo?: boolean;
  source?: string;
  ai: string;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

async function runAnalyze(
  repositoryArg: string | undefined,
  options: AnalyzeCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);
  const ai = buildAiConfig(normalizeProvider(options.ai));
  const source = normalizeSource(options.source);

  let repository: string;
  try {
    repository = options.local
      ? 'local'
      : options.demo
        ? (repositoryArg ?? '')
        : resolveRepository(repositoryArg, options.config, options.cwd);
  } catch (error) {
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(
    options.local
      ? 'Analyzing local repository…'
      : options.demo
        ? `Loading demo analysis…`
        : `Analyzing ${repository}…`,
  );

  let result;
  try {
    result = await resolveAnalysis(repository, {
      demo: options.demo,
      local: options.local,
      token: options.token,
      refresh: options.refresh,
      source,
      ai,
      config: options.config,
      cwd: options.cwd,
    });
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result.analysis, null, 2)}\n`);
    printNotes(result.notes, color);
    return;
  }

  process.stdout.write(renderAnalysis(result.analysis, { color }));
  printNotes(result.notes, color);
}

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

interface ScoreCommandOptions {
  local?: boolean;
  demo?: boolean;
  token?: string;
  json?: boolean;
  source?: string;
  refresh?: boolean;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

async function runScore(
  repositoryArg: string | undefined,
  options: ScoreCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);
  const source = normalizeSource(options.source);

  let repository: string;
  try {
    repository = options.local
      ? 'local'
      : options.demo
        ? (repositoryArg ?? '')
        : resolveRepository(repositoryArg, options.config, options.cwd);
  } catch (error) {
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(options.local ? 'Scoring local repository…' : `Scoring ${repository}…`);

  let result;
  try {
    result = await resolveAnalysis(repository, {
      demo: options.demo,
      local: options.local,
      token: options.token,
      refresh: options.refresh,
      source,
      ai: buildAiConfig('heuristic'),
      config: options.config,
      cwd: options.cwd,
    });
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  const { score } = result.analysis;
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ score: score.total, grade: score.grade })}\n`);
    return;
  }
  process.stdout.write(`${renderScoreLine(score.total, score.grade, { color })}\n`);
  printNotes(result.notes, color);
}

// ---------------------------------------------------------------------------
// widget & badge
// ---------------------------------------------------------------------------

interface WidgetCommandOptions {
  type: string;
  theme: string;
  size: string;
  out?: string;
  host?: string;
  token?: string;
  demo?: boolean;
  local?: boolean;
  json?: boolean;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

/** Write an SVG to disk and print a confirmation plus the pixel-free note. */
function writeSvg(out: string, built: BuiltWidget, color: boolean): void {
  writeFileSync(out, built.svg, 'utf8');
  process.stdout.write(`${color ? pc.green(`Wrote ${out}`) : `Wrote ${out}`}\n`);
  process.stdout.write(`${color ? pc.dim(PIXEL_FREE_NOTE) : PIXEL_FREE_NOTE}\n`);
  process.stdout.write('\n');
}

/** The embed host: the configured API URL, else the `--host` default. */
function embedHost(options: { host?: string; config: ResolvedConfig }): string {
  return options.config.apiUrl ?? options.host ?? 'https://beacon.example.com';
}

async function runWidget(
  repositoryArg: string | undefined,
  options: WidgetCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);
  const theme = normalizeTheme(options.theme);
  const size = normalizeSize(options.size);

  let repository: string;
  try {
    repository = options.local
      ? 'local'
      : options.demo
        ? (repositoryArg ?? '')
        : resolveRepository(repositoryArg, options.config, options.cwd);
  } catch (error) {
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(options.local ? 'Analyzing local repository…' : `Analyzing ${repository}…`);

  let built: BuiltWidget;
  let notes: string[] = [];
  try {
    const result = await resolveAnalysis(repository, {
      demo: options.demo,
      local: options.local,
      token: options.token,
      ai: buildAiConfig('heuristic'),
      config: options.config,
      cwd: options.cwd,
    });
    notes = result.notes;
    built = buildWidget(result.analysis, {
      type: options.type,
      host: embedHost(options),
      theme,
      size,
    });
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(built.snippets, null, 2)}\n`);
    return;
  }

  if (options.out) {
    writeSvg(options.out, built, color);
  }
  process.stdout.write(`${formatEmbedSnippets(built.snippets, { color })}\n`);
  printNotes(notes, color);
}

interface BadgeCommandOptions {
  theme: string;
  size: string;
  out?: string;
  host?: string;
  token?: string;
  demo?: boolean;
  local?: boolean;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

async function runBadge(
  repositoryArg: string | undefined,
  options: BadgeCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);
  const theme = normalizeTheme(options.theme);
  const size = normalizeSize(options.size);

  let repository: string;
  try {
    repository = options.local
      ? 'local'
      : options.demo
        ? (repositoryArg ?? '')
        : resolveRepository(repositoryArg, options.config, options.cwd);
  } catch (error) {
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(options.local ? 'Analyzing local repository…' : `Analyzing ${repository}…`);

  let built: BuiltWidget;
  try {
    const result = await resolveAnalysis(repository, {
      demo: options.demo,
      local: options.local,
      token: options.token,
      ai: buildAiConfig('heuristic'),
      config: options.config,
      cwd: options.cwd,
    });
    built = buildBadge(result.analysis, { host: embedHost(options), theme, size });
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.out) {
    writeSvg(options.out, built, color);
  }
  process.stdout.write(`${formatEmbedSnippets(built.snippets, { color, markdownOnly: true })}\n`);
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

interface ReportCommandOptions {
  json?: boolean;
  markdown?: boolean;
  html?: boolean;
  out?: string;
  local?: boolean;
  demo?: boolean;
  token?: string;
  source?: string;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

function reportFormat(options: ReportCommandOptions): ReportFormat {
  if (options.json) return 'json';
  if (options.html) return 'html';
  return 'markdown';
}

async function runReport(
  repositoryArg: string | undefined,
  options: ReportCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);
  const source = normalizeSource(options.source);
  const format = reportFormat(options);

  let repository: string;
  try {
    repository = options.local
      ? 'local'
      : options.demo
        ? (repositoryArg ?? '')
        : resolveRepository(repositoryArg, options.config, options.cwd);
  } catch (error) {
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(options.local ? 'Analyzing local repository…' : `Analyzing ${repository}…`);

  let result;
  try {
    result = await resolveAnalysis(repository, {
      demo: options.demo,
      local: options.local,
      token: options.token,
      source,
      ai: buildAiConfig('heuristic'),
      config: options.config,
      cwd: options.cwd,
    });
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  const document = renderReport(result.analysis, format);
  if (options.out) {
    writeFileSync(options.out, document.endsWith('\n') ? document : `${document}\n`, 'utf8');
    process.stdout.write(
      `${color ? pc.green(`Wrote ${options.out}`) : `Wrote ${options.out}`} (${format})\n`,
    );
  } else {
    process.stdout.write(`${document}\n`);
  }
  printNotes(result.notes, color);
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

interface InitCommandOptions {
  yes?: boolean;
  color: boolean;
  cwd: string;
}

function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

async function runInit(options: InitCommandOptions): Promise<void> {
  const color = colorEnabled(options.color);
  const dir = join(options.cwd, '.beacon');
  const configPath = join(dir, 'config.json');
  const historyPath = join(dir, 'history.json');

  if (existsSync(configPath) && !options.yes) {
    const overwrite = await confirm(`${configPath} already exists. Overwrite? [y/N] `);
    if (!overwrite) {
      process.stdout.write(`${color ? pc.dim('Aborted.') : 'Aborted.'}\n`);
      return;
    }
  }

  const remote = gitRemoteRepo(options.cwd);
  const repository = remote ? `${remote.owner}/${remote.repo}` : undefined;

  if (!options.yes) {
    const detail = repository
      ? `Create .beacon/config.json for ${repository}? [y/N] `
      : 'Create .beacon/config.json (no git remote detected)? [y/N] ';
    const ok = await confirm(detail);
    if (!ok) {
      process.stdout.write(`${color ? pc.dim('Aborted.') : 'Aborted.'}\n`);
      return;
    }
  }

  const projectConfig = {
    repository: repository ?? 'owner/repo',
    tracking: repository ? [repository] : [],
    widgets: ['health'],
    ignore: [],
    scoreThreshold: 70,
  };

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, `${JSON.stringify(projectConfig, null, 2)}\n`, 'utf8');
  writeFileSync(historyPath, `${JSON.stringify([], null, 2)}\n`, 'utf8');

  const check = color ? pc.green('✓') : '✓';
  process.stdout.write(`${check} Created ${configPath}\n`);
  process.stdout.write(`${check} Created ${historyPath}\n`);
  if (repository) {
    process.stdout.write(
      `${color ? pc.dim(`Detected repository: ${repository}`) : `Detected repository: ${repository}`}\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// watch
// ---------------------------------------------------------------------------

interface WatchCommandOptions {
  interval?: string;
  local?: boolean;
  token?: string;
  demo?: boolean;
  source?: string;
  ai: string;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

/** Minimum allowed poll interval, in seconds, to avoid hammering GitHub. */
const MIN_WATCH_INTERVAL = 15;

async function runWatch(
  repositoryArg: string | undefined,
  options: WatchCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);
  const ai = buildAiConfig(normalizeProvider(options.ai));
  const source = normalizeSource(options.source);

  let repository: string;
  try {
    repository = options.local
      ? 'local'
      : options.demo
        ? (repositoryArg ?? '')
        : resolveRepository(repositoryArg, options.config, options.cwd);
  } catch (error) {
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  const configuredInterval = options.config.project.watchInterval;
  const requested = options.interval
    ? Number.parseInt(options.interval, 10)
    : (configuredInterval ?? 300);
  const seconds = Number.isFinite(requested) ? Math.max(MIN_WATCH_INTERVAL, requested) : 300;

  let previous: number | null = null;

  const poll = async (): Promise<void> => {
    try {
      const result = await resolveAnalysis(repository, {
        demo: options.demo,
        local: options.local,
        token: options.token,
        source,
        ai,
        config: options.config,
        cwd: options.cwd,
      });
      const { analysis } = result;
      const score = analysis.score.total;
      process.stdout.write(
        `${formatWatchLine(analysis.snapshot.metadata.fullName, score, analysis.score.grade, previous, { color })}\n`,
      );
      previous = score;
    } catch (error) {
      writeError(describeError(error), color);
    }
  };

  const label = options.local ? 'the local repository' : repository;
  process.stdout.write(
    `${color ? pc.dim(`Watching ${label} every ${seconds}s — press Ctrl-C to stop.`) : `Watching ${label} every ${seconds}s — press Ctrl-C to stop.`}\n`,
  );

  const timer = setInterval(() => {
    void poll();
  }, seconds * 1000);

  const stop = (): void => {
    clearInterval(timer);
    process.stdout.write(`\n${color ? pc.dim('Stopped watching.') : 'Stopped watching.'}\n`);
    process.exit(0);
  };
  process.on('SIGINT', stop);

  await poll();
}

// ---------------------------------------------------------------------------
// program wiring
// ---------------------------------------------------------------------------

function buildProgram(): Command {
  const program = new Command();
  const cwd = process.cwd();
  const config = loadConfig(cwd);

  program
    .name('beacon')
    .description('Analyze the health of any GitHub repository from your terminal.')
    .version(readVersion(), '-v, --version', 'Print the beacon version.')
    .option('--no-color', 'Disable coloured output.')
    .showSuggestionAfterError(true)
    .addHelpText('after', `\nDocs: ${DOCS_URL}`);

  // Suppress commander's own "unknown command" line — we render a richer
  // "Did you mean …?" message ourselves from the caught error. Every other
  // diagnostic (unknown option, missing argument, …) passes through.
  program.configureOutput({
    writeErr: (str) => {
      if (/unknown command/i.test(str)) {
        return;
      }
      process.stderr.write(str);
    },
  });

  const globalColor = (): boolean => program.opts<{ color: boolean }>().color;

  // ---- analyze ------------------------------------------------------------
  program
    .command('analyze')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Analyze a repository and print a health report.')
    .option('--local', 'Analyze the current directory offline (no account).')
    .option('--refresh', 'Bypass any cached analysis (API mode).')
    .option('-t, --token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--json', 'Print the raw analysis as JSON.')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('--source <source>', 'Analysis source: auto | api | github.')
    .option('--ai <provider>', 'AI summary provider: heuristic | openai | anthropic.', 'heuristic')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runAnalyze(repository, {
        local: opts['local'] as boolean | undefined,
        refresh: opts['refresh'] as boolean | undefined,
        token: opts['token'] as string | undefined,
        json: opts['json'] as boolean | undefined,
        demo: opts['demo'] as boolean | undefined,
        source: opts['source'] as string | undefined,
        ai: (opts['ai'] as string | undefined) ?? 'heuristic',
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- score --------------------------------------------------------------
  program
    .command('score')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Print a compact Beacon Score and star rating.')
    .option('--local', 'Score the current directory offline (no account).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('-t, --token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--json', 'Print { score, grade } as JSON.')
    .option('--source <source>', 'Analysis source: auto | api | github.')
    .option('--refresh', 'Bypass any cached analysis (API mode).')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runScore(repository, {
        local: opts['local'] as boolean | undefined,
        demo: opts['demo'] as boolean | undefined,
        token: opts['token'] as string | undefined,
        json: opts['json'] as boolean | undefined,
        source: opts['source'] as string | undefined,
        refresh: opts['refresh'] as boolean | undefined,
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- insights -----------------------------------------------------------
  program
    .command('insights')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Show AI Advisor recommendations for a repository.')
    .option('--local', 'Analyze the current directory offline (no account).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('-t, --token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--ai <provider>', 'AI summary provider: heuristic | openai | anthropic.', 'heuristic')
    .option('--max <n>', 'Maximum number of issues to show.')
    .option('--json', 'Print the AdvisorReport as JSON.')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runInsights(repository, {
        local: opts['local'] as boolean | undefined,
        demo: opts['demo'] as boolean | undefined,
        token: opts['token'] as string | undefined,
        max: opts['max'] as string | undefined,
        json: opts['json'] as boolean | undefined,
        ai: buildAiConfig(normalizeProvider((opts['ai'] as string | undefined) ?? 'heuristic')),
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- contributors -------------------------------------------------------
  program
    .command('contributors')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Show contributor / team-health signals (bus factor, load).')
    .option('--local', 'Analyze the current directory offline (no account).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('-t, --token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--json', 'Print the ContributorHealth as JSON.')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runContributors(repository, {
        local: opts['local'] as boolean | undefined,
        demo: opts['demo'] as boolean | undefined,
        token: opts['token'] as string | undefined,
        json: opts['json'] as boolean | undefined,
        ai: buildAiConfig('heuristic'),
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- dependencies -------------------------------------------------------
  program
    .command('dependencies')
    .description("Analyze the current project's dependency manifests.")
    .option('--offline', 'Skip registry lookups (classify everything as unknown).')
    .option('--json', 'Print the DependencyReport as JSON.')
    .action(async (opts: Record<string, unknown>) => {
      await runDependencies({
        offline: opts['offline'] as boolean | undefined,
        json: opts['json'] as boolean | undefined,
        color: globalColor(),
        cwd,
      });
    });

  // ---- history ------------------------------------------------------------
  program
    .command('history')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Show a health / event timeline for a repository.')
    .option('--range <range>', 'Time range: 7d | 30d | 90d | 1y | all.', '90d')
    .option('--local', 'Build the timeline from the current directory offline.')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('-t, --token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--json', 'Print the timeline as JSON.')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runHistory(repository, {
        range: normalizeRange(opts['range'] as string | undefined),
        local: opts['local'] as boolean | undefined,
        demo: opts['demo'] as boolean | undefined,
        token: opts['token'] as string | undefined,
        json: opts['json'] as boolean | undefined,
        ai: buildAiConfig('heuristic'),
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- widget -------------------------------------------------------------
  program
    .command('widget')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .argument('[type]', 'Widget type: health | activity | language | contributor | release.')
    .description('Render an embeddable SVG widget and print embed snippets.')
    .option('-t, --type <type>', 'Widget type (overrides the positional type).')
    .option('--theme <theme>', 'Widget theme: dark | light | transparent.', 'dark')
    .option('--size <size>', 'Widget size: small | medium | large.', 'medium')
    .option('-o, --out <file>', 'Write the SVG to this file.')
    .option('--host <url>', 'Embed host for snippet URLs (defaults to the configured API URL).')
    .option('--token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('--local', 'Analyze the current directory offline (no account).')
    .option('--json', 'Print the embed snippets as JSON.')
    .action(
      async (
        repository: string | undefined,
        typeArg: string | undefined,
        opts: Record<string, unknown>,
      ) => {
        const type = (opts['type'] as string | undefined) ?? typeArg ?? 'health';
        await runWidget(repository, {
          type,
          theme: (opts['theme'] as string | undefined) ?? 'dark',
          size: (opts['size'] as string | undefined) ?? 'medium',
          out: opts['out'] as string | undefined,
          host: opts['host'] as string | undefined,
          token: opts['token'] as string | undefined,
          demo: opts['demo'] as boolean | undefined,
          local: opts['local'] as boolean | undefined,
          json: opts['json'] as boolean | undefined,
          color: globalColor(),
          cwd,
          config,
        });
      },
    );

  // ---- badge --------------------------------------------------------------
  program
    .command('badge')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Render the maintenance badge SVG and print its Markdown embed.')
    .option('--theme <theme>', 'Badge theme: dark | light | transparent.', 'dark')
    .option('--size <size>', 'Badge size: small | medium | large.', 'small')
    .option('-o, --out <file>', 'Write the SVG to this file.')
    .option('--host <url>', 'Embed host for snippet URLs (defaults to the configured API URL).')
    .option('--token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('--local', 'Analyze the current directory offline (no account).')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runBadge(repository, {
        theme: (opts['theme'] as string | undefined) ?? 'dark',
        size: (opts['size'] as string | undefined) ?? 'small',
        out: opts['out'] as string | undefined,
        host: opts['host'] as string | undefined,
        token: opts['token'] as string | undefined,
        demo: opts['demo'] as boolean | undefined,
        local: opts['local'] as boolean | undefined,
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- report -------------------------------------------------------------
  program
    .command('report')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Generate a full report (markdown, html, or json).')
    .option('--markdown', 'Markdown output (default).')
    .option('--html', 'Self-contained HTML page.')
    .option('--json', 'Raw JSON analysis.')
    .option('-o, --out <file>', 'Write the report to this file.')
    .option('--local', 'Analyze the current directory offline (no account).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('-t, --token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--source <source>', 'Analysis source: auto | api | github.')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runReport(repository, {
        json: opts['json'] as boolean | undefined,
        markdown: opts['markdown'] as boolean | undefined,
        html: opts['html'] as boolean | undefined,
        out: opts['out'] as string | undefined,
        local: opts['local'] as boolean | undefined,
        demo: opts['demo'] as boolean | undefined,
        token: opts['token'] as string | undefined,
        source: opts['source'] as string | undefined,
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- dashboard ----------------------------------------------------------
  program
    .command('dashboard')
    .description('Open the interactive repository health dashboard.')
    .option('--demo', 'Use bundled demo repositories.')
    .option('--json', 'Print a static snapshot as JSON.')
    .action(async (opts: Record<string, unknown>) => {
      await runDashboard({
        color: globalColor(),
        cwd,
        demo: opts['demo'] as boolean | undefined,
        json: opts['json'] as boolean | undefined,
      });
    });

  // ---- watch --------------------------------------------------------------
  program
    .command('watch')
    .argument('[repository]', 'Repository as "owner/repo". Defaults to the current repo.')
    .description('Poll a repository and print score changes until interrupted.')
    .option('-i, --interval <seconds>', 'Seconds between polls (min 15).')
    .option('--local', 'Analyze the current directory offline (no account).')
    .option('--token <token>', 'GitHub token (defaults to config / $GITHUB_TOKEN).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option('--source <source>', 'Analysis source: auto | api | github.')
    .option('--ai <provider>', 'AI summary provider: heuristic | openai | anthropic.', 'heuristic')
    .action(async (repository: string | undefined, opts: Record<string, unknown>) => {
      await runWatch(repository, {
        interval: opts['interval'] as string | undefined,
        local: opts['local'] as boolean | undefined,
        token: opts['token'] as string | undefined,
        demo: opts['demo'] as boolean | undefined,
        source: opts['source'] as string | undefined,
        ai: (opts['ai'] as string | undefined) ?? 'heuristic',
        color: globalColor(),
        cwd,
        config,
      });
    });

  // ---- login / logout / whoami -------------------------------------------
  program
    .command('login')
    .description('Sign in with GitHub (device flow) or a token.')
    .option('--with-token <token>', 'Store a GitHub Personal Access Token directly.')
    .action(async (opts: Record<string, unknown>) => {
      await runLogin({
        withToken: opts['withToken'] as string | undefined,
        color: globalColor(),
      });
    });

  program
    .command('logout')
    .description('Clear the stored credentials.')
    .action(() => {
      runLogout({ color: globalColor() });
    });

  program
    .command('whoami')
    .description('Print the currently logged-in user.')
    .option('--json', 'Print { login } as JSON.')
    .action((opts: Record<string, unknown>) => {
      runWhoami({ color: globalColor(), json: opts['json'] as boolean | undefined });
    });

  // ---- init ---------------------------------------------------------------
  program
    .command('init')
    .description('Scaffold .beacon/config.json in the current directory.')
    .option('-y, --yes', 'Skip the interactive confirmation.')
    .action(async (opts: Record<string, unknown>) => {
      await runInit({ yes: opts['yes'] as boolean | undefined, color: globalColor(), cwd });
    });

  return program;
}

/** Find the first non-option token an unknown-command error refers to. */
function firstOperand(argv: string[]): string {
  for (const token of argv.slice(2)) {
    if (!token.startsWith('-')) {
      return token;
    }
  }
  return '';
}

async function main(): Promise<void> {
  const program = buildProgram();
  program.exitOverride();
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (
        error.code === 'commander.help' ||
        error.code === 'commander.helpDisplayed' ||
        error.code === 'commander.version'
      ) {
        process.exit(0);
      }
      if (error.code === 'commander.unknownCommand') {
        const bad = firstOperand(process.argv);
        process.stderr.write(`${formatUnknownCommand(bad, KNOWN_COMMANDS)}\n\nDocs: ${DOCS_URL}\n`);
        process.exit(1);
      }
      // Commander already wrote a message for other error kinds.
      process.exit(error.exitCode || 1);
    }
    throw error;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${pc.red('✖')} ${describeError(error)}\n`);
  process.exit(1);
});
