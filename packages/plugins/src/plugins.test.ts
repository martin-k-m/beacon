import { computeBeaconScore } from '@beacon/analytics';
import type { BeaconAnalysis, BeaconSummary } from '@beacon/shared';
import { demoAtRiskSnapshot } from '@beacon/shared';
import { describe, expect, it, vi } from 'vitest';
import { examplePlugins, staleReleasePlugin } from './examplePlugins';
import { PluginRegistry } from './registry';
import type { BeaconPlugin, PluginContext } from './types';

function buildContext(): PluginContext {
  const snapshot = demoAtRiskSnapshot;
  const score = computeBeaconScore(snapshot);
  const summary: BeaconSummary = {
    provider: 'test',
    model: null,
    text: 'A minimal hand-built summary for tests.',
    highlights: [],
    generatedAt: snapshot.collectedAt,
  };
  const analysis: BeaconAnalysis = { snapshot, score, summary };
  return { snapshot, analysis };
}

describe('PluginRegistry with example plugins', () => {
  it('runs analyzers and produces the days-since-release metric', async () => {
    const registry = new PluginRegistry();
    for (const plugin of examplePlugins) registry.register(plugin);

    const metrics = await registry.runAnalyzers(buildContext());
    const releaseMetric = metrics.find((m) => m.key === 'daysSinceLastRelease');
    expect(releaseMetric).toBeDefined();
    expect(typeof releaseMetric?.value).toBe('number');
  });

  it('runs recommenders and flags the missing security policy', async () => {
    const registry = new PluginRegistry();
    for (const plugin of examplePlugins) registry.register(plugin);

    const recommendations = await registry.runRecommenders(buildContext());
    // demoAtRiskSnapshot has hasSecurityPolicy: false.
    expect(recommendations.some((r) => r.id === 'security-policy-missing')).toBe(true);
  });

  it('isolates a throwing plugin without failing the batch', async () => {
    const onError = vi.fn();
    const registry = new PluginRegistry({ onError });

    const exploding: BeaconPlugin = {
      name: 'test:exploding',
      analyzers: [
        {
          name: 'boom',
          run() {
            throw new Error('kaboom');
          },
        },
      ],
    };

    registry.register(exploding);
    for (const plugin of examplePlugins) registry.register(plugin);

    const metrics = await registry.runAnalyzers(buildContext());
    // The good plugin's metric still comes through.
    expect(metrics.some((m) => m.key === 'daysSinceLastRelease')).toBe(true);
    // The failure was logged, not thrown.
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('deduplicates plugin names with last-wins semantics', () => {
    const registry = new PluginRegistry();
    const first: BeaconPlugin = { name: 'dup', version: '1.0.0' };
    const second: BeaconPlugin = { name: 'dup', version: '2.0.0' };
    registry.register(first).register(second);

    expect(registry.plugins).toHaveLength(1);
    expect(registry.plugins[0]?.version).toBe('2.0.0');
  });

  it('exposes widget types and renders a matching widget', () => {
    const registry = new PluginRegistry();
    registry.register(staleReleasePlugin);

    const types = registry.listWidgetTypes();
    expect(types).toContain('release-freshness');

    const ctx = buildContext();
    const svg = registry.widget('release-freshness', ctx);
    expect(svg).toContain('<svg');
    expect(registry.widget('does-not-exist', ctx)).toBeNull();
  });
});
