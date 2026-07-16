import { type AIProviderConfig } from '@beacon/ai';
import { analyzeRepository, analyzeSnapshot } from '@beacon/analytics';
import { parseRepoIdentifier } from '@beacon/github';
import { demoSnapshots, type BeaconAnalysis } from '@beacon/shared';

import { cache } from './cache';
import { config } from './config';
import { getLatestAnalysis, saveAnalysis } from './store';

export interface GetAnalysisOptions {
  /** Bypass cache/store and force a fresh GitHub collection. */
  refresh?: boolean;
}

/** Build the AI provider configuration from environment config. */
function aiConfig(): AIProviderConfig {
  return {
    provider: config.aiProvider,
    openaiApiKey: config.openaiApiKey,
    anthropicApiKey: config.anthropicApiKey,
  };
}

function cacheKey(owner: string, repo: string): string {
  return `analysis:${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

/**
 * Resolve an analysis for a repository.
 *
 * Read path (refresh !== true): cache -> store -> live collection.
 * Write path (refresh === true, or a full miss): collect from GitHub, then
 * persist to the store and warm the cache.
 */
export async function getAnalysis(
  repo: string,
  options: GetAnalysisOptions = {},
): Promise<BeaconAnalysis> {
  // Normalize first so cache/store keys are canonical (and to fail fast on
  // malformed input before doing any I/O).
  const { owner, repo: name } = parseRepoIdentifier(repo);
  const key = cacheKey(owner, name);

  if (!options.refresh) {
    const cached = await cache.get<BeaconAnalysis>(key);
    if (cached) return cached;

    const stored = await getLatestAnalysis(owner, name);
    if (stored) {
      // Warm the cache so subsequent reads skip the DB round-trip.
      await cache.set(key, stored, config.cacheTtlSeconds);
      return stored;
    }
  }

  // Live collection + scoring + summary. May throw GitHubError (handled by the
  // route layer) on 404/403/etc.
  const analysis = await analyzeRepository(
    { owner, repo: name },
    { githubToken: config.githubToken, ai: aiConfig() },
  );

  // Persistence and cache warming are best-effort and must not fail the
  // request — the store already swallows its own errors; the cache never
  // throws.
  await saveAnalysis(analysis);
  await cache.set(key, analysis, config.cacheTtlSeconds);

  return analysis;
}

/**
 * Compute analyses for the built-in demo repositories. This path is fully
 * offline (no GitHub, no DB) and uses the deterministic heuristic provider, so
 * it works with zero configuration — it powers `GET /api/demo`.
 */
export async function getDemoAnalyses(): Promise<BeaconAnalysis[]> {
  const snapshots = Object.values(demoSnapshots);
  // analyzeSnapshot with no options defaults to the offline heuristic provider.
  return Promise.all(snapshots.map((snapshot) => analyzeSnapshot(snapshot)));
}
