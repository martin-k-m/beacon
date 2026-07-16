import { analyzeSnapshot } from '@beacon/analytics';
import { demoSnapshots } from '@beacon/shared';
import { describe, expect, it } from 'vitest';

import { renderAnalysis } from './render';

/** Grab a stable demo snapshot to render offline (no network involved). */
function firstDemo() {
  const entry = Object.entries(demoSnapshots)[0];
  if (!entry) {
    throw new Error('Expected at least one demo snapshot fixture.');
  }
  return entry;
}

describe('renderAnalysis', () => {
  it('renders a demo analysis without color', async () => {
    const [, snapshot] = firstDemo();
    const analysis = await analyzeSnapshot(snapshot, { ai: { provider: 'heuristic' } });

    const output = renderAnalysis(analysis, { color: false });

    expect(output).toContain(analysis.snapshot.metadata.fullName);
    expect(output).toContain('/100');
    expect(output).toContain('Beacon Summary');
  });

  it('emits no ANSI escape codes when color is disabled', async () => {
    const [, snapshot] = firstDemo();
    const analysis = await analyzeSnapshot(snapshot, { ai: { provider: 'heuristic' } });

    const output = renderAnalysis(analysis, { color: false });

    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\[/);
  });

  it('includes each pillar in the breakdown', async () => {
    const [, snapshot] = firstDemo();
    const analysis = await analyzeSnapshot(snapshot, { ai: { provider: 'heuristic' } });

    const output = renderAnalysis(analysis, { color: false });

    for (const pillar of analysis.score.pillars) {
      expect(output.toLowerCase()).toContain(pillar.pillar.toLowerCase());
    }
  });
});
