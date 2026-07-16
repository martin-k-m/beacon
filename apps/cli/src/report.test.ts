import { analyzeSnapshot } from '@beacon/analytics';
import { demoSnapshots, type BeaconAnalysis } from '@beacon/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderReport, renderReportHtml, renderReportJson, renderReportMarkdown } from './report';

let analysis: BeaconAnalysis;

beforeAll(async () => {
  const snapshot = Object.values(demoSnapshots)[0];
  if (!snapshot) {
    throw new Error('Expected at least one demo snapshot.');
  }
  analysis = await analyzeSnapshot(snapshot, { ai: { provider: 'heuristic' } });
});

describe('renderReportMarkdown', () => {
  it('includes the repo, score, pillars, and summary', () => {
    const md = renderReportMarkdown(analysis);
    expect(md).toContain(`# Beacon Report — ${analysis.snapshot.metadata.fullName}`);
    expect(md).toContain('## Beacon Score');
    expect(md).toContain(`${analysis.score.total}/100`);
    expect(md).toContain('## Pillars');
    expect(md).toContain('## Beacon Summary');
    expect(md).toContain(analysis.summary.text);
  });

  it('renders a five-star rating', () => {
    const md = renderReportMarkdown(analysis);
    expect(md).toMatch(/[★☆]{5}/);
  });
});

describe('renderReportHtml', () => {
  it('is a self-contained HTML document', () => {
    const html = renderReportHtml(analysis);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Beacon Report');
    expect(html).toContain('<style>');
    expect(html).not.toContain('http://cdn'); // no external assets
    expect(html).toContain(analysis.snapshot.metadata.fullName);
  });

  it('escapes HTML-significant characters', () => {
    const withMarkup: BeaconAnalysis = {
      ...analysis,
      snapshot: {
        ...analysis.snapshot,
        metadata: { ...analysis.snapshot.metadata, description: '<script>alert(1)</script>' },
      },
    };
    const html = renderReportHtml(withMarkup);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderReportJson', () => {
  it('round-trips the analysis', () => {
    const parsed = JSON.parse(renderReportJson(analysis)) as BeaconAnalysis;
    expect(parsed.score.total).toBe(analysis.score.total);
  });
});

describe('renderReport dispatch', () => {
  it('routes to the requested format', () => {
    expect(renderReport(analysis, 'json').startsWith('{')).toBe(true);
    expect(renderReport(analysis, 'html').startsWith('<!doctype')).toBe(true);
    expect(renderReport(analysis, 'markdown').startsWith('# Beacon Report')).toBe(true);
  });
});
