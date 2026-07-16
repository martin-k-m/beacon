import { createAIProvider, type AIProvider, type AIProviderConfig } from './ai';
import { GitHubClient, parseRepoIdentifier } from './github/client';
import { computeBeaconScore } from './scoring/score';
import type { BeaconAnalysis, RepoIdentifier, RepositorySnapshot } from './types';

export interface AnalyzeOptions {
  githubToken?: string;
  githubBaseUrl?: string;
  ai?: AIProviderConfig;
  /** Inject a pre-built client (useful for testing). */
  client?: GitHubClient;
  /** Inject a pre-built AI provider (overrides `ai`). */
  aiProvider?: AIProvider;
  fetch?: typeof fetch;
}

/**
 * End-to-end analysis: collect a snapshot from GitHub, compute the Beacon
 * Score, and generate an AI summary. This is the single entrypoint shared by
 * the API service and the CLI.
 */
export async function analyzeRepository(
  input: string | RepoIdentifier,
  options: AnalyzeOptions = {},
): Promise<BeaconAnalysis> {
  const identifier: RepoIdentifier =
    typeof input === 'string' ? parseRepoIdentifier(input) : input;

  const client =
    options.client ??
    new GitHubClient({
      token: options.githubToken,
      baseUrl: options.githubBaseUrl,
      fetch: options.fetch,
    });

  const snapshot = await client.getSnapshot(identifier);
  return analyzeSnapshot(snapshot, options);
}

/**
 * Score and summarize an already-collected snapshot. Useful when the snapshot
 * comes from a cache or database rather than a live GitHub call.
 */
export async function analyzeSnapshot(
  snapshot: RepositorySnapshot,
  options: AnalyzeOptions = {},
): Promise<BeaconAnalysis> {
  const score = computeBeaconScore(snapshot);
  const provider = options.aiProvider ?? createAIProvider(options.ai);
  const summary = await provider.generateSummary({ snapshot, score });
  return { snapshot, score, summary };
}

export { computeBeaconScore } from './scoring/score';
