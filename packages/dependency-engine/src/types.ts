/**
 * Domain types for the Beacon dependency engine.
 *
 * The engine analyzes a set of {@link DependencyInput}s (name + ecosystem +
 * optional current version) against a pluggable {@link RegistryClient} and
 * produces a {@link DependencyReport} classifying each dependency.
 */

/** A package ecosystem the engine can reason about. */
export type DependencyEcosystem =
  'npm' | 'pip' | 'cargo' | 'go' | 'maven' | 'gradle' | 'rubygems' | 'composer' | 'unknown';

/**
 * The health classification for a single dependency.
 *
 * `vulnerable` is intentionally part of the model even though none of the
 * bundled registry clients can source vulnerability data today — a caller that
 * has its own advisory feed can pass it through and the engine will map it.
 */
export type DependencyStatus = 'current' | 'outdated' | 'vulnerable' | 'unmaintained' | 'unknown';

/** A dependency to analyze. */
export interface DependencyInput {
  name: string;
  ecosystem: DependencyEcosystem;
  currentVersion?: string;
}

/** The engine's verdict for a single dependency. */
export interface DependencyStatusResult {
  name: string;
  ecosystem: DependencyEcosystem;
  currentVersion?: string;
  latestVersion?: string;
  status: DependencyStatus;
  license?: string;
  notes?: string[];
}

/** The aggregated result of analyzing a set of dependencies. */
export interface DependencyReport {
  dependencies: DependencyStatusResult[];
  counts: Record<DependencyStatus, number>;
  ecosystems: DependencyEcosystem[];
  /** e.g. "3 outdated, 1 unmaintained across 24 dependencies." */
  summary: string;
  /** ISO timestamp of when this report was generated. */
  generatedAt: string;
}

/** Metadata a registry can report for a single package. */
export interface RegistryPackageInfo {
  latestVersion?: string;
  license?: string;
  /** ISO timestamp of the most recent publish, if known. */
  lastPublished?: string;
  deprecated?: boolean;
}

/**
 * A pluggable source of package metadata.
 *
 * Implementations must never throw: on any error, timeout, or non-200 response
 * they return `null`, which the engine treats as "unknown".
 */
export interface RegistryClient {
  /** Latest metadata for a package, or null if unknown/unreachable. */
  getPackage(ecosystem: DependencyEcosystem, name: string): Promise<RegistryPackageInfo | null>;
}
