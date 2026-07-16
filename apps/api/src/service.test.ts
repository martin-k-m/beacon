import { describe, expect, it } from 'vitest';

import { getDemoAnalyses } from './service';

/**
 * These tests exercise only the fully-offline demo path: no GitHub, no Redis,
 * and no database are touched. They guarantee the zero-config guarantee that
 * `GET /api/demo` depends on.
 */
describe('getDemoAnalyses', () => {
  it('returns analyses for every demo repository without external I/O', async () => {
    const analyses = await getDemoAnalyses();

    expect(analyses.length).toBeGreaterThanOrEqual(2);

    for (const analysis of analyses) {
      // Structural completeness.
      expect(analysis.snapshot).toBeTruthy();
      expect(analysis.score).toBeTruthy();
      expect(analysis.summary).toBeTruthy();

      // Sensible score bounds.
      expect(analysis.score.total).toBeGreaterThanOrEqual(0);
      expect(analysis.score.total).toBeLessThanOrEqual(100);
      expect(analysis.score.pillars.length).toBeGreaterThan(0);

      // Every pillar score is within range and carries a weight.
      for (const pillar of analysis.score.pillars) {
        expect(pillar.score).toBeGreaterThanOrEqual(0);
        expect(pillar.score).toBeLessThanOrEqual(100);
        expect(pillar.weight).toBeGreaterThan(0);
      }

      // The offline heuristic provider is used with zero config.
      expect(analysis.summary.provider).toBe('heuristic');
      expect(analysis.summary.text.length).toBeGreaterThan(0);
    }
  });

  it('produces a distinct score for the healthy vs at-risk demo repos', async () => {
    const analyses = await getDemoAnalyses();
    const scores = analyses.map((a) => a.score.total);
    const unique = new Set(scores);
    // The fixtures are deliberately different, so scores should differ.
    expect(unique.size).toBeGreaterThan(1);
  });
});
