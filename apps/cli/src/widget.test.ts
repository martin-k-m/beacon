import { describe, expect, it } from 'vitest';

import { resolveAnalysis } from './analysis';
import {
  buildBadge,
  buildWidget,
  formatDelta,
  formatEmbedSnippets,
  formatWatchLine,
  normalizeSize,
  normalizeTheme,
  ownerRepo,
} from './widget';
import { createPalette } from './render';

const REPO = 'beacon-labs/aurora';

/** Resolve the bundled demo analysis offline (no network involved). */
function demoAnalysis() {
  return resolveAnalysis(REPO, { demo: true, ai: { provider: 'heuristic' } });
}

describe('buildWidget', () => {
  it('renders an SVG and embed snippets for the demo repo', async () => {
    const analysis = await demoAnalysis();

    const { svg, snippets } = buildWidget(analysis, {
      type: 'health',
      host: 'https://beacon.example.com',
      theme: 'dark',
      size: 'medium',
    });

    expect(svg.trimStart().startsWith('<svg')).toBe(true);
    expect(snippets.url).toContain('/widget/health/beacon-labs/aurora');
    expect(snippets.markdown).toContain('![');
    expect(snippets.markdown).toContain(snippets.url);
    expect(snippets.html).toContain('<img');
  });

  it('rejects the badge type (it has its own command)', async () => {
    const analysis = await demoAnalysis();
    expect(() =>
      buildWidget(analysis, {
        type: 'badge',
        host: 'https://beacon.example.com',
        theme: 'dark',
        size: 'medium',
      }),
    ).toThrow();
  });

  it('rejects an unknown widget type', async () => {
    const analysis = await demoAnalysis();
    expect(() =>
      buildWidget(analysis, {
        type: 'nope',
        host: 'https://beacon.example.com',
        theme: 'dark',
        size: 'medium',
      }),
    ).toThrow();
  });
});

describe('buildBadge', () => {
  it('renders a badge SVG and badge-typed snippets', async () => {
    const analysis = await demoAnalysis();

    const { svg, snippets } = buildBadge(analysis, {
      host: 'https://beacon.example.com',
      theme: 'dark',
      size: 'small',
    });

    expect(svg.trimStart().startsWith('<svg')).toBe(true);
    expect(snippets.url).toContain('/badge/beacon-labs/aurora');
    expect(snippets.markdown).toContain('![');
  });
});

describe('ownerRepo', () => {
  it('derives owner/repo from the analysis metadata', async () => {
    const analysis = await demoAnalysis();
    expect(ownerRepo(analysis)).toEqual({ owner: 'beacon-labs', repo: 'aurora' });
  });
});

describe('formatEmbedSnippets', () => {
  it('emits an ANSI-free block with no color', async () => {
    const analysis = await demoAnalysis();
    const { snippets } = buildWidget(analysis, {
      type: 'health',
      host: 'https://beacon.example.com',
      theme: 'dark',
      size: 'medium',
    });

    const block = formatEmbedSnippets(snippets, { color: false });

    expect(block).toContain('Embed');
    expect(block).toContain(snippets.url);
    expect(block).toContain(snippets.markdown);
    expect(block).toContain(snippets.html);
    // eslint-disable-next-line no-control-regex
    expect(block).not.toMatch(/\[/);
  });

  it('omits the HTML section in markdown-only mode', async () => {
    const analysis = await demoAnalysis();
    const { snippets } = buildBadge(analysis, {
      host: 'https://beacon.example.com',
      theme: 'dark',
      size: 'small',
    });

    const block = formatEmbedSnippets(snippets, { color: false, markdownOnly: true });

    expect(block).toContain(snippets.markdown);
    expect(block).not.toContain('HTML');
  });
});

describe('formatDelta', () => {
  const palette = createPalette(false);

  it('renders an em dash for the first (unknown) poll', () => {
    expect(formatDelta(80, null, palette)).toBe('—');
  });

  it('renders a signed positive delta', () => {
    expect(formatDelta(82, 80, palette)).toBe('+2');
  });

  it('renders a signed negative delta', () => {
    expect(formatDelta(79, 80, palette)).toBe('-1');
  });

  it('renders an em dash for no change', () => {
    expect(formatDelta(80, 80, palette)).toBe('—');
  });
});

describe('formatWatchLine', () => {
  it('includes the repo, score, grade, and delta', () => {
    const line = formatWatchLine('beacon-labs/aurora', 87, 'Healthy', 85, {
      color: false,
      timestamp: new Date('2026-07-16T00:00:00.000Z'),
    });

    expect(line).toContain('2026-07-16T00:00:00.000Z');
    expect(line).toContain('beacon-labs/aurora');
    expect(line).toContain('87/100');
    expect(line).toContain('Healthy');
    expect(line).toContain('+2');
  });
});

describe('normalizeTheme / normalizeSize', () => {
  it('accepts valid values and rejects invalid ones', () => {
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeSize('large')).toBe('large');
    expect(() => normalizeTheme('rainbow')).toThrow();
    expect(() => normalizeSize('enormous')).toThrow();
  });
});
