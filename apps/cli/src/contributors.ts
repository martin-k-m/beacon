/**
 * `beacon contributors` — the bus-factor / maintainer-load view.
 *
 * Resolves an analysis and runs {@link computeContributorHealth} to show how
 * many people carry the project and how concentrated the work is: active
 * contributors, bus factor, maintainer load, a distribution bar list, and a
 * natural-language narrative.
 */

import { computeContributorHealth, type ContributorHealth } from '@beacon/analytics';

import { resolveAnalysis, resolveRepository, type AiConfig } from './analysis';
import type { ResolvedConfig } from './config';
import { colorEnabled, describeError, printNotes, writeError } from './output';
import { createPalette, shareBar, type Palette } from './render';
import { createSpinner } from './spinner';

export interface ContributorsCommandOptions {
  local?: boolean;
  demo?: boolean;
  token?: string;
  json?: boolean;
  ai: AiConfig;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

/** Colour the bus factor: 1 is fragile (red), 2–3 moderate (yellow), 4+ good. */
function busFactorColor(palette: Palette, busFactor: number): (t: string) => string {
  if (busFactor >= 4) {
    return palette.green;
  }
  if (busFactor >= 2) {
    return palette.yellow;
  }
  return palette.red;
}

/** Render {@link ContributorHealth} as a polished, printable string. */
export function renderContributorHealth(
  health: ContributorHealth,
  fullName: string,
  color: boolean,
): string {
  const palette = createPalette(color);
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${palette.bold(palette.cyan(fullName))}`);
  lines.push('');

  const paintBus = busFactorColor(palette, health.busFactor);
  const loadPct = Math.round(health.maintainerLoad * 100);
  lines.push(
    `  ${palette.gray('Active contributors')}  ${palette.bold(`${health.activeContributors}`)} ${palette.dim(
      `of ${health.totalContributors}`,
    )}`,
  );
  lines.push(
    `  ${palette.gray('Bus factor')}           ${paintBus(palette.bold(`${health.busFactor}`))}`,
  );
  lines.push(`  ${palette.gray('Maintainer load')}      ${palette.bold(`${loadPct}%`)}`);
  lines.push('');

  if (health.distribution.length > 0) {
    lines.push(palette.bold('Distribution'));
    const nameWidth = Math.min(24, Math.max(8, ...health.distribution.map((d) => d.login.length)));
    for (const entry of health.distribution) {
      const login = entry.login.padEnd(nameWidth, ' ');
      const pct = `${Math.round(entry.share * 100)}%`.padStart(4, ' ');
      lines.push(
        `  ${palette.gray(login)}  ${palette.cyan(shareBar(entry.share, 16))}  ${palette.bold(pct)}`,
      );
    }
    lines.push('');
  }

  lines.push(palette.dim(health.narrative));
  lines.push('');

  return lines.join('\n');
}

async function runContributors(
  repositoryArg: string | undefined,
  options: ContributorsCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);

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

  let health: ContributorHealth;
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
    health = computeContributorHealth(result.analysis.snapshot);
    fullName = result.analysis.snapshot.metadata.fullName;
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(health, null, 2)}\n`);
    printNotes(notes, color);
    return;
  }

  process.stdout.write(renderContributorHealth(health, fullName, color));
  printNotes(notes, color);
}

export { runContributors };
