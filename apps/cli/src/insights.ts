/**
 * `beacon insights` — actionable AI Advisor output for a repository.
 *
 * Resolves an analysis (current repo / `owner/repo` / `--local` / `--demo`),
 * builds a health trend when history is available (demo mode synthesizes one),
 * and runs {@link generateAdvice} to produce a prioritized {@link AdvisorReport}:
 * a headline, a colour-coded list of issues with recommendations, and a summary.
 */

import { generateAdvice, type AdvisorReport, type AdvisorSeverity } from '@beacon/ai-advisor';
import {
  computeTrend,
  generateDemoHistory,
  toHealthSeries,
  type TrendResult,
} from '@beacon/analytics';

import {
  resolveAnalysis,
  resolveRepository,
  type AiConfig,
} from './analysis';
import type { ResolvedConfig } from './config';
import { colorEnabled, describeError, printNotes, writeError } from './output';
import { createPalette, type Palette } from './render';
import { createSpinner } from './spinner';

export interface InsightsCommandOptions {
  local?: boolean;
  demo?: boolean;
  token?: string;
  max?: string;
  json?: boolean;
  ai: AiConfig;
  color: boolean;
  cwd: string;
  config: ResolvedConfig;
}

/** Colour + label a severity as a compact chip, e.g. `HIGH`. */
function severityChip(palette: Palette, severity: AdvisorSeverity): string {
  const label = severity.toUpperCase().padEnd(6, ' ');
  switch (severity) {
    case 'high':
      return palette.red(label);
    case 'medium':
      return palette.yellow(label);
    case 'low':
      return palette.dim(label);
  }
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

/** Render an {@link AdvisorReport} as a polished, printable string. */
export function renderAdvice(report: AdvisorReport, color: boolean): string {
  const palette = createPalette(color);
  const width = 80;
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${palette.bold(report.headline)}`);
  lines.push(
    `  ${palette.dim(`Beacon Score ${report.score}/100 · ${report.grade}`)}`,
  );
  lines.push('');

  if (report.issues.length === 0) {
    lines.push(`  ${palette.green('✓')} No pressing issues found.`);
    lines.push('');
  } else {
    lines.push(palette.bold('Issues'));
    for (const issue of report.issues) {
      const chip = severityChip(palette, issue.severity);
      lines.push(`  ${chip} ${palette.bold(issue.title)}`);
      for (const wrapped of wrap(issue.detail, width - 4)) {
        lines.push(`    ${palette.gray(wrapped)}`);
      }
      for (const [index, wrapped] of wrap(issue.recommendation, width - 6).entries()) {
        const marker = index === 0 ? palette.cyan('→') : ' ';
        lines.push(`    ${marker} ${wrapped}`);
      }
      lines.push('');
    }
  }

  lines.push(palette.bold('Summary'));
  for (const wrapped of wrap(report.summary, width)) {
    lines.push(wrapped);
  }
  lines.push('');

  return lines.join('\n');
}

async function runInsights(
  repositoryArg: string | undefined,
  options: InsightsCommandOptions,
): Promise<void> {
  const color = colorEnabled(options.color);

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

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(
    options.local
      ? 'Advising on the local repository…'
      : options.demo
        ? 'Loading demo insights…'
        : `Advising on ${repository}…`,
  );

  let report: AdvisorReport;
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

    // A trend requires history. Demo mode synthesizes one; otherwise skip it.
    let trend: TrendResult | undefined;
    if (options.demo) {
      const history = generateDemoHistory(result.analysis.snapshot);
      trend = computeTrend(toHealthSeries(history), '90d');
    }

    const maxIssues = options.max ? Number.parseInt(options.max, 10) : undefined;
    report = await generateAdvice(
      { analysis: result.analysis, ...(trend ? { trend } : {}) },
      {
        ai: options.ai,
        ...(maxIssues !== undefined && Number.isFinite(maxIssues) ? { maxIssues } : {}),
      },
    );
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    printNotes(notes, color);
    return;
  }

  process.stdout.write(renderAdvice(report, color));
  printNotes(notes, color);
}

export { runInsights };
