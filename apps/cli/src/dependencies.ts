/**
 * `beacon dependencies` — analyze the current project's dependency manifests.
 *
 * Parses the local manifests ({@link parseManifests}: package.json,
 * requirements.txt, pyproject.toml, Cargo.toml) into {@link DependencyInput}s
 * and classifies each against its registry with {@link analyzeDependencies} —
 * online via {@link MultiRegistryClient}, or offline via
 * {@link OfflineRegistryClient} with `--offline`.
 *
 * This is a purely local command: it inspects the working directory, so it
 * needs no repository argument and no account.
 */

import {
  analyzeDependencies,
  MultiRegistryClient,
  OfflineRegistryClient,
  type DependencyReport,
  type DependencyStatus,
  type DependencyStatusResult,
} from '@beacon/dependency-engine';

import { parseManifests } from './deps';
import { colorEnabled, describeError, writeError } from './output';
import { createPalette, type Palette } from './render';
import { createSpinner } from './spinner';

export interface DependenciesCommandOptions {
  offline?: boolean;
  json?: boolean;
  color: boolean;
  cwd: string;
}

/** The status glyph + colour used in the rendered list. */
function statusGlyph(palette: Palette, status: DependencyStatus): string {
  switch (status) {
    case 'current':
      return palette.green('✓');
    case 'outdated':
      return palette.yellow('⚠');
    case 'unmaintained':
    case 'vulnerable':
      return palette.red('✗');
    case 'unknown':
      return palette.dim('?');
  }
}

function paintStatus(palette: Palette, status: DependencyStatus, text: string): string {
  switch (status) {
    case 'current':
      return palette.green(text);
    case 'outdated':
      return palette.yellow(text);
    case 'unmaintained':
    case 'vulnerable':
      return palette.red(text);
    case 'unknown':
      return palette.dim(text);
  }
}

/** Render a {@link DependencyReport} as a polished, printable string. */
export function renderDependencyReport(report: DependencyReport, color: boolean): string {
  const palette = createPalette(color);
  const lines: string[] = [];

  lines.push('');
  lines.push(palette.bold('Dependencies'));

  const nameWidth = Math.min(
    32,
    Math.max(10, ...report.dependencies.map((d) => d.name.length)),
  );

  for (const dep of report.dependencies) {
    lines.push(`  ${renderDependencyLine(dep, palette, nameWidth)}`);
  }
  lines.push('');

  // Counts summary: only surface non-zero buckets, in a stable order.
  const buckets: DependencyStatus[] = [
    'current',
    'outdated',
    'unmaintained',
    'vulnerable',
    'unknown',
  ];
  const parts = buckets
    .filter((status) => report.counts[status] > 0)
    .map((status) => paintStatus(palette, status, `${report.counts[status]} ${status}`));
  if (parts.length > 0) {
    lines.push(`  ${parts.join(palette.dim('  ·  '))}`);
  }
  lines.push(`  ${palette.dim(report.summary)}`);
  lines.push('');

  return lines.join('\n');
}

function renderDependencyLine(
  dep: DependencyStatusResult,
  palette: Palette,
  nameWidth: number,
): string {
  const glyph = statusGlyph(palette, dep.status);
  const name = dep.name.padEnd(nameWidth, ' ');
  const current = dep.currentVersion ?? '—';
  const latest = dep.latestVersion ?? '—';
  const versions = `${current} → ${latest}`;
  const status = paintStatus(palette, dep.status, `[${dep.status}]`);
  return `${glyph} ${palette.gray(name)}  ${palette.dim(versions)}  ${status}`;
}

async function runDependencies(options: DependenciesCommandOptions): Promise<void> {
  const color = colorEnabled(options.color);

  const { deps, found } = parseManifests(options.cwd);

  if (found.length === 0) {
    writeError(
      'No dependency manifests found (looked for package.json, requirements.txt, pyproject.toml, Cargo.toml).',
      color,
    );
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ dependencies: [], counts: {}, ecosystems: [], summary: 'No manifests found.' }, null, 2)}\n`);
    }
    process.exitCode = 1;
    return;
  }

  if (deps.length === 0) {
    // Manifests exist but declared no dependencies — say so honestly.
    const message = `Found ${found.join(', ')} but no declared dependencies.`;
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({ dependencies: [], counts: {}, ecosystems: [], summary: message }, null, 2)}\n`,
      );
      return;
    }
    process.stdout.write(`${color ? createPalette(true).dim(message) : message}\n`);
    return;
  }

  const registry = options.offline ? new OfflineRegistryClient() : new MultiRegistryClient();

  const spinner = createSpinner({ enabled: options.color && Boolean(process.stderr.isTTY) });
  spinner.start(
    options.offline
      ? `Inspecting ${deps.length} dependencies (offline)…`
      : `Looking up ${deps.length} dependencies…`,
  );

  let report: DependencyReport;
  try {
    report = await analyzeDependencies(deps, { registry });
  } catch (error) {
    spinner.stop();
    writeError(describeError(error), color);
    process.exitCode = 1;
    return;
  }

  spinner.stop();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderDependencyReport(report, color));
}

export { runDependencies };
