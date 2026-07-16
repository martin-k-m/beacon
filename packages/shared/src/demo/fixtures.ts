import type {
  CommitActivityWeek,
  ContributorStat,
  ReleaseInfo,
  RepositorySnapshot,
} from '../types';

/**
 * Deterministic demo data. Every value is synthetic and clearly attributable
 * to a fictional repository, so it can be shown in the UI and used in tests
 * without implying real GitHub metrics. Dates are generated relative to a
 * fixed reference so snapshots are stable across runs.
 */

const REFERENCE = Date.parse('2026-07-01T00:00:00.000Z');
const WEEK = 1000 * 60 * 60 * 24 * 7;

function daysAgo(days: number, from = REFERENCE): string {
  return new Date(from - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Seeded pseudo-random generator for reproducible commit histograms. */
function seeded(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function commitHistory(seed: number, base: number, trend: number): CommitActivityWeek[] {
  const rand = seeded(seed);
  const weeks: CommitActivityWeek[] = [];
  for (let i = 51; i >= 0; i--) {
    const weekStart = Math.floor((REFERENCE - i * WEEK) / 1000);
    const drift = (52 - i) * trend;
    const noise = rand() * base * 0.8;
    weeks.push({ weekStart, total: Math.max(0, Math.round(base + drift + noise)) });
  }
  return weeks;
}

function contributors(names: [string, number][]): ContributorStat[] {
  return names.map(([login, contributions]) => ({
    login,
    avatarUrl: `https://avatars.githubusercontent.com/${login}`,
    htmlUrl: `https://github.com/${login}`,
    contributions,
  }));
}

function releases(entries: [string, number][]): ReleaseInfo[] {
  return entries.map(([tag, days], i) => ({
    id: 1000 + i,
    name: tag,
    tagName: tag,
    publishedAt: daysAgo(days),
    isPrerelease: tag.includes('-'),
    htmlUrl: `https://github.com/beacon-labs/aurora/releases/tag/${tag}`,
  }));
}

/** A healthy, actively-maintained demo repository. */
export const demoHealthySnapshot: RepositorySnapshot = {
  identifier: { owner: 'beacon-labs', repo: 'aurora' },
  metadata: {
    id: 424242,
    owner: 'beacon-labs',
    name: 'aurora',
    fullName: 'beacon-labs/aurora',
    description: 'A fast, composable state management library for modern web apps.',
    homepage: 'https://aurora.beacon-labs.dev',
    htmlUrl: 'https://github.com/beacon-labs/aurora',
    defaultBranch: 'main',
    license: 'MIT',
    topics: ['typescript', 'state-management', 'react', 'frontend', 'reactivity'],
    isArchived: false,
    isFork: false,
    createdAt: daysAgo(1400),
    updatedAt: daysAgo(2),
    pushedAt: daysAgo(1),
    stars: 18432,
    forks: 921,
    watchers: 412,
    openIssues: 47,
    primaryLanguage: 'TypeScript',
    sizeKb: 24800,
  },
  languages: { TypeScript: 812000, JavaScript: 94000, CSS: 21000, Shell: 4200 },
  contributors: contributors([
    ['renata-io', 1284],
    ['devon-hart', 903],
    ['lin-mercer', 642],
    ['sasha-QA', 388],
    ['kenji-ops', 271],
    ['priya-docs', 205],
    ['marco-fe', 164],
    ['ada-rt', 121],
  ]).concat(
    Array.from({ length: 26 }, (_, i) => ({
      login: `contrib-${i + 9}`,
      avatarUrl: `https://avatars.githubusercontent.com/contrib-${i + 9}`,
      htmlUrl: `https://github.com/contrib-${i + 9}`,
      contributions: 40 - i,
    })),
  ),
  commitActivity: commitHistory(7, 22, 0.15),
  releases: releases([
    ['v3.4.0', 12],
    ['v3.3.1', 34],
    ['v3.3.0', 61],
    ['v3.2.0', 96],
    ['v3.1.0', 140],
  ]),
  issues: {
    open: 47,
    closed: 1893,
    medianTimeToCloseHours: 62,
    openedLast30Days: 58,
    closedLast30Days: 64,
  },
  pullRequests: {
    open: 12,
    merged: 2140,
    closedWithoutMerge: 190,
    medianTimeToMergeHours: 41,
    openedLast30Days: 71,
    mergedLast30Days: 68,
  },
  readme: {
    present: true,
    lengthBytes: 8600,
    hasBadges: true,
    hasInstallSection: true,
    hasUsageSection: true,
    hasLicenseSection: true,
  },
  dependencies: [
    { ecosystem: 'npm', path: 'package.json', dependencyCount: 14 },
  ],
  security: {
    hasSecurityPolicy: true,
    hasDependabot: true,
    vulnerabilityAlertCount: 0,
  },
  collectedAt: daysAgo(0),
};

/** A slowing, at-risk demo repository. */
export const demoAtRiskSnapshot: RepositorySnapshot = {
  identifier: { owner: 'beacon-labs', repo: 'legacy-cli' },
  metadata: {
    id: 525252,
    owner: 'beacon-labs',
    name: 'legacy-cli',
    fullName: 'beacon-labs/legacy-cli',
    description: 'The original command-line client. Feature-complete but slowing down.',
    homepage: null,
    htmlUrl: 'https://github.com/beacon-labs/legacy-cli',
    defaultBranch: 'master',
    license: 'Apache-2.0',
    topics: ['cli'],
    isArchived: false,
    isFork: false,
    createdAt: daysAgo(2600),
    updatedAt: daysAgo(190),
    pushedAt: daysAgo(184),
    stars: 3120,
    forks: 402,
    watchers: 88,
    openIssues: 214,
    primaryLanguage: 'Go',
    sizeKb: 9800,
  },
  languages: { Go: 410000, Makefile: 6200, Shell: 8800 },
  contributors: contributors([
    ['old-maintainer', 1840],
    ['drive-by-1', 42],
    ['drive-by-2', 21],
  ]),
  commitActivity: commitHistory(13, 6, -0.11),
  releases: releases([['v1.9.2', 210]]),
  issues: {
    open: 214,
    closed: 640,
    medianTimeToCloseHours: 1680,
    openedLast30Days: 22,
    closedLast30Days: 4,
  },
  pullRequests: {
    open: 38,
    merged: 512,
    closedWithoutMerge: 96,
    medianTimeToMergeHours: 720,
    openedLast30Days: 9,
    mergedLast30Days: 2,
  },
  readme: {
    present: true,
    lengthBytes: 1400,
    hasBadges: false,
    hasInstallSection: true,
    hasUsageSection: false,
    hasLicenseSection: false,
  },
  dependencies: [{ ecosystem: 'go', path: 'go.mod', dependencyCount: 21 }],
  security: {
    hasSecurityPolicy: false,
    hasDependabot: false,
    vulnerabilityAlertCount: 3,
  },
  collectedAt: daysAgo(0),
};

export const demoSnapshots: Record<string, RepositorySnapshot> = {
  'beacon-labs/aurora': demoHealthySnapshot,
  'beacon-labs/legacy-cli': demoAtRiskSnapshot,
};
