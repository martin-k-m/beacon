import { resolve } from 'node:path';

import type { BeaconPlugin } from '@beacon/plugins';
import { describe, expect, it } from 'vitest';

import { describePlugins, loadPlugins, registry, resolveSpecifier } from './plugins';

/**
 * These tests cover the loader contract that stands between an operator's
 * `BEACON_PLUGINS` value and the registry: what counts as a plugin, and — more
 * importantly — that nothing an operator can misconfigure is able to throw. The
 * registry's own behaviour (failure isolation, dedupe) is tested in
 * @beacon/plugins; here we prove the API's wiring around it.
 *
 * Note `loadPlugins` imports by specifier, so these use real registration via
 * the exported registry rather than fabricating module resolution.
 */

const samplePlugin: BeaconPlugin = {
  name: 'test-sample',
  version: '1.0.0',
  analyzers: [{ name: 'counts', run: () => [{ key: 'k', label: 'K', value: 1 }] }],
  recommenders: [
    { name: 'advice', run: () => [{ id: 'r1', title: 'T', recommendation: 'Do it' }] },
  ],
  widgets: [{ type: 'sample-card', render: () => '<svg />' }],
};

describe('loadPlugins', () => {
  it('is a no-op when nothing is configured', async () => {
    const result = await loadPlugins([]);
    expect(result.loaded).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('reports an unresolvable module instead of throwing', async () => {
    // The whole point: a typo in BEACON_PLUGINS must not stop the API booting.
    const result = await loadPlugins(['./definitely-not-a-real-module-xyz']);
    expect(result.loaded).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.specifier).toBe('./definitely-not-a-real-module-xyz');
    expect(result.failed[0]?.reason).toBeTruthy();
  });

  it('survives a mix of bad specifiers without rejecting', async () => {
    const result = await loadPlugins(['./nope-one', './nope-two']);
    expect(result.failed).toHaveLength(2);
    expect(result.loaded).toEqual([]);
  });
});

describe('resolveSpecifier', () => {
  it('resolves a relative specifier against the working directory, not the loader', () => {
    // The loader lives in apps/api/dist/, so an unresolved './x.js' would look
    // inside the build output instead of where the operator started the server.
    const resolved = resolveSpecifier('./my-plugin.js', '/srv/beacon');
    expect(resolved).toContain('my-plugin.js');
    expect(resolved).not.toBe('./my-plugin.js');
    expect(resolved.toLowerCase()).toContain('srv');
  });

  it('leaves a bare package specifier untouched so node resolution applies', () => {
    expect(resolveSpecifier('@acme/beacon-plugin', '/srv/beacon')).toBe('@acme/beacon-plugin');
    expect(resolveSpecifier('beacon-plugin-audit', '/srv/beacon')).toBe('beacon-plugin-audit');
  });

  it('passes an absolute path through unchanged', () => {
    const abs = resolve('/opt/plugins/audit.js');
    expect(resolveSpecifier(abs, '/srv/beacon')).toBe(abs);
  });
});

describe('describePlugins', () => {
  it('describes what a registered plugin contributes', () => {
    registry.register(samplePlugin);

    const described = describePlugins().find((p) => p.name === 'test-sample');
    expect(described).toBeDefined();
    expect(described?.version).toBe('1.0.0');
    expect(described?.analyzers).toEqual(['counts']);
    expect(described?.recommenders).toEqual(['advice']);
    expect(described?.widgets).toEqual(['sample-card']);
  });

  it('reports a missing version as null rather than undefined', () => {
    registry.register({ name: 'test-versionless' });
    const described = describePlugins().find((p) => p.name === 'test-versionless');
    expect(described?.version).toBeNull();
    expect(described?.analyzers).toEqual([]);
  });
});
