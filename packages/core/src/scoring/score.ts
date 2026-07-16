import type {
  BeaconScore,
  CommitActivityWeek,
  HealthGrade,
  PillarScore,
  RepositorySnapshot,
  ScorePillar,
} from '../types';

/** Weights for each pillar. Must sum to 1. */
export const PILLAR_WEIGHTS: Record<ScorePillar, number> = {
  activity: 0.3,
  community: 0.2,
  maintenance: 0.2,
  documentation: 0.15,
  security: 0.15,
};

const DAY = 1000 * 60 * 60 * 24;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value);
}

function daysSince(iso: string | null, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (now - t) / DAY;
}

function commitsInLastWeeks(activity: CommitActivityWeek[], weeks: number): number {
  if (activity.length === 0) return 0;
  return activity.slice(-weeks).reduce((sum, w) => sum + w.total, 0);
}

/**
 * Activity: how alive is the project? Driven by recency of the last push,
 * commit volume over the last 12 weeks, and release cadence.
 */
function scoreActivity(snapshot: RepositorySnapshot, now: number): PillarScore {
  const reasons: string[] = [];
  const pushedAgo = daysSince(snapshot.metadata.pushedAt, now);

  // Recency: 100 at <=7 days, decaying to 0 at ~365 days.
  let recency: number;
  if (pushedAgo <= 7) recency = 100;
  else if (pushedAgo >= 365) recency = 0;
  else recency = clamp(100 - ((pushedAgo - 7) / (365 - 7)) * 100);
  if (pushedAgo <= 7) reasons.push('Pushed to within the last week');
  else if (pushedAgo <= 30) reasons.push('Active in the last month');
  else if (Number.isFinite(pushedAgo))
    reasons.push(`Last push ${Math.round(pushedAgo)} days ago`);

  // Commit volume over last 12 weeks: 60+ commits => full marks.
  const recentCommits = commitsInLastWeeks(snapshot.commitActivity, 12);
  const volume = clamp((recentCommits / 60) * 100);
  if (recentCommits > 0) reasons.push(`${recentCommits} commits in the last 12 weeks`);

  // Release cadence: reward a release in the last 120 days.
  const lastRelease = snapshot.releases.find((r) => r.publishedAt);
  const releaseAgo = daysSince(lastRelease?.publishedAt ?? null, now);
  let cadence: number;
  if (releaseAgo <= 120) cadence = 100;
  else if (releaseAgo >= 730) cadence = 0;
  else cadence = clamp(100 - ((releaseAgo - 120) / (730 - 120)) * 100);
  if (snapshot.releases.length === 0) {
    cadence = 30;
    reasons.push('No published releases');
  } else if (releaseAgo <= 120) {
    reasons.push('Released within the last 4 months');
  }

  const score = round(recency * 0.5 + volume * 0.3 + cadence * 0.2);
  return { pillar: 'activity', score, weight: PILLAR_WEIGHTS.activity, reasons };
}

/**
 * Community: is there a healthy contributor base and engagement? Driven by
 * the number of distinct contributors and the ratio of external contribution.
 */
function scoreCommunity(snapshot: RepositorySnapshot): PillarScore {
  const reasons: string[] = [];
  const contributors = snapshot.contributors;
  const count = contributors.length;

  // Contributor breadth: 25+ contributors => full marks (log-ish curve).
  const breadth = clamp((Math.log10(count + 1) / Math.log10(26)) * 100);
  if (count >= 25) reasons.push(`Broad contributor base (${count}+ contributors)`);
  else if (count > 1) reasons.push(`${count} contributors`);
  else reasons.push('Single-maintainer project');

  // Bus-factor: share of commits not owned by the top contributor.
  const total = contributors.reduce((s, c) => s + c.contributions, 0);
  const topShare = total > 0 ? (contributors[0]?.contributions ?? 0) / total : 1;
  const distribution = clamp((1 - topShare) * 140);
  if (total > 0 && topShare < 0.5) reasons.push('Contributions are well distributed');
  else if (total > 0) reasons.push('Contributions concentrated on one maintainer');

  // Popularity as a weak community proxy.
  const popularity = clamp((Math.log10(snapshot.metadata.stars + 1) / Math.log10(50001)) * 100);

  const score = round(breadth * 0.5 + distribution * 0.3 + popularity * 0.2);
  return { pillar: 'community', score, weight: PILLAR_WEIGHTS.community, reasons };
}

/**
 * Maintenance: are issues and PRs being handled? Driven by issue/PR response
 * times and the open/closed backlog ratio.
 */
