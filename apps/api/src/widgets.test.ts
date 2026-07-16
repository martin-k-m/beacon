import { isWidgetType, renderWidget, WIDGET_TYPES } from '@beacon/widgets';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { errorBadge } from './routes/widgets';
import { getDemoAnalyses } from './service';
import { verifySignature } from './webhooks-verify';

/**
 * Fully offline: exercises widget rendering through the demo analysis path (no
 * GitHub, DB, or Redis), plus the pure helpers that back the widget and webhook
 * routes.
 */
describe('renderWidget (demo path)', () => {
  it('renders every widget type as a standalone SVG for a demo repo', async () => {
    const [analysis] = await getDemoAnalyses();
    expect(analysis).toBeTruthy();

    for (const type of WIDGET_TYPES) {
      const svg = renderWidget(type, analysis!);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.trim().endsWith('</svg>')).toBe(true);
    }
  });
});

describe('isWidgetType gating', () => {
  it('accepts known types and rejects unknown ones', () => {
    for (const type of WIDGET_TYPES) {
      expect(isWidgetType(type)).toBe(true);
    }
    expect(isWidgetType('bogus')).toBe(false);
    expect(isWidgetType('')).toBe(false);
    expect(isWidgetType('HEALTH')).toBe(false);
  });
});

describe('errorBadge', () => {
  it('returns a well-formed SVG containing the beacon label and message', () => {
    const svg = errorBadge('unavailable');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('beacon');
    expect(svg).toContain('unavailable');
  });

  it('escapes XML-significant characters in the message', () => {
    const svg = errorBadge('<script>&"');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;');
  });
});

describe('verifySignature', () => {
  const secret = 'test-secret';
  const body = Buffer.from(JSON.stringify({ zen: 'Keep it logically awesome.' }));
  const valid = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a correct signature over the raw body', () => {
    expect(verifySignature(body, valid, secret)).toBe(true);
  });

  it('accepts a string body identical to the raw bytes', () => {
    expect(verifySignature(body.toString('utf8'), valid, secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = Buffer.from(JSON.stringify({ zen: 'tampered' }));
    expect(verifySignature(tampered, valid, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(verifySignature(body, valid, 'other-secret')).toBe(false);
  });

  it('rejects missing or malformed signatures', () => {
    expect(verifySignature(body, undefined, secret)).toBe(false);
    expect(verifySignature(body, '', secret)).toBe(false);
    expect(verifySignature(body, 'sha1=abc', secret)).toBe(false);
    expect(verifySignature(body, 'sha256=', secret)).toBe(false);
  });
});
