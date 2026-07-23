/**
 * The dependency analysis engine.
 *
 * Pure orchestration: given a list of {@link DependencyInput}s and a
 * {@link RegistryClient}, it looks up each package's latest metadata and
 * classifies it into a {@link DependencyStatus}. All network concerns live in
 * the registry client, so the engine itself is deterministic and testable.
 */

import type { DependencyManifest } from '@beacon/shared';

import { MultiRegistryClient } from './registry-clients';
import type {
  DependencyEcosystem,
  DependencyInput,
  DependencyReport,
  DependencyStatus,
  DependencyStatusResult,
  RegistryClient,
  RegistryPackageInfo,
} from './types';

/** Roughly two years, in milliseconds — the "unmaintained" age threshold. */
const UNMAINTAINED_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** All statuses, so `counts` always has a complete, zero-filled shape. */
const ALL_STATUSES: readonly DependencyStatus[] = [
  'current',
  'outdated',
  'vulnerable',
  'unmaintained',
  'unknown',
];

export interface AnalyzeOptions {
  registry?: RegistryClient;
  /**
   * Clock override for testability; defaults to `Date.now`. Used for the
   * unmaintained-age comparison.
   */
  now?: () => number;
}

/**
 * Analyze a set of dependencies, producing a classified {@link DependencyReport}.
 * Lookups run concurrently. The default registry is {@link MultiRegistryClient}.
 */
export async function analyzeDependencies(
  deps: DependencyInput[],
  options: AnalyzeOptions = {},
): Promise<DependencyReport> {
  const registry = options.registry ?? new MultiRegistryClient();
  const now = options.now ?? Date.now;

  const dependencies = await Promise.all(
    deps.map((dep) => classifyDependency(dep, registry, now())),
  );

  const counts = emptyCounts();
  for (const dep of dependencies) {
    counts[dep.status] += 1;
  }

  const ecosystems = uniqueEcosystems(deps);
  const summary = buildSummary(counts, dependencies.length);

  return {
    dependencies,
    counts,
    ecosystems,
    summary,
    generatedAt: new Date(now()).toISOString(),
  };
}

/**
 * A documented seam for feeding real dependencies into the engine.
 *
 * A {@link DependencyManifest} in a Beacon snapshot only records that a manifest
 * exists and — when the collector read it — how many dependencies it declared,
 * not the dependency names or versions themselves. There is nothing to expand
 * here, so this honestly returns an empty list. When a manifest parser is added
 * upstream, this is the function that would turn parsed manifests into
 * {@link DependencyInput}s.
 */
export function fromManifests(_manifests: DependencyManifest[]): DependencyInput[] {
  return [];
}

async function classifyDependency(
  dep: DependencyInput,
  registry: RegistryClient,
  nowMs: number,
): Promise<DependencyStatusResult> {
  let info: RegistryPackageInfo | null = null;
  try {
    info = await registry.getPackage(dep.ecosystem, dep.name);
  } catch {
    // Registry clients are contracted never to throw, but stay defensive.
    info = null;
  }

  const notes: string[] = [];
  const result: DependencyStatusResult = {
    name: dep.name,
    ecosystem: dep.ecosystem,
    status: 'unknown',
  };
  if (typeof dep.currentVersion === 'string') {
    result.currentVersion = dep.currentVersion;
  }

  if (!info) {
    result.notes = ['no registry metadata available'];
    return result;
  }

  if (info.latestVersion) {
    result.latestVersion = info.latestVersion;
  }
  if (info.license) {
    result.license = info.license;
    const licenseNote = licenseNoteFor(info.license);
    if (licenseNote) {
      notes.push(licenseNote);
    }
  }

  result.status = deriveStatus(dep, info, nowMs, notes);

  if (notes.length > 0) {
    result.notes = notes;
  }
  return result;
}

/**
 * Apply the classification rules in priority order:
 * deprecated → stale → outdated (major behind) → current → unknown.
 */
