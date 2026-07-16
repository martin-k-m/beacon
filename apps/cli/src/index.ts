#!/usr/bin/env node
/**
 * `beacon` — analyze the health of any GitHub repository from your terminal.
 *
 * Thin command layer over {@link @beacon/core}: parse flags, collect (or mock)
 * a snapshot, compute the Beacon Score, and hand the result to the renderer.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  GitHubError,
  type AnalyzeOptions,
  type BeaconAnalysis,
} from '@beacon/core';
import { Command } from 'commander';
import pc from 'picocolors';

import { BeaconCliError, resolveAnalysis } from './analysis';
import { renderAnalysis } from './render';
import { createSpinner } from './spinner';
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

interface AnalyzeCommandOptions {
  token?: string;
  json?: boolean;
  demo?: boolean;
  ai: string;
  color: boolean;
}

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

/** Translate any thrown value into a friendly, single-line message. */
function describeError(error: unknown): string {
  if (error instanceof GitHubError) {
    if (error.status === 404) {
      return 'Repository not found. Check the owner/repo spelling, or pass --token for private repositories.';
    }
    if (error.status === 403 || error.status === 429) {
      return 'Rate limited by GitHub. Set GITHUB_TOKEN (or pass --token) to raise your limit.';
    }
    return `GitHub request failed (${error.status}): ${error.message}`;
  }
  if (error instanceof BeaconCliError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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

/** Build the core AI config from the selected provider + environment keys. */
function buildAiConfig(provider: AiProvider): AnalyzeOptions['ai'] {
  return {
    provider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}

async function runAnalyze(
  repository: string,
  options: AnalyzeCommandOptions,
): Promise<void> {
  const color = options.color && Boolean(process.stdout.isTTY);
  const provider = normalizeProvider(options.ai);
  const ai = buildAiConfig(provider);

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(
    options.demo
      ? `Loading demo analysis for ${repository}…`
      : `Analyzing ${repository}…`,
  );

  let analysis: BeaconAnalysis;
  try {
    analysis = await resolveAnalysis(repository, {
      demo: options.demo,
      token: options.token,
      ai,
    });
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${color ? pc.red('✖') : '✖'} ${describeError(error)}\n`);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderAnalysis(analysis, { color }));
}

interface WidgetCommandOptions {
  type: string;
  theme: string;
  size: string;
  out?: string;
  host: string;
  token?: string;
  demo?: boolean;
  color: boolean;
}

interface BadgeCommandOptions {
  theme: string;
  size: string;
  out?: string;
  host: string;
  token?: string;
  demo?: boolean;
  color: boolean;
}

interface WatchCommandOptions {
  interval: string;
  token?: string;
  demo?: boolean;
  ai: string;
  color: boolean;
}

/** Write an SVG to disk and print a confirmation plus the pixel-free note. */
function writeSvg(out: string, built: BuiltWidget, color: boolean): void {
  writeFileSync(out, built.svg, 'utf8');
  process.stdout.write(`${color ? pc.green(`Wrote ${out}`) : `Wrote ${out}`}\n`);
  process.stdout.write(`${color ? pc.dim(PIXEL_FREE_NOTE) : PIXEL_FREE_NOTE}\n`);
  process.stdout.write('\n');
}

async function runWidget(
  repository: string,
  options: WidgetCommandOptions,
): Promise<void> {
  const color = options.color && Boolean(process.stdout.isTTY);
  const theme = normalizeTheme(options.theme);
  const size = normalizeSize(options.size);

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(
    options.demo
      ? `Loading demo analysis for ${repository}…`
      : `Analyzing ${repository}…`,
  );

  let built: BuiltWidget;
  try {
    const analysis = await resolveAnalysis(repository, {
      demo: options.demo,
      token: options.token,
      ai: buildAiConfig('heuristic'),
    });
    built = buildWidget(analysis, { type: options.type, host: options.host, theme, size });
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${color ? pc.red('✖') : '✖'} ${describeError(error)}\n`);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.out) {
    writeSvg(options.out, built, color);
  }
  process.stdout.write(`${formatEmbedSnippets(built.snippets, { color })}\n`);
}

async function runBadge(
  repository: string,
  options: BadgeCommandOptions,
): Promise<void> {
  const color = options.color && Boolean(process.stdout.isTTY);
  const theme = normalizeTheme(options.theme);
  const size = normalizeSize(options.size);

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(
    options.demo
      ? `Loading demo analysis for ${repository}…`
      : `Analyzing ${repository}…`,
  );

  let built: BuiltWidget;
  try {
    const analysis = await resolveAnalysis(repository, {
      demo: options.demo,
      token: options.token,
      ai: buildAiConfig('heuristic'),
    });
    built = buildBadge(analysis, { host: options.host, theme, size });
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${color ? pc.red('✖') : '✖'} ${describeError(error)}\n`);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.out) {
    writeSvg(options.out, built, color);
  }
  process.stdout.write(`${formatEmbedSnippets(built.snippets, { color, markdownOnly: true })}\n`);
}

/** Minimum allowed poll interval, in seconds, to avoid hammering GitHub. */
const MIN_WATCH_INTERVAL = 15;

async function runWatch(
  repository: string,
  options: WatchCommandOptions,
): Promise<void> {
  const color = options.color && Boolean(process.stdout.isTTY);
  const provider = normalizeProvider(options.ai);
  const ai = buildAiConfig(provider);

  const requested = Number.parseInt(options.interval, 10);
  const seconds = Number.isFinite(requested)
    ? Math.max(MIN_WATCH_INTERVAL, requested)
    : 300;

  let previous: number | null = null;

  const poll = async (): Promise<void> => {
    try {
      const analysis = await resolveAnalysis(repository, {
        demo: options.demo,
        token: options.token,
        ai,
      });
      const score = analysis.score.total;
      process.stdout.write(
        `${formatWatchLine(analysis.snapshot.metadata.fullName, score, analysis.score.grade, previous, { color })}\n`,
      );
      previous = score;
    } catch (error) {
      process.stderr.write(`${color ? pc.red('✖') : '✖'} ${describeError(error)}\n`);
    }
  };

  process.stdout.write(
    `${color ? pc.dim(`Watching ${repository} every ${seconds}s — press Ctrl-C to stop.`) : `Watching ${repository} every ${seconds}s — press Ctrl-C to stop.`}\n`,
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

  // Run one poll immediately so the user sees output without waiting.
  await poll();
}

function buildProgram(): Command {
  const program = new Command();

  program
    .name('beacon')
    .description('Analyze the health of any GitHub repository from your terminal.')
    .version(readVersion(), '-v, --version', 'Print the beacon version.')
    .option('--no-color', 'Disable coloured output.');

  program
    .command('analyze')
    .argument('<repository>', 'Repository to analyze, as "owner/repo".')
    .description('Analyze a GitHub repository and print a health report.')
    .option('-t, --token <token>', 'GitHub token (defaults to $GITHUB_TOKEN).')
    .option('--json', 'Print the raw analysis as JSON.')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option(
      '--ai <provider>',
      'AI summary provider: heuristic | openai | anthropic.',
      'heuristic',
    )
    .action(async (repository: string, commandOptions: Record<string, unknown>) => {
      // `--no-color` lives on the root program; merge it into the command opts.
      const globalOptions = program.opts<{ color: boolean }>();
      await runAnalyze(repository, {
        token: commandOptions['token'] as string | undefined,
        json: commandOptions['json'] as boolean | undefined,
        demo: commandOptions['demo'] as boolean | undefined,
        ai: (commandOptions['ai'] as string | undefined) ?? 'heuristic',
        color: globalOptions.color,
      });
    });

  program
    .command('widget')
    .argument('<repository>', 'Repository to render, as "owner/repo".')
    .description('Render an embeddable SVG widget and print embed snippets.')
    .option(
      '-t, --type <type>',
      'Widget type: health | activity | language | contributor | release.',
      'health',
    )
    .option('--theme <theme>', 'Widget theme: dark | light | transparent.', 'dark')
    .option('--size <size>', 'Widget size: small | medium | large.', 'medium')
    .option('-o, --out <file>', 'Write the SVG to this file.')
    .option('--host <url>', 'Embed host for snippet URLs.', 'https://beacon.example.com')
    .option('--token <token>', 'GitHub token (defaults to $GITHUB_TOKEN).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .action(async (repository: string, commandOptions: Record<string, unknown>) => {
      const globalOptions = program.opts<{ color: boolean }>();
      await runWidget(repository, {
        type: (commandOptions['type'] as string | undefined) ?? 'health',
        theme: (commandOptions['theme'] as string | undefined) ?? 'dark',
        size: (commandOptions['size'] as string | undefined) ?? 'medium',
        out: commandOptions['out'] as string | undefined,
        host: (commandOptions['host'] as string | undefined) ?? 'https://beacon.example.com',
        token: commandOptions['token'] as string | undefined,
        demo: commandOptions['demo'] as boolean | undefined,
        color: globalOptions.color,
      });
    });

  program
    .command('badge')
    .argument('<repository>', 'Repository to render, as "owner/repo".')
    .description('Render the maintenance badge SVG and print its Markdown embed.')
    .option('--theme <theme>', 'Badge theme: dark | light | transparent.', 'dark')
    .option('--size <size>', 'Badge size: small | medium | large.', 'small')
    .option('-o, --out <file>', 'Write the SVG to this file.')
    .option('--host <url>', 'Embed host for snippet URLs.', 'https://beacon.example.com')
    .option('--token <token>', 'GitHub token (defaults to $GITHUB_TOKEN).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .action(async (repository: string, commandOptions: Record<string, unknown>) => {
      const globalOptions = program.opts<{ color: boolean }>();
      await runBadge(repository, {
        theme: (commandOptions['theme'] as string | undefined) ?? 'dark',
        size: (commandOptions['size'] as string | undefined) ?? 'small',
        out: commandOptions['out'] as string | undefined,
        host: (commandOptions['host'] as string | undefined) ?? 'https://beacon.example.com',
        token: commandOptions['token'] as string | undefined,
        demo: commandOptions['demo'] as boolean | undefined,
        color: globalOptions.color,
      });
    });

  program
    .command('watch')
    .argument('<repository>', 'Repository to watch, as "owner/repo".')
    .description('Poll a repository and print score changes until interrupted.')
    .option('-i, --interval <seconds>', 'Seconds between polls (min 15).', '300')
    .option('--token <token>', 'GitHub token (defaults to $GITHUB_TOKEN).')
    .option('--demo', 'Use bundled demo data instead of calling GitHub.')
    .option(
      '--ai <provider>',
      'AI summary provider: heuristic | openai | anthropic.',
      'heuristic',
    )
    .action(async (repository: string, commandOptions: Record<string, unknown>) => {
      const globalOptions = program.opts<{ color: boolean }>();
      await runWatch(repository, {
        interval: (commandOptions['interval'] as string | undefined) ?? '300',
        token: commandOptions['token'] as string | undefined,
        demo: commandOptions['demo'] as boolean | undefined,
        ai: (commandOptions['ai'] as string | undefined) ?? 'heuristic',
        color: globalOptions.color,
      });
    });

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${pc.red('✖')} ${describeError(error)}\n`);
  process.exit(1);
});
