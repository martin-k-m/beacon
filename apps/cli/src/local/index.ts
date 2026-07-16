/**
 * Offline, account-free repository analysis.
 *
 * `beacon analyze --local` builds a {@link RepositorySnapshot} from local git
 * and filesystem signals (see {@link COLLECTORS}), scores it with the same
 * {@link computeBeaconScore} engine the hosted product uses, and writes a
 * {@link HeuristicProvider} summary — all without a network call or an account.
 *
 * GitHub-only signals (stars, forks, watchers, open issues, issue/PR latency)
 * are unknowable locally; they are left at neutral defaults and reported in
 * {@link LocalAnalysisResult.notes} so the score is honestly weighted toward
 * activity, documentation, and security.
 */

import { computeBeaconScore } from '@beacon/analytics';
import { HeuristicProvider } from '@beacon/ai';
import type { BeaconAnalysis, RepositorySnapshot } from '@beacon/shared';

import { isGitRepo } from '../git';
import { COLLECTORS, type LocalContext } from './collectors';

export { COLLECTORS } from './collectors';
export type { Collector, LocalContext } from './collectors';
export { scanLanguages, languageForFile } from './languages';
export { detectManifests } from './manifests';

export interface LocalAnalyzeOptions {
  /** Repository root to analyze. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Extra directory/file names to skip during the walk. */
  ignore?: string[];
  /** Fixed clock (ms) for deterministic tests. Defaults to `Date.now()`. */
  now?: number;
}

export interface LocalAnalysisResult {
  analysis: BeaconAnalysis;
  /** Human-readable caveats about locally-unavailable signals. */
  notes: string[];
}

/** Build a snapshot with neutral defaults for every field. */
function seedSnapshot(now: number): RepositorySnapshot {
  const iso = new Date(now).toISOString();
  return {
    identifier: { owner: 'local', repo: 'repository' },
    metadata: {
      id: 0,
      owner: 'local',
      name: 'repository',
      fullName: 'local/repository',
      description: null,
      homepage: null,
      htmlUrl: '',
      defaultBranch: 'main',
      license: null,
      topics: [],
      isArchived: false,
      isFork: false,
      createdAt: iso,
      updatedAt: iso,
      pushedAt: iso,
      stars: 0,
      forks: 0,
      watchers: 0,
      openIssues: 0,
      primaryLanguage: null,
      sizeKb: 0,
    },
    languages: {},
    contributors: [],
    commitActivity: [],
    releases: [],
    issues: {
      open: 0,
      closed: 0,
      medianTimeToCloseHours: null,
      openedLast30Days: 0,
      closedLast30Days: 0,
    },
    pullRequests: {
      open: 0,
      merged: 0,
      closedWithoutMerge: 0,
      medianTimeToMergeHours: null,
      openedLast30Days: 0,
      mergedLast30Days: 0,
    },
    readme: {
      present: false,
      lengthBytes: 0,
      hasBadges: false,
      hasInstallSection: false,
      hasUsageSection: false,
      hasLicenseSection: false,
    },
    dependencies: [],
    security: {
      hasSecurityPolicy: false,
      hasDependabot: false,
      vulnerabilityAlertCount: null,
    },
    collectedAt: iso,
  };
}

/**
 * The standing note explaining which GitHub-only signals are unavailable in
 * local mode. Always included so `--local` output is never misread as complete.
 */
export const LOCAL_UNAVAILABLE_NOTE =
  'Offline mode: stars, forks, watchers, open issues, and issue/PR latency are ' +
  'unavailable without GitHub, so the Beacon Score is weighted toward local ' +
  'activity, documentation, and security signals.';

/**
 * Assemble a {@link RepositorySnapshot} for the repository at `cwd` from local
 * signals only, running the whole collector registry.
 */
export function buildLocalSnapshot(options: LocalAnalyzeOptions = {}): {
  snapshot: RepositorySnapshot;
  notes: string[];
} {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? Date.now();
  const ctx: LocalContext = { cwd, ignore: options.ignore ?? [], now };

  const snapshot = seedSnapshot(now);
  const notes: string[] = [];
  for (const collector of COLLECTORS) {
    try {
      const collectorNotes = collector.collect(ctx, snapshot);
      if (collectorNotes) {
        notes.push(...collectorNotes);
      }
    } catch {
      notes.push(`Collector "${collector.name}" failed and was skipped.`);
    }
  }
  return { snapshot, notes };
}

/**
 * Full offline analysis: build the snapshot, compute the Beacon Score, and
 * generate a heuristic summary. Throws when `cwd` is not a git repository so
 * the CLI can print a clear message.
 */
export async function analyzeLocal(
  options: LocalAnalyzeOptions = {},
): Promise<LocalAnalysisResult> {
  const cwd = options.cwd ?? process.cwd();
  if (!isGitRepo(cwd)) {
    throw new Error(
      `${cwd} is not a git repository. Local analysis reads git history — run it ` +
        'inside a repository, or analyze a remote with `beacon analyze owner/repo`.',
    );
  }

  const { snapshot, notes } = buildLocalSnapshot(options);
  const score = computeBeaconScore(snapshot);
  const summary = await new HeuristicProvider().generateSummary({ snapshot, score });

  return {
    analysis: { snapshot, score, summary },
    notes: [LOCAL_UNAVAILABLE_NOTE, ...notes],
  };
}
