import { describe, expect, it } from 'vitest';

import { renderScoreLine, starRating } from './render';

describe('starRating', () => {
  it('rounds a 0–100 score to five stars', () => {
    expect(starRating(100)).toBe('★★★★★');
    expect(starRating(96)).toBe('★★★★★'); // round(96/20) = 5
    expect(starRating(90)).toBe('★★★★★'); // round(90/20) = 5 (4.5 → 5)
    expect(starRating(70)).toBe('★★★★☆'); // round(70/20) = 4 (3.5 → 4)
    expect(starRating(50)).toBe('★★★☆☆'); // round(50/20) = 3 (2.5 → 3)
    expect(starRating(0)).toBe('☆☆☆☆☆');
  });

  it('always returns exactly five glyphs', () => {
    for (const score of [0, 13, 27, 41, 58, 73, 88, 99, 100]) {
      expect(starRating(score)).toHaveLength(5);
    }
  });
});

describe('renderScoreLine', () => {
  it('renders the compact score + stars without color', () => {
    const line = renderScoreLine(96, 'Excellent', { color: false });
    expect(line).toContain('Beacon Score:');
    expect(line).toContain('96/100');
    expect(line).toContain('★★★★★');
    expect(line).toContain('Excellent');
  });

  it('emits no ANSI escape codes when color is disabled', () => {
    const line = renderScoreLine(42, 'At risk', { color: false });
    // eslint-disable-next-line no-control-regex
    expect(line).not.toMatch(/\[/);
  });
});