function deriveStatus(
  dep: DependencyInput,
  info: RegistryPackageInfo,
  nowMs: number,
  notes: string[],
): DependencyStatus {
  if (info.deprecated) {
    notes.push('package is deprecated');
    return 'unmaintained';
  }

  if (info.lastPublished) {
    const publishedMs = Date.parse(info.lastPublished);
    if (!Number.isNaN(publishedMs) && nowMs - publishedMs > UNMAINTAINED_AGE_MS) {
      const years = ((nowMs - publishedMs) / (365 * 24 * 60 * 60 * 1000)).toFixed(1);
      notes.push(`no release in ${years} years`);
      return 'unmaintained';
    }
  }

  const current = dep.currentVersion;
  const latest = info.latestVersion;
  if (typeof current === 'string' && typeof latest === 'string') {
    const comparison = compareMajor(current, latest);
    if (comparison === 'behind-major') {
      notes.push(`${normalizeDisplay(current)} → ${latest} available`);
      return 'outdated';
    }
    if (comparison === 'equal') {
      return 'current';
    }
    // 'ahead', 'behind-minor', or 'unparseable' → not enough signal.
    return 'unknown';
  }

  return 'unknown';
}

interface Semver {
  major: number;
  minor: number;
  patch: number;
}

/** Parse a semver-ish string, tolerating range prefixes (`^`, `~`, `v`, `>=`). */
function parseSemver(version: string): Semver | null {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version.trim());
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  if (Number.isNaN(major)) {
    return null;
  }
  const minor = match[2] === undefined ? 0 : Number(match[2]);
  const patch = match[3] === undefined ? 0 : Number(match[3]);
  return { major, minor, patch };
}

type MajorComparison = 'equal' | 'behind-major' | 'behind-minor' | 'ahead' | 'unparseable';

/** Compare a current version against latest at major granularity. */
function compareMajor(current: string, latest: string): MajorComparison {
  const a = parseSemver(current);
  const b = parseSemver(latest);
  if (!a || !b) {
    return 'unparseable';
  }
  if (b.major > a.major) {
    return 'behind-major';
  }
  if (b.major < a.major) {
    return 'ahead';
  }
  // Same major.
  if (b.minor > a.minor || (b.minor === a.minor && b.patch > a.patch)) {
    return 'behind-minor';
  }
  if (b.minor < a.minor || b.patch < a.patch) {
    return 'ahead';
  }
  return 'equal';
}

/** Strip a leading range operator for cleaner note display. */
function normalizeDisplay(version: string): string {
  return version.replace(/^[\^~>=<\sv]+/, '') || version;
}

const COPYLEFT = /\b(?:A?GPL|LGPL|MPL|EPL|CDDL)\b/i;
const PERMISSIVE = /\b(?:MIT|ISC|BSD|Apache|Unlicense|0BSD|Zlib)\b/i;

/** A cheap permissive-vs-copyleft hint; returns undefined when unclear. */
function licenseNoteFor(license: string): string | undefined {
  if (COPYLEFT.test(license)) {
    return `copyleft license (${license})`;
  }
  if (PERMISSIVE.test(license)) {
    return `permissive license (${license})`;
  }
  return undefined;
}

function emptyCounts(): Record<DependencyStatus, number> {
  return {
    current: 0,
    outdated: 0,
    vulnerable: 0,
    unmaintained: 0,
    unknown: 0,
  };
}

function uniqueEcosystems(deps: DependencyInput[]): DependencyEcosystem[] {
  const seen = new Set<DependencyEcosystem>();
  const ordered: DependencyEcosystem[] = [];
  for (const dep of deps) {
    if (!seen.has(dep.ecosystem)) {
      seen.add(dep.ecosystem);
      ordered.push(dep.ecosystem);
    }
  }
  return ordered;
}

function buildSummary(counts: Record<DependencyStatus, number>, total: number): string {
  const noun = total === 1 ? 'dependency' : 'dependencies';
  if (total === 0) {
    return 'No dependencies analyzed.';
  }

  const parts: string[] = [];
  for (const status of ALL_STATUSES) {
    if (status === 'current') {
      continue;
    }
    const n = counts[status];
    if (n > 0) {
      parts.push(`${n} ${status}`);
    }
  }

  if (parts.length === 0) {
    return `All ${total} ${noun} current.`;
  }
  return `${parts.join(', ')} across ${total} ${noun}.`;
}
