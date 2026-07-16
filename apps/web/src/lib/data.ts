import {
  computeBeaconScore,
  demoSnapshots,
  type BeaconScore,
  type RepositorySnapshot,
} from '@beacon/core';

/**
 * A fully-computed analysis for the UI: the raw snapshot, the deterministic
 * Beacon Score, a natural-language summary, and short highlight chips.
 *
 * Everything here is synchronous so it can be consumed directly inside React
 * Server Components without an async provider in the render path.
 */
export interface DemoAnalysis {
  snapshot: RepositorySnapshot;
  score: BeaconScore;
  summary: string;
  highlights: string[];
}

function describeDays(days: number): string {
  if (!Number.isFinite(days)) return 'at an unknown time';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

function daysBetween(fromIso: string, toIso: string | null): number {
  if (!toIso) return Number.POSITIVE_INFINITY;
  return Math.round((Date.parse(fromIso) - Date.parse(toIso)) / (1000 * 60 * 60 * 24));
}

/**
 * Build a synchronous, deterministic summary + highlights from a snapshot and
 * its score. This mirrors the offline HeuristicProvider in @beacon/core but
 * stays fully synchronous for Server Components.
 */
export function buildDemoAnalysis(snapshot: RepositorySnapshot): DemoAnalysis {
  const score = computeBeaconScore(snapshot);
  const m = snapshot.metadata;
  const sentences: string[] = [];

  const pillar = (name: string): number =>
    score.pillars.find((p) => p.pillar === name)?.score ?? 0;

  const activity = pillar('activity');
  const lastPushDays = daysBetween(snapshot.collectedAt, m.pushedAt);

  if (activity >= 75) {
    sentences.push(
      `${m.name} is actively maintained, with its most recent push ${describeDays(lastPushDays)}.`,
    );
  } else if (activity >= 45) {
    sentences.push(`${m.name} sees moderate activity, last updated ${describeDays(lastPushDays)}.`);
  } else {
    sentences.push(
      `${m.name} shows limited recent activity; the last push was ${describeDays(lastPushDays)}.`,
    );
  }

  const contributorCount = snapshot.contributors.length;
  if (contributorCount >= 20) {
    sentences.push(`It is backed by a broad contributor base of ${contributorCount}+ people.`);
  } else if (contributorCount > 1) {
    sentences.push(`Development is carried by ${contributorCount} contributors.`);
  } else {
    sentences.push('It is effectively a single-maintainer project.');
  }

  const latestRelease = snapshot.releases.find((r) => r.publishedAt);
  if (latestRelease?.publishedAt) {
    const relDays = daysBetween(snapshot.collectedAt, latestRelease.publishedAt);
    sentences.push(`The latest release, ${latestRelease.tagName}, shipped ${describeDays(relDays)}.`);
  }

  if (pillar('maintenance') < 55) {
    sentences.push(
      `Issue and pull-request throughput is a weak point, with ${snapshot.issues.open} open issues.`,
    );
  } else if (pillar('security') >= 80) {
    sentences.push('Supply-chain hygiene is strong, with automated dependency and policy checks in place.');
  }

  const summary = `${m.fullName} holds a Beacon Score of ${score.total}/100 (${score.grade}). ${sentences.join(' ')}`;

  const highlights = [
    ...score.strengths.slice(0, 3).map((s) => `✓ ${s}`),
    ...score.warnings.slice(0, 2).map((w) => `! ${w}`),
  ];

  return { snapshot, score, summary, highlights };
}

/** All demo analyses, ordered by descending Beacon Score. */
export function getDemoAnalyses(): DemoAnalysis[] {
  return Object.values(demoSnapshots)
    .map(buildDemoAnalysis)
    .sort((a, b) => b.score.total - a.score.total);
}

/** Look up a single demo analysis by owner/repo, or null if unknown. */
export function getDemoAnalysis(owner: string, repo: string): DemoAnalysis | null {
  const key = `${owner}/${repo}`.toLowerCase();
  const match = Object.entries(demoSnapshots).find(
    ([slug]) => slug.toLowerCase() === key,
  );
  return match ? buildDemoAnalysis(match[1]) : null;
}
