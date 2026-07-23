import type { BeaconPlugin } from '@beacon/plugins';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app';
import { cache } from '../cache';
import { registry } from '../plugins';
import { getDemoAnalyses } from '../service';

/**
 * Route-level coverage for the plugin surface, driven through the real Fastify
 * app via `inject` — no network, no database, no GitHub.
 *
 * Widget routes resolve their analysis through `getAnalysis`, whose read path is
 * cache -> store -> live GitHub. Priming the (in-memory) cache with a bundled
 * demo analysis therefore exercises the real route end to end while staying
 * completely offline, rather than stubbing the service.
 */

const DEMO_REPO = 'beacon-labs/aurora';

const widgetPlugin: BeaconPlugin = {
  name: 'route-test-plugin',
  version: '0.0.1',
  analyzers: [
    {
      name: 'star-counter',
      // Reads real snapshot data, proving the context is wired through.
      run: (ctx) => [{ key: 'stars', label: 'Stars', value: ctx.snapshot.metadata.stars }],
    },
  ],
  recommenders: [
    {
      name: 'always-advises',
      run: () => [
        {
          id: 'route-test-rec',
          title: 'Test rec',
          recommendation: 'Do the thing',
          severity: 'low',
        },
      ],
    },
  ],
  widgets: [{ type: 'route-test-card', render: () => '<svg id="from-plugin" />' }],
};

// A plugin whose widget throws — the registry logs it and yields null, which the
// route must turn into the standard "unavailable" card, never a 500.
const brokenPlugin: BeaconPlugin = {
  name: 'route-test-broken',
  widgets: [
    {
      type: 'route-test-broken-card',
      render: () => {
        throw new Error('boom');
      },
    },
  ],
};

let app: FastifyInstance;

beforeAll(async () => {
  registry.register(widgetPlugin).register(brokenPlugin);
  app = await buildApp();
  await app.ready();

  // Prime the cache so getAnalysis resolves the demo repo without any I/O.
  const [demo] = await getDemoAnalyses();
  if (!demo) throw new Error('expected at least one demo analysis');
  await cache.set(`analysis:${DEMO_REPO}`, demo, 600);
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/plugins', () => {
  it('lists registered plugins and their contributions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/plugins' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as { plugins: { name: string; widgets: string[] }[] };
    const found = body.plugins.find((p) => p.name === 'route-test-plugin');
    expect(found).toBeDefined();
    expect(found?.widgets).toContain('route-test-card');
  });
});

describe('GET /api/repositories/:owner/:repo/plugins', () => {
  it('runs analyzers and recommenders against the real analysis', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/repositories/${DEMO_REPO}/plugins` });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      metrics: { key: string; value: number | string }[];
      recommendations: { id: string }[];
    };

    // The analyzer read snapshot.metadata.stars — a real value, not a constant.
    const stars = body.metrics.find((m) => m.key === 'stars');
    expect(stars).toBeDefined();
    expect(typeof stars?.value).toBe('number');

    expect(body.recommendations.map((r) => r.id)).toContain('route-test-rec');
  });

  it('rejects a malformed repo identifier', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/repositories//x/plugins' });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('GET /widget/:type — plugin contributors', () => {
  it('renders a widget contributed by a plugin through the built-in route', async () => {
    const res = await app.inject({ method: 'GET', url: `/widget/route-test-card/${DEMO_REPO}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toContain('from-plugin');
  });

  it('still 404s an unknown type, and names plugin types in the hint', async () => {
    const res = await app.inject({ method: 'GET', url: `/widget/not-a-real-type/${DEMO_REPO}` });
    expect(res.statusCode).toBe(404);

    const body = res.json() as { error: string; hint: string };
    expect(body.error).toContain('not-a-real-type');
    // The hint should advertise what plugins actually offer.
    expect(body.hint).toContain('route-test-card');
  });

  it('degrades a throwing plugin widget to the unavailable card, not a 500', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/widget/route-test-broken-card/${DEMO_REPO}`,
    });
    // An embedded <img> must never break, so this is a 200 SVG.
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toContain('unavailable');
  });

  it('does not shadow built-in widget types', async () => {
    // 'health' must still resolve to the built-in renderer even with plugins
    // registered; only unknown types fall through to the registry.
    const res = await app.inject({ method: 'GET', url: `/widget/health/${DEMO_REPO}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).not.toContain('from-plugin');
  });
});
