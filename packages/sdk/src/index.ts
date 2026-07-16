/**
 * @beacon/sdk — a programmatic client for Beacon repository intelligence.
 *
 * Analyze any GitHub repository from code, either through a running Beacon API
 * service or directly from GitHub in-process:
 *
 * ```ts
 * import { Beacon } from '@beacon/sdk';
 *
 * const beacon = new Beacon({ githubToken: process.env.GITHUB_TOKEN });
 * const analysis = await beacon.analyze('owner/project');
 * console.log(analysis.score.total, analysis.score.grade);
 * ```
 */
import type { BeaconAnalysis } from '@beacon/shared';

import { Beacon, type AnalyzeOptions, type BeaconClientOptions } from './client';

export {
  Beacon,
  type AnalyzeOptions,
  type AnalyzeSource,
  type BeaconClientOptions,
  type TrendResponse,
  type TrendRange,
  type WidgetType,
} from './client';

/** The published version of the Beacon SDK. */
export const BEACON_SDK_VERSION = '0.1.0';

function readEnv(name: string): string | undefined {
  const value = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return value && value.length > 0 ? value : undefined;
}

/**
 * Convenience one-shot analysis: `analyze('facebook/react')`.
 *
 * Configuration falls back to environment variables when not passed explicitly:
 * `BEACON_API_URL`, `BEACON_TOKEN`, and `GITHUB_TOKEN`.
 */
export function analyze(
  repo: string,
  options: AnalyzeOptions & BeaconClientOptions = {},
): Promise<BeaconAnalysis> {
  const clientOptions: BeaconClientOptions = {
    apiUrl: options.apiUrl ?? readEnv('BEACON_API_URL'),
    token: options.token ?? readEnv('BEACON_TOKEN'),
    githubToken: options.githubToken ?? readEnv('GITHUB_TOKEN'),
    ai: options.ai,
    fetch: options.fetch,
  };
  const analyzeOptions: AnalyzeOptions = {
    refresh: options.refresh,
    source: options.source,
  };
  return new Beacon(clientOptions).analyze(repo, analyzeOptions);
}
