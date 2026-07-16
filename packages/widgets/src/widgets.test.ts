import { computeBeaconScore, demoHealthySnapshot, HeuristicProvider } from '@beacon/core';
import type { BeaconAnalysis } from '@beacon/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  embedSnippets,
  maintenanceStatus,
  renderMaintenanceBadge,
  renderWidget,
  WIDGET_TYPES,
} from './index';

let analysis: BeaconAnalysis;

beforeAll(async () => {
  const score = computeBeaconScore(demoHealthySnapshot);
  const summary = await new HeuristicProvider().generateSummary({ snapshot: demoHealthySnapshot, score });
  analysis = { snapshot: demoHealthySnapshot, score, summary };
});

describe('renderWidget', () => {
  it('renders every widget type as valid SVG containing the repo name', () => {
    for (const type of WIDGET_TYPES) {
      const out = renderWidget(type, analysis);
      expect(out.startsWith('<svg')).toBe(true);
      expect(out.trim().endsWith('</svg>')).toBe(true);
      // Badge encodes "beacon"; cards encode the repo name.
      if (type !== 'badge') {
        expect(out).toContain('aurora');
      }
    }
  });

  it('supports all themes and sizes', () => {
    for (const theme of ['dark', 'light', 'transparent'] as const) {
      for (const size of ['small', 'medium', 'large'] as const) {
        const out = renderWidget('health', analysis, { theme, size });
        expect(out).toContain('<svg');
        expect(out).toContain(String(analysis.score.total));
      }
    }
  });

  it('escapes XML-significant characters', () => {
    const evil: BeaconAnalysis = {
      ...analysis,
      snapshot: {
        ...analysis.snapshot,
        metadata: { ...analysis.snapshot.metadata, description: 'a < b & c > d "quote"' },
      },
    };
    const out = renderWidget('health', evil);
    expect(out).not.toContain('< b & c >');
    expect(out).toContain('&lt; b &amp; c &gt;');
  });
});

describe('renderMaintenanceBadge', () => {
  it('shows score and status', () => {
    const out = renderMaintenanceBadge(analysis);
    expect(out).toContain('beacon');
    expect(out).toContain(String(analysis.score.total));
    expect(out).toContain(maintenanceStatus(analysis.score));
  });
});

describe('embedSnippets', () => {
  it('builds url, markdown, and html embeds', () => {
    const s = embedSnippets('https://beacon.example.com', 'facebook', 'react', 'health', {
      theme: 'dark',
    });
    expect(s.url).toBe('https://beacon.example.com/widget/health/facebook/react?theme=dark');
    expect(s.markdown).toContain('![');
    expect(s.html).toContain('<img');
  });

  it('routes the badge type to /badge', () => {
    const s = embedSnippets('https://beacon.example.com', 'a', 'b', 'badge');
    expect(s.url).toBe('https://beacon.example.com/badge/a/b');
  });
});
