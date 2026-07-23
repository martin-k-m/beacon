import type { RepositorySnapshot, ScorePillar } from '@beacon/shared';
import { PILLAR_WEIGHTS } from '@beacon/analytics';
import type { AdviseInput, AdvisorIssue, AdvisorSeverity } from './types';

const HOURS_PER_DAY = 24;

/** Thresholds for the deterministic rule engine, expressed in domain units. */
const THRESHOLDS = {
  /** Issue median time-to-close considered slow (14 days). */
  slowIssueCloseHours: 14 * HOURS_PER_DAY,
  /** PR median time-to-merge considered slow (7 days). */
  slowPrMergeHours: 7 * HOURS_PER_DAY,
  /** Backlog is growing when closed drops below this share of opened. */
  backlogClosedRatio: 0.5,
  /** Minimum opened issues before the backlog rule is meaningful. */
  backlogMinOpened: 5,
  /** README shorter than this (bytes) is considered thin. */
  thinReadmeBytes: 1500,
  /** Top contributor share above this signals a low bus factor. */
  busFactorShare: 0.6,
  /** Repository is stale when the last push is older than this (days). */
  stalePushDays: 120,
  /** Per-pillar trend drop (points) that warrants its own issue. */
  pillarDeclineDelta: -5,
} as const;

/** Ranks used to sort issues high → low. */
const SEVERITY_RANK: Record<AdvisorSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function pillarWeight(pillar: ScorePillar | undefined): number {
  if (!pillar) return 0;
  return PILLAR_WEIGHTS[pillar];
}

function daysBetween(laterIso: string, earlierIso: string): number {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return Number.NaN;
  return (later - earlier) / (1000 * 60 * 60 * 24);
}

function describeDays(days: number): string {
  if (!Number.isFinite(days)) return 'an unknown time ago';
  const d = Math.round(days);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 60) return `${d} days ago`;
  if (d < 730) return `${Math.round(d / 30)} months ago`;
  return `${Math.round(d / 365)} years ago`;
}

function pillarLabel(pillar: ScorePillar): string {
  return pillar.charAt(0).toUpperCase() + pillar.slice(1);
}

/** Maintenance rules: issue response, PR velocity, and backlog growth. */
function maintenanceIssues(snapshot: RepositorySnapshot): AdvisorIssue[] {
  const issues: AdvisorIssue[] = [];
  const { issues: iss, pullRequests: pr } = snapshot;

  if (
    iss.medianTimeToCloseHours !== null &&
    iss.medianTimeToCloseHours > THRESHOLDS.slowIssueCloseHours
  ) {
    const days = Math.round(iss.medianTimeToCloseHours / HOURS_PER_DAY);
    issues.push({
      id: 'slow-issue-response',
      severity: 'medium',
      pillar: 'maintenance',
      title: 'Slow issue response time',
      detail: `The median issue takes about ${days} days to close, well beyond a healthy response window. Contributors and users may feel their reports are going unanswered.`,
      recommendation:
        'Add issue triage automation (e.g. a labeling workflow and a stale-bot) and set a target first-response time.',
    });
  }

  if (
    pr.medianTimeToMergeHours !== null &&
    pr.medianTimeToMergeHours > THRESHOLDS.slowPrMergeHours
  ) {
    const days = Math.round(pr.medianTimeToMergeHours / HOURS_PER_DAY);
    issues.push({
      id: 'slow-pr-velocity',
      severity: 'medium',
      pillar: 'maintenance',
      title: 'Slow pull-request velocity',
      detail: `Pull requests take a median of about ${days} days to merge, which stalls contributions and lets branches drift out of date.`,
      recommendation:
        'Encourage smaller, focused pull requests and adopt a review SLA so PRs get a first review within a day or two.',
    });
  }

  const opened = iss.openedLast30Days;
  const closed = iss.closedLast30Days;
  if (opened >= THRESHOLDS.backlogMinOpened && closed < opened * THRESHOLDS.backlogClosedRatio) {
    issues.push({
      id: 'growing-backlog',
      severity: 'medium',
      pillar: 'maintenance',
      title: 'Issue backlog is growing',
      detail: `In the last 30 days ${opened} issues were opened but only ${closed} were closed, so the backlog is expanding faster than it is being worked down.`,
      recommendation:
        'Run a triage sweep to close stale or duplicate issues and prioritize the remainder into a short-term milestone.',
    });
  }

  return issues;
}

