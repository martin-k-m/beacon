import type { BeaconAnalysis, ScorePillar } from '@beacon/shared';
import type { HealthPoint, TrendResult } from '@beacon/analytics';
import type { AIProviderConfig } from '@beacon/ai';

/** Relative impact of an advisor issue on repository health. */
export type AdvisorSeverity = 'high' | 'medium' | 'low';

/**
 * A single, grounded problem the advisor found in a repository, together with a
 * concrete recommendation for how to address it.
 */
export interface AdvisorIssue {
  /** Stable identifier for the rule that produced this issue. */
  id: string;
  severity: AdvisorSeverity;
  /** The pillar this issue relates to, when applicable. */
  pillar?: ScorePillar;
  /** Short human-readable title, e.g. "Slow issue response time". */
  title: string;
  /** Why this is a problem, grounded in the snapshot/score/trend data. */
  detail: string;
  /** A concrete action to take, e.g. "Add issue triage automation". */
  recommendation: string;
}

/** The full advice document produced for a repository analysis. */
export interface AdvisorReport {
  /** Lead line, driven by the trend when present, else the grade. */
  headline: string;
  /** Current total Beacon Score. */
  score: number;
  /** Current health grade. */
  grade: string;
  /** Percentage health change from the trend, when a trend was provided. */
  healthDeltaPercent?: number;
  /** Prioritized issues, ordered high → low severity. */
  issues: AdvisorIssue[];
  /** 2–4 sentence narrative tying the findings together. */
  summary: string;
  /** ISO timestamp of when this report was generated. */
  generatedAt: string;
}

/** Everything the advisor needs to reason about a repository. */
export interface AdviseInput {
  analysis: BeaconAnalysis;
  trend?: TrendResult;
  history?: HealthPoint[];
}

/** Optional tuning for {@link AdvisorReport} generation. */
export interface AdviseOptions {
  /** When set to a hosted provider, used to write a nicer summary. */
  ai?: AIProviderConfig;
  /** Maximum number of issues to include (default 5). */
  maxIssues?: number;
}
