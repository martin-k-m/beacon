import type { RepositorySnapshot } from '@beacon/shared';

/** One contributor's share of the total contribution volume. */
export interface ContributorShare {
  login: string;
  contributions: number;
  /** Fraction of all contributions owned by this contributor (0..1). */
  share: number;
}

/**
 * Contributor and team-health signals derived from a snapshot's contributor
 * list. Answers "how many people carry this project, and how concentrated is
 * the work?" — the bus-factor / maintainer-load view.
 */
export interface ContributorHealth {
  totalContributors: number;
  /** Contributors carrying meaningful load (>=1% of contributions), capped sensibly. */
  activeContributors: number;
  /** Min number of top contributors whose cumulative contributions exceed 50% of the total. */
  busFactor: number;
  /** Top contributor's share of all contributions (0..1). */
  maintainerLoad: number;
  /** Top contributors and their share (for a "review distribution" view). */
  distribution: ContributorShare[];
  /** Natural-language read on how work is distributed across the team. */
  narrative: string;
}

/** Default number of contributors surfaced in the distribution view. */
const DEFAULT_TOP_N = 8;

function round(value: number): number {
  return Math.round(value);
}

/**
 * Compute contributor / team-health signals for a snapshot. Pure and
 * deterministic: the same snapshot always yields the same result.
 *
 * @param snapshot A collected {@link RepositorySnapshot}.
 * @param topN     How many contributors to include in `distribution`
 *                 (default {@link DEFAULT_TOP_N}).
 */
export function computeContributorHealth(
  snapshot: RepositorySnapshot,
  topN: number = DEFAULT_TOP_N,
): ContributorHealth {
  // Re-sort defensively; the snapshot contract says desc by contributions,
  // but we never want the bus factor to depend on that holding.
  const sorted = [...snapshot.contributors].sort(
    (a, b) => b.contributions - a.contributions,
  );

  const totalContributors = sorted.length;
  const totalContributions = sorted.reduce((sum, c) => sum + c.contributions, 0);

  if (totalContributors === 0 || totalContributions <= 0) {
    return {
      totalContributors,
      activeContributors: 0,
      busFactor: 0,
      maintainerLoad: 0,
      distribution: [],
      narrative: 'No contributor data available.',
    };
  }

  // Bus factor: fewest top contributors whose cumulative share exceeds 50%.
  let cumulative = 0;
  let busFactor = 0;
  for (const contributor of sorted) {
    cumulative += contributor.contributions;
    busFactor += 1;
    if (cumulative / totalContributions > 0.5) break;
  }

  // Maintainer load: the top contributor's share of everything.
  const topContributor = sorted[0];
  const maintainerLoad = topContributor
    ? topContributor.contributions / totalContributions
    : 0;

  // Active contributors: those carrying at least 1% of the load. Guarantee at
  // least one whenever there is any contribution at all.
  const active = sorted.filter(
    (c) => c.contributions / totalContributions >= 0.01,
  ).length;
  const activeContributors = Math.max(1, active);

  // Distribution: the top N contributors with their fractional share.
  const cappedTopN = Math.max(0, Math.floor(topN));
  const distribution: ContributorShare[] = sorted
    .slice(0, cappedTopN)
    .map((c) => ({
      login: c.login,
      contributions: c.contributions,
      share: c.contributions / totalContributions,
    }));

  const narrative = buildNarrative(totalContributors, busFactor, maintainerLoad);

  return {
    totalContributors,
    activeContributors,
    busFactor,
    maintainerLoad,
    distribution,
    narrative,
  };
}

function buildNarrative(
  totalContributors: number,
  busFactor: number,
  maintainerLoad: number,
): string {
  const people = `${totalContributors} contributor${totalContributors === 1 ? '' : 's'}`;
  const head = `${people}, bus factor ${busFactor}.`;

  if (busFactor >= 4 && maintainerLoad < 0.5) {
    return `${head} Work is well distributed across the team.`;
  }
  if (busFactor <= 2 || maintainerLoad > 0.6) {
    const load = round(maintainerLoad * 100);
    return `${head} Work is concentrated on one maintainer (${load}% of contributions).`;
  }
  return `${head} Contribution load is moderately shared.`;
}