/** Security and dependency rules. */
function securityIssues(snapshot: RepositorySnapshot): AdvisorIssue[] {
  const issues: AdvisorIssue[] = [];
  const { security, dependencies } = snapshot;

  if (security.vulnerabilityAlertCount !== null && security.vulnerabilityAlertCount > 0) {
    const n = security.vulnerabilityAlertCount;
    issues.push({
      id: 'vulnerable-dependencies',
      severity: 'high',
      pillar: 'security',
      title: 'Vulnerable dependencies detected',
      detail: `There ${n === 1 ? 'is' : 'are'} ${n} open vulnerability alert${n === 1 ? '' : 's'} against this repository's dependencies, exposing users to known security issues.`,
      recommendation:
        'Update vulnerable dependencies to patched versions and enable automated security updates to stay ahead of new advisories.',
    });
  }

  if (!security.hasSecurityPolicy) {
    issues.push({
      id: 'missing-security-policy',
      severity: 'medium',
      pillar: 'security',
      title: 'No security policy',
      detail:
        'The repository has no security policy, so there is no documented way for researchers to report vulnerabilities responsibly.',
      recommendation:
        'Add a SECURITY.md describing how to report vulnerabilities and your disclosure process.',
    });
  }

  if (dependencies.length > 0 && !security.hasDependabot) {
    issues.push({
      id: 'no-dependabot',
      severity: 'medium',
      pillar: 'security',
      title: 'Automated dependency updates are off',
      detail: `The project declares ${dependencies.length} dependency manifest${dependencies.length === 1 ? '' : 's'} but has no Dependabot configuration, so out-of-date and vulnerable dependencies can go unnoticed.`,
      recommendation:
        'Enable Dependabot (or an equivalent) to open update PRs and surface security advisories automatically.',
    });
  }

  return issues;
}

/** Documentation rules based on the README. */
function documentationIssues(snapshot: RepositorySnapshot): AdvisorIssue[] {
  const issues: AdvisorIssue[] = [];
  const readme = snapshot.readme;

  if (!readme.present) {
    issues.push({
      id: 'missing-readme',
      severity: 'medium',
      pillar: 'documentation',
      title: 'No README',
      detail:
        'The repository has no README, leaving newcomers without a starting point for what the project does or how to use it.',
      recommendation:
        'Add a README with a project overview, installation steps, and a basic usage example.',
    });
    return issues;
  }

  const missing: string[] = [];
  if (!readme.hasInstallSection) missing.push('installation');
  if (!readme.hasUsageSection) missing.push('usage');
  const isThin = readme.lengthBytes < THRESHOLDS.thinReadmeBytes;

  if (missing.length > 0 || isThin) {
    const gaps =
      missing.length > 0 ? `it is missing ${missing.join(' and ')} guidance` : 'it is quite short';
    issues.push({
      id: 'thin-documentation',
      severity: 'low',
      pillar: 'documentation',
      title: 'Documentation is thin',
      detail: `The README is present but ${gaps}, which makes the project harder to adopt.`,
      recommendation:
        'Expand the README with usage and API examples covering the most common tasks.',
    });
  }

  return issues;
}

