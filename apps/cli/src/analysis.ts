/**
 * Shared analysis resolution for every `beacon` command.
 *
 * A single {@link resolveAnalysis} entrypoint turns a repository argument plus
 * flags into a {@link BeaconAnalysis}, choosing one of three sources:
 *
 *  - `--demo`  — score a bundled snapshot offline (no network, no account).
 *  - `--local` — analyze the current working directory from git + filesystem
 *    signals (see {@link analyzeLocal}); returns caveat notes.
 *  - otherwise — the {@link Beacon} SDK client (hosted API or direct GitHub).
 *
 * Keeping this in one place means `analyze`, `widget`, `badge`, and `watch` all
 * behave identically.
 */

import { analyzeSnapshot } from '@beacon/analytics';
import { demoSnapshots, type BeaconAnalysis } from '@beacon/shared';

import { resolveClient, type ResolvedConfig } from './config';
import { gitRemoteRepo } from './git';
import { analyzeLocal } from './local';

/** An expected, user-facing failure that should print cleanly (no stack). */
export class BeaconCliError extends Error {}

interface DemoInput {
  key: string;
  snapshot: (typeof demoSnapshots)[string];
}

/** Pick a demo snapshot by `owner/repo`, falling back to the first entry. */
export function resolveDemo(repository: string): DemoInput {
  const entries = Object.entries(demoSnapshots);
  const match = entries.find(([key]) => key.toLowerCase() === repository.toLowerCase());
  const chosen = match ?? entries[0];
  if (!chosen) {
    throw new BeaconCliError('No demo snapshots are available.');
  }
  return { key: chosen[0], snapshot: chosen[1] };
}

/** AI provider config shared by the SDK and the analytics engine. */
export interface AiConfig {
  provider?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
}

export interface ResolveAnalysisOptions {
  /** Use bundled demo data instead of calling GitHub. */
  demo?: boolean;
  /** Analyze the current directory offline, with no account. */
  local?: boolean;
  /** GitHub token override (falls back to config/env). */
  token?: string;
  /** Force a refresh when analyzing through the hosted API. */
  refresh?: boolean;
  /** Analysis source for the SDK: `auto` | `api` | `github`. */
  source?: 'auto' | 'api' | 'github';
  /** AI provider config. */
  ai?: AiConfig;
  /** The merged CLI config. */
  config: ResolvedConfig;
  /** Working directory (for `--local` and remote resolution). */
  cwd: string;
}

export interface ResolvedAnalysis {
  analysis: BeaconAnalysis;
  /** Human-readable caveats (populated for `--local`). */
  notes: string[];
}

/**
 * Resolve a repository argument into a {@link ResolvedAnalysis}, honouring
 * `--demo` (offline snapshot), `--local` (offline git/filesystem), and the SDK
 * otherwise. This is the single flow every command reuses so behaviour never
 * drifts between them.
 */
export async function resolveAnalysis(
  repository: string,
  options: ResolveAnalysisOptions,
): Promise<ResolvedAnalysis> {
  if (options.demo) {
    const demo = resolveDemo(repository);
    const analysis = await analyzeSnapshot(demo.snapshot, { ai: options.ai });
    return { analysis, notes: [] };
  }

  if (options.local) {
    const { analysis, notes } = await analyzeLocal({ cwd: options.cwd });
    return { analysis, notes };
  }

  const client = resolveClient(options.config, {
    githubToken: options.token,
    ai: options.ai,
  });
  const analysis = await client.analyze(repository, {
    refresh: options.refresh,
    source: options.source,
  });
  return { analysis, notes: [] };
}

/**
 * Determine which repository a command should act on when the argument is
 * optional: the explicit argument wins, then the project config's `repository`,
 * then the `origin` remote of the git repository in `cwd`.
 */
export function resolveRepository(
  explicit: string | undefined,
  config: ResolvedConfig,
  cwd: string,
): string {
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  if (config.project.repository) {
    return config.project.repository;
  }
  const remote = gitRemoteRepo(cwd);
  if (remote) {
    return `${remote.owner}/${remote.repo}`;
  }
  throw new BeaconCliError(
    'No repository specified. Pass "owner/repo", run inside a git repository ' +
      'with an origin remote, or set "repository" in .beacon/config.json.',
  );
}
