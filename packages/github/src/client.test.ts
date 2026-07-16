import { describe, expect, it } from 'vitest';
import { parseRepoIdentifier } from './client';

describe('parseRepoIdentifier', () => {
  it('parses owner/repo', () => {
    expect(parseRepoIdentifier('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('parses a full github URL', () => {
    expect(parseRepoIdentifier('https://github.com/vercel/next.js')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    });
  });

  it('strips a trailing .git', () => {
    expect(parseRepoIdentifier('git@github.com:org/tool.git'.replace('git@github.com:', ''))).toEqual(
      { owner: 'org', repo: 'tool' },
    );
  });

  it('throws on invalid input', () => {
    expect(() => parseRepoIdentifier('not-a-repo')).toThrow();
  });
});
