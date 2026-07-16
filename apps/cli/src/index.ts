#!/usr/bin/env node
/**
 * `beacon` — analyze the health of any GitHub repository from your terminal.
 *
 * Thin command layer over {@link @beacon/core}: parse flags, collect (or mock)
 * a snapshot, compute the Beacon Score, and hand the result to the renderer.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  analyzeRepository,
  analyzeSnapshot,
  GitHubError,
  demoSnapshots,
  type AnalyzeOptions,
  type BeaconAnalysis,
} from '@beacon/core';
import { Command } from 'commander';
import pc from 'picocolors';

import { renderAnalysis } from './render';
import { createSpinner } from './spinner';

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

/** Pick a demo snapshot by `owner/repo`, falling back to the first entry. */
function resolveDemo(repository: string): BeaconAnalysisInput {
  const entries = Object.entries(demoSnapshots);
  const match = entries.find(([key]) => key.toLowerCase() === repository.toLowerCase());
  const chosen = match ?? entries[0];
  if (!chosen) {
    throw new BeaconCliError('No demo snapshots are available.');
  }
  return { key: chosen[0], snapshot: chosen[1] };
}

interface BeaconAnalysisInput {
  key: string;
  snapshot: (typeof demoSnapshots)[string];
}

/** An expected, user-facing failure that should print cleanly (no stack). */
class BeaconCliError extends Error {}

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
    if (options.demo) {
      const demo = resolveDemo(repository);
      analysis = await analyzeSnapshot(demo.snapshot, { ai });
    } else {
      const token = options.token ?? process.env.GITHUB_TOKEN;
      analysis = await analyzeRepository(repository, { githubToken: token, ai });
    }
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
