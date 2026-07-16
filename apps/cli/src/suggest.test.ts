import { describe, expect, it } from 'vitest';

import { formatUnknownCommand, levenshtein, suggestCommands } from './suggest';

const COMMANDS = [
  'analyze',
  'score',
  'widget',
  'badge',
  'watch',
  'report',
  'dashboard',
  'init',
  'login',
  'logout',
  'whoami',
];

describe('levenshtein', () => {
  it('is zero for identical strings', () => {
    expect(levenshtein('analyze', 'analyze')).toBe(0);
  });

  it('counts single edits', () => {
    expect(levenshtein('analyze', 'analize')).toBe(1);
    expect(levenshtein('score', 'scores')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('suggestCommands', () => {
  it('suggests the nearest command for a typo', () => {
    expect(suggestCommands('analize', COMMANDS)[0]).toBe('analyze');
  });

  it('matches by prefix', () => {
    expect(suggestCommands('dash', COMMANDS)).toContain('dashboard');
  });

  it('returns nothing for a wildly different input', () => {
    expect(suggestCommands('zzzzzzzzzz', COMMANDS)).toEqual([]);
  });

  it('respects the limit', () => {
    expect(suggestCommands('lo', COMMANDS, { limit: 1 }).length).toBeLessThanOrEqual(1);
  });
});

describe('formatUnknownCommand', () => {
  it('includes the header and a suggestion', () => {
    const message = formatUnknownCommand('analize', COMMANDS);
    expect(message).toContain('Unknown command: analize');
    expect(message).toContain('Did you mean:');
    expect(message).toContain('beacon analyze');
  });

  it('omits the suggestion block when nothing is close', () => {
    const message = formatUnknownCommand('zzzzzzzzzz', COMMANDS);
    expect(message).toBe('Unknown command: zzzzzzzzzz');
  });
});
