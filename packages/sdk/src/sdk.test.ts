import { demoHealthySnapshot } from '@beacon/shared';
import { describe, expect, it } from 'vitest';

import { Beacon, BEACON_SDK_VERSION } from './index';

describe('Beacon SDK', () => {
  it('exposes the package version', () => {
    expect(BEACON_SDK_VERSION).toBe('0.1.0');
  });

  it('scores and summarizes a snapshot offline', async () => {
    const beacon = new Beacon();
    const analysis = await beacon.analyzeSnapshot(demoHealthySnapshot);

    expect(analysis.snapshot).toBe(demoHealthySnapshot);
    expect(analysis.score).toBeDefined();
    expect(typeof analysis.score.total).toBe('number');
    expect(analysis.score.total).toBeGreaterThanOrEqual(0);
    expect(analysis.score.total).toBeLessThanOrEqual(100);
    expect(analysis.summary.text.length).toBeGreaterThan(0);
  });

  it('builds widget and badge URLs for the configured apiUrl', () => {
    const beacon = new Beacon({ apiUrl: 'https://beacon.example.com/' });

    expect(beacon.widgetUrl('facebook/react')).toBe(
      'https://beacon.example.com/widget/health/facebook/react',
    );
    expect(beacon.widgetUrl('facebook/react', 'activity', { theme: 'dark', size: 'large' })).toBe(
      'https://beacon.example.com/widget/activity/facebook/react?theme=dark&size=large',
    );
    expect(beacon.widgetUrl('facebook/react', 'badge')).toBe(
      'https://beacon.example.com/badge/facebook/react',
    );
  });

  it('throws a clear error when widgetUrl has no apiUrl', () => {
    const beacon = new Beacon();
    expect(() => beacon.widgetUrl('facebook/react')).toThrow(/apiUrl/);
  });

  it('throws a clear error for direct-mode analyze with no token', async () => {
    const beacon = new Beacon();
    await expect(beacon.analyze('facebook/react', { source: 'github' })).rejects.toThrow(
      /No GitHub token/,
    );
  });

  it('throws a clear error for trend in direct mode', async () => {
    const beacon = new Beacon();
    await expect(beacon.trend('facebook/react')).rejects.toThrow(/requires the API/);
  });
});
