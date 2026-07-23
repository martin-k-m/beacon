/**
 * Domain model for Beacon repository intelligence.
 *
 * These types describe the raw signals collected from a GitHub repository
 * (a {@link RepositorySnapshot}) and the derived intelligence Beacon produces
 * from them (a {@link BeaconScore} and {@link BeaconAnalysis}).
 */

/** A `owner/repo` coordinate. */
export interface RepoIdentifier {
  owner: string;
  repo: string;
}

export interface RepositoryMetadata {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  homepage: string | null;
  htmlUrl: string;
  defaultBranch: string;
  license: string | null;
  topics: string[];
  isArchived: boolean;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  primaryLanguage: string | null;
  sizeKb: number;
}

/** Bytes of code per language, as reported by the GitHub languages API. */
export type LanguageBreakdown = Record<string, number>;

export interface ContributorStat {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  contributions: number;
}

/** One bucket of the weekly commit-activity histogram (52 weeks). */
export interface CommitActivityWeek {
  /** Unix timestamp (seconds) of the start of the week. */
  weekStart: number;
  total: number;
}

export interface ReleaseInfo {
  id: number;
  name: string;
  tagName: string;
  publishedAt: string | null;
  isPrerelease: boolean;
  htmlUrl: string;
}

export interface IssueMetrics {
  open: number;
  closed: number;
  /** Median time-to-close in hours over the sampled window, or null if unknown. */
  medianTimeToCloseHours: number | null;
  openedLast30Days: number;
  closedLast30Days: number;
}

export interface PullRequestMetrics {
  open: number;
  merged: number;
  closedWithoutMerge: number;
  /** Median time-to-merge in hours over the sampled window, or null if unknown. */
  medianTimeToMergeHours: number | null;
  openedLast30Days: number;
  mergedLast30Days: number;
}

export interface ReadmeInfo {
  present: boolean;
  lengthBytes: number;
  hasBadges: boolean;
  hasInstallSection: boolean;
  hasUsageSection: boolean;
  hasLicenseSection: boolean;
}

export interface DependencyManifest {
  ecosystem: string;
  path: string;
  /**
   * Declared dependencies in the manifest, or `null` when the collector could
   * detect the manifest but did not read its contents. Local analysis parses
   * manifests off disk and reports a real count; remote GitHub collection only
   * lists the repository tree, so it reports `null` rather than a misleading
   * zero. Treat `null` as "unknown", never as "none".
   */
  dependencyCount: number | null;
}

export interface SecuritySignals {
  hasSecurityPolicy: boolean;
  hasDependabot: boolean;
  vulnerabilityAlertCount: number | null;
}

/**
 * A complete, timestamped collection of the raw signals Beacon gathered for a
 * repository. Everything downstream (scoring, AI) is a pure function of this.
 */
export interface RepositorySnapshot {
  identifier: RepoIdentifier;
  metadata: RepositoryMetadata;
  languages: LanguageBreakdown;
  contributors: ContributorStat[];
  commitActivity: CommitActivityWeek[];
  releases: ReleaseInfo[];
  issues: IssueMetrics;
  pullRequests: PullRequestMetrics;
  readme: ReadmeInfo;
  dependencies: DependencyManifest[];
  security: SecuritySignals;
  /** ISO timestamp of when this snapshot was collected. */
  collectedAt: string;
}

/** The five weighted pillars that make up the Beacon Score. */
export type ScorePillar = 'activity' | 'community' | 'maintenance' | 'documentation' | 'security';

export interface PillarScore {
  pillar: ScorePillar;
  /** 0–100 score for this pillar. */
  score: number;
  /** Relative weight of this pillar in the overall score (0–1). */
  weight: number;
  /** Human-readable signals that drove this pillar's score. */
  reasons: string[];
}

export type HealthGrade = 'Excellent' | 'Healthy' | 'Fair' | 'At risk' | 'Critical';

export interface BeaconScore {
  /** Overall 0–100 Beacon Score. */
  total: number;
  grade: HealthGrade;
  pillars: PillarScore[];
  strengths: string[];
  warnings: string[];
}

export interface BeaconSummary {
  provider: string;
  model: string | null;
  /** One-paragraph natural-language health summary. */
  text: string;
  /** Short bullet highlights suitable for a card. */
  highlights: string[];
  generatedAt: string;
}

export interface BeaconAnalysis {
  snapshot: RepositorySnapshot;
  score: BeaconScore;
  summary: BeaconSummary;
}
