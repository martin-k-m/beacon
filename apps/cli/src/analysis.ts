/**
 * Shared analysis resolution for every `beacon` command.
 *
 * A single {@link resolveAnalysis} entrypoint turns a repository argument plus
 * flags into a {@link BeaconAnalysis}, either by calling GitHub or — with
 * `--demo` — by scoring a bundled snapshot offline. Keeping this in one place
 * means `analyze`, `widget`, `badge`, and `watch` all behave identically.
 */

import {
  analyzeRepository,
  analyzeSnapshot,
  type AnalyzeOptions,
} from '@beacon/analytics';
import { demoSnapshots, type BeaconAnalysis } from '@beacon/shared';

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

export interface ResolveAnalysisOptions {
  /** Use bundled demo data instead of calling GitHub. */
  demo?: boolean;
  /** GitHub token (falls back to `$GITHUB_TOKEN`). */
  token?: string;
  /** AI provider config passed straight through to the analyzer. */
  ai?: AnalyzeOptions['ai'];
}

/**
 * Resolve a repository argument into a {@link BeaconAnalysis}, honouring
 * `--demo` (offline) and token/AI options. This is the single flow every
 * command reuses so behaviour never drifts between them.
 */
export async function resolveAnalysis(
  repository: string,
  options: ResolveAnalysisOptions,
): Promise<BeaconAnalysis> {
  if (options.demo) {
    const demo = resolveDemo(repository);
    return analyzeSnapshot(demo.snapshot, { ai: options.ai });
  }
  const token = options.token ?? process.env.GITHUB_TOKEN;
  return analyzeRepository(repository, { githubToken: token, ai: options.ai });
}