/** Community rule: maintainer concentration / bus factor. */
function communityIssues(snapshot: RepositorySnapshot): AdvisorIssue[] {
  const contributors = snapshot.contributors;
  if (contributors.length < 2) {
    return [
      {
        id: 'single-maintainer',
        severity: 'medium',
        pillar: 'community',
        title: 'High maintainer concentration (low bus factor)',
        detail:
          'The project is effectively maintained by a single person, so it is vulnerable to stalling if that maintainer becomes unavailable.',
        recommendation:
          'Recruit and onboard additional maintainers, and distribute review and merge rights.',
      },
    ];
  }

  const total = contributors.reduce((sum, c) => sum + c.contributions, 0);
  if (total <= 0) return [];
  const top = contributors.reduce((max, c) => Math.max(max, c.contributions), 0);
  const share = top / total;
  if (share > THRESHOLDS.busFactorShare) {
    const pct = Math.round(share * 100);
    return [
      {
        id: 'low-bus-factor',
        severity: 'medium',
        pillar: 'community',
        title: 'High maintainer concentration (low bus factor)',
        detail: `A single contributor accounts for about ${pct}% of all contributions, so the project's continuity depends heavily on one person.`,
        recommendation:
          'Distribute review and ownership across more contributors and document key areas to reduce the bus factor.',
      },
    ];
  }

  return [];
}

/** Activity rules: staleness and release cadence. */
function activityIssues(snapshot: RepositorySnapshot): AdvisorIssue[] {
  const issues: AdvisorIssue[] = [];
  const pushDays = daysBetween(snapshot.collectedAt, snapshot.metadata.pushedAt);

  if (Number.isFinite(pushDays) && pushDays > THRESHOLDS.stalePushDays) {
    issues.push({
      id: 'stale-activity',
      severity: 'medium',
      pillar: 'activity',
      title: 'Little recent activity',
      detail: `The most recent push was ${describeDays(pushDays)}, suggesting development has slowed or stalled.`,
      recommendation:
        'Re-establish a regular commit and review cadence, or clearly mark the project as maintenance-only if that is intended.',
    });
  }

  if (snapshot.releases.length === 0) {
    issues.push({
      id: 'no-releases',
      severity: 'low',
      pillar: 'activity',
      title: 'No published releases',
      detail:
        'The repository has no published releases, making it hard for users to depend on stable, versioned builds.',
      recommendation: 'Adopt a release cadence with tagged, versioned releases and changelogs.',
    });
  }

  return issues;
}

/** Trend-driven rules: explain and reverse per-pillar declines. */
function trendIssues(input: AdviseInput): AdvisorIssue[] {
  const trend = input.trend;
  if (!trend) return [];

  const advice: Record<ScorePillar, string> = {
    activity: 'Restore a steadier commit and release cadence to lift the activity score.',
    community: 'Grow and support the contributor base to rebuild community strength.',
    maintenance: 'Work down the issue and PR backlog to recover maintenance throughput.',
    documentation: 'Add API examples and refresh the README to reverse the documentation decline.',
    security: 'Address open advisories and add security tooling to recover the security score.',
  };

  return trend.perPillar
    .filter((p) => p.delta <= THRESHOLDS.pillarDeclineDelta)
    .map((p) => ({
      id: `trend-decline-${p.pillar}`,
      severity: 'medium' as AdvisorSeverity,
      pillar: p.pillar,
      title: `${pillarLabel(p.pillar)} score is declining`,
      detail: `The ${p.pillar} pillar dropped ${Math.abs(p.delta)} points (from ${p.previous} to ${p.current}) over the trend window.`,
      recommendation: advice[p.pillar],
    }));
}

/**
 * The pure, deterministic rule engine. Given a repository analysis (and an
 * optional trend), it returns prioritized {@link AdvisorIssue}s. Identical
 * input always produces identical output — no clock, randomness, or I/O.
 *
 * Issues are sorted high → low by severity, then by pillar weight (heavier
 * pillars first), then by a stable id tiebreak.
 */
export function adviseIssues(input: AdviseInput): AdvisorIssue[] {
  const snapshot = input.analysis.snapshot;

  const collected: AdvisorIssue[] = [
    ...securityIssues(snapshot),
    ...maintenanceIssues(snapshot),
    ...documentationIssues(snapshot),
    ...communityIssues(snapshot),
    ...activityIssues(snapshot),
    ...trendIssues(input),
  ];

  // De-duplicate by id, keeping the first (rule-order) occurrence.
  const seen = new Set<string>();
  const unique = collected.filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  });

  return unique.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byWeight = pillarWeight(b.pillar) - pillarWeight(a.pillar);
    if (byWeight !== 0) return byWeight;
    return a.id.localeCompare(b.id);
  });
}