function scoreMaintenance(snapshot: RepositorySnapshot): PillarScore {
  const reasons: string[] = [];
  const { issues, pullRequests } = snapshot;

  // Issue responsiveness: median time-to-close, 100 at <=48h, 0 at >=90 days.
  const issueClose = issues.medianTimeToCloseHours;
  let issueResp = 60;
  if (issueClose != null) {
    if (issueClose <= 48) issueResp = 100;
    else if (issueClose >= 2160) issueResp = 10;
    else issueResp = clamp(100 - ((issueClose - 48) / (2160 - 48)) * 90);
    reasons.push(`Median issue close time ~${Math.round(issueClose / 24)}d`);
  }

  // PR merge velocity.
  const prMerge = pullRequests.medianTimeToMergeHours;
  let prResp = 60;
  if (prMerge != null) {
    if (prMerge <= 48) prResp = 100;
    else if (prMerge >= 1440) prResp = 10;
    else prResp = clamp(100 - ((prMerge - 48) / (1440 - 48)) * 90);
    reasons.push(`Median PR merge time ~${Math.round(prMerge / 24)}d`);
  }

  // Backlog pressure: closed vs open issues over the last 30 days.
  const flow = issues.closedLast30Days + issues.openedLast30Days;
  const backlog =
    flow > 0 ? clamp((issues.closedLast30Days / flow) * 100) : 55;
  if (issues.openedLast30Days > 0)
    reasons.push(
      `${issues.closedLast30Days} closed / ${issues.openedLast30Days} opened issues (30d)`,
    );

  const archivedPenalty = snapshot.metadata.isArchived ? 0.2 : 1;
  if (snapshot.metadata.isArchived) reasons.push('Repository is archived');

  const score = round((issueResp * 0.4 + prResp * 0.35 + backlog * 0.25) * archivedPenalty);
  return { pillar: 'maintenance', score, weight: PILLAR_WEIGHTS.maintenance, reasons };
}

/**
 * Documentation: can a newcomer get started? Driven by README presence,
 * length, and the presence of key sections, plus a homepage/topics signal.
 */
function scoreDocumentation(snapshot: RepositorySnapshot): PillarScore {
  const reasons: string[] = [];
  const { readme } = snapshot;

  if (!readme.present) {
    return {
      pillar: 'documentation',
      score: 10,
      weight: PILLAR_WEIGHTS.documentation,
      reasons: ['No README found'],
    };
  }

  let score = 30;
  reasons.push('README present');

  if (readme.lengthBytes >= 1500) {
    score += 20;
    reasons.push('Substantial README');
  } else {
    reasons.push('README is short');
  }
  if (readme.hasInstallSection) {
    score += 15;
    reasons.push('Documents installation');
  }
  if (readme.hasUsageSection) {
    score += 15;
    reasons.push('Documents usage');
  }
  if (readme.hasBadges) score += 5;
  if (readme.hasLicenseSection || snapshot.metadata.license) {
    score += 5;
    reasons.push('License is declared');
  }
  if (snapshot.metadata.homepage) score += 5;
  if (snapshot.metadata.topics.length >= 3) score += 5;

  return {
    pillar: 'documentation',
    score: round(clamp(score)),
    weight: PILLAR_WEIGHTS.documentation,
    reasons,
  };
}

/**
 * Security: how much attention is paid to supply-chain hygiene? Driven by
 * security policy, Dependabot, and known vulnerability alerts.
 */
function scoreSecurity(snapshot: RepositorySnapshot): PillarScore {
  const reasons: string[] = [];
  const { security } = snapshot;
  let score = 55;

  if (security.hasSecurityPolicy) {
    score += 15;
    reasons.push('Has a security policy');
  } else {
    reasons.push('No SECURITY.md');
  }
  if (security.hasDependabot) {
    score += 20;
    reasons.push('Dependabot enabled');
  } else {
    reasons.push('No Dependabot configuration');
  }
  if (security.vulnerabilityAlertCount != null) {
    if (security.vulnerabilityAlertCount === 0) {
      score += 10;
      reasons.push('No open vulnerability alerts');
    } else {
      score -= Math.min(40, security.vulnerabilityAlertCount * 8);
      reasons.push(`${security.vulnerabilityAlertCount} open vulnerability alerts`);
    }
  }
  if (snapshot.dependencies.length > 0) {
    reasons.push(
      `${snapshot.dependencies.length} dependency manifest(s) detected`,
    );
  }

  return {
    pillar: 'security',
    score: round(clamp(score)),
    weight: PILLAR_WEIGHTS.security,
    reasons,
  };
}

/** Map a 0–100 total to its {@link HealthGrade}. */
export function healthGradeForScore(total: number): HealthGrade {
  if (total >= 90) return 'Excellent';
  if (total >= 75) return 'Healthy';
  if (total >= 60) return 'Fair';
  if (total >= 40) return 'At risk';
  return 'Critical';
}

function gradeFor(total: number): HealthGrade {
  return healthGradeForScore(total);
}

/**
 * Compute the Beacon Score for a snapshot. Pure and deterministic: the same
 * snapshot always yields the same score.
 */
export function computeBeaconScore(
  snapshot: RepositorySnapshot,
  now: number = Date.parse(snapshot.collectedAt) || Date.now(),
): BeaconScore {
  const pillars: PillarScore[] = [
    scoreActivity(snapshot, now),
    scoreCommunity(snapshot),
    scoreMaintenance(snapshot),
    scoreDocumentation(snapshot),
    scoreSecurity(snapshot),
  ];

  const total = round(
    pillars.reduce((sum, p) => sum + p.score * p.weight, 0),
  );

  const strengths = pillars
    .filter((p) => p.score >= 75)
    .map((p) => `${capitalize(p.pillar)}: ${p.reasons[0] ?? 'strong'}`);

  const warnings = pillars
    .filter((p) => p.score < 55)
    .map((p) => `${capitalize(p.pillar)}: ${p.reasons[p.reasons.length - 1] ?? 'needs attention'}`);

  return {
    total,
    grade: gradeFor(total),
    pillars,
    strengths,
    warnings,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
