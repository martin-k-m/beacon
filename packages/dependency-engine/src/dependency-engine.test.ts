import { describe, expect, it } from 'vitest';

import { analyzeDependencies, fromManifests } from './engine';
import { OfflineRegistryClient } from './registry-clients';
import type {
  DependencyEcosystem,
  DependencyInput,
  RegistryClient,
  RegistryPackageInfo,
} from './types';

/**
 * A fully offline registry returning controlled data keyed by package name.
 * Unknown names resolve to `null`, mirroring an unreachable/absent package.
 */
class MockRegistryClient implements RegistryClient {
  private readonly data: Map<string, RegistryPackageInfo | null>;

  public constructor(entries: Record<string, RegistryPackageInfo | null>) {
    this.data = new Map(Object.entries(entries));
  }

  public getPackage(
    _ecosystem: DependencyEcosystem,
    name: string,
  ): Promise<RegistryPackageInfo | null> {
    return Promise.resolve(this.data.get(name) ?? null);
  }
}

// Fixed clock: 2026-07-16.
const NOW = Date.parse('2026-07-16T00:00:00.000Z');
const now = (): number => NOW;

const deps: DependencyInput[] = [
  { name: 'deprecated-pkg', ecosystem: 'npm', currentVersion: '1.0.0' },
  { name: 'behind-pkg', ecosystem: 'npm', currentVersion: '1.2.3' },
  { name: 'current-pkg', ecosystem: 'npm', currentVersion: '4.5.6' },
  { name: 'mystery-pkg', ecosystem: 'npm', currentVersion: '2.0.0' },
];

const registry = new MockRegistryClient({
  'deprecated-pkg': {
    latestVersion: '1.0.0',
    deprecated: true,
    lastPublished: '2026-06-01T00:00:00.000Z',
    license: 'MIT',
  },
  'behind-pkg': {
    latestVersion: '3.0.0',
    deprecated: false,
    lastPublished: '2026-05-01T00:00:00.000Z',
    license: 'MIT',
  },
  'current-pkg': {
    latestVersion: '4.5.6',
    deprecated: false,
    lastPublished: '2026-07-01T00:00:00.000Z',
    license: 'Apache-2.0',
  },
  // mystery-pkg intentionally absent → null → unknown.
});

describe('analyzeDependencies (offline, mocked registry)', () => {
  it('classifies each dependency by the priority rules', async () => {
    const report = await analyzeDependencies(deps, { registry, now });
    const byName = new Map(report.dependencies.map((d) => [d.name, d]));

    expect(byName.get('deprecated-pkg')?.status).toBe('unmaintained');
    expect(byName.get('deprecated-pkg')?.notes).toContain('package is deprecated');

    expect(byName.get('behind-pkg')?.status).toBe('outdated');
    expect(byName.get('behind-pkg')?.latestVersion).toBe('3.0.0');
    expect(byName.get('behind-pkg')?.notes).toContain('1.2.3 → 3.0.0 available');

    expect(byName.get('current-pkg')?.status).toBe('current');

    expect(byName.get('mystery-pkg')?.status).toBe('unknown');
  });

  it('carries the license through when available', async () => {
    const report = await analyzeDependencies(deps, { registry, now });
    const current = report.dependencies.find((d) => d.name === 'current-pkg');
    expect(current?.license).toBe('Apache-2.0');
  });

  it('reports correct counts and summary', async () => {
    const report = await analyzeDependencies(deps, { registry, now });

    expect(report.counts).toEqual({
      current: 1,
      outdated: 1,
      vulnerable: 0,
      unmaintained: 1,
      unknown: 1,
    });
    expect(report.summary).toBe('1 outdated, 1 unmaintained, 1 unknown across 4 dependencies.');
    expect(report.ecosystems).toEqual(['npm']);
    expect(report.generatedAt).toBe('2026-07-16T00:00:00.000Z');
  });

  it('flags a stale package with no recent release as unmaintained', async () => {
    const stale = new MockRegistryClient({
      'old-pkg': {
        latestVersion: '1.0.0',
        deprecated: false,
        lastPublished: '2021-01-01T00:00:00.000Z',
      },
    });
    const report = await analyzeDependencies(
      [{ name: 'old-pkg', ecosystem: 'npm', currentVersion: '1.0.0' }],
      { registry: stale, now },
    );
    expect(report.dependencies[0]?.status).toBe('unmaintained');
    expect(report.dependencies[0]?.notes?.[0]).toMatch(/no release in/);
  });

  it('summarizes an all-current set', async () => {
    const report = await analyzeDependencies(
      [{ name: 'current-pkg', ecosystem: 'npm', currentVersion: '4.5.6' }],
      { registry, now },
    );
    expect(report.summary).toBe('All 1 dependency current.');
  });

  it('handles an empty dependency set', async () => {
    const report = await analyzeDependencies([], { registry, now });
    expect(report.summary).toBe('No dependencies analyzed.');
    expect(report.dependencies).toHaveLength(0);
    expect(report.ecosystems).toEqual([]);
  });
});

describe('OfflineRegistryClient', () => {
  it('classifies every dependency as unknown', async () => {
    const report = await analyzeDependencies(deps, {
      registry: new OfflineRegistryClient(),
      now,
    });
    expect(report.dependencies.every((d) => d.status === 'unknown')).toBe(true);
    expect(report.counts.unknown).toBe(deps.length);
    expect(report.summary).toBe('4 unknown across 4 dependencies.');
  });
});

describe('fromManifests', () => {
  it('returns an empty list (snapshots record presence, not the dep list)', () => {
    const inputs = fromManifests([{ ecosystem: 'npm', path: 'package.json', dependencyCount: 12 }]);
    expect(inputs).toEqual([]);
  });
});
