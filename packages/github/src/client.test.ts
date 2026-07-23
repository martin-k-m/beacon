import { describe, expect, it } from 'vitest';
import { GitHubClient, parseRepoIdentifier } from './client';

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
    expect(
      parseRepoIdentifier('git@github.com:org/tool.git'.replace('git@github.com:', '')),
    ).toEqual({ owner: 'org', repo: 'tool' });
  });

  it('throws on invalid input', () => {
    expect(() => parseRepoIdentifier('not-a-repo')).toThrow();
  });
});

const REPO_FIXTURE = {
  id: 1,
  name: 'widget',
  full_name: 'acme/widget',
  owner: { login: 'acme' },
  description: 'A test repository.',
  homepage: null,
  html_url: 'https://github.com/acme/widget',
  default_branch: 'main',
  license: { spdx_id: 'MIT', name: 'MIT License' },
  topics: ['testing'],
  archived: false,
  fork: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
  pushed_at: '2024-06-01T00:00:00Z',
  stargazers_count: 10,
  forks_count: 2,
  watchers_count: 10,
  open_issues_count: 1,
  language: 'TypeScript',
  size: 100,
};

const CONTENTS_FIXTURE = [
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'README.md', path: 'README.md', type: 'file' },
  { name: 'src', path: 'src', type: 'dir' },
];

/**
 * Serve only the two endpoints this test cares about (the repository itself and
 * its root tree listing); everything else 404s, which the client's `tryRequest`
 * turns into a documented neutral default. That keeps the fixture small without
 * faking signals the assertions don't touch.
 */
function fetchStub(routes: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const path = String(url).replace('https://api.github.com', '');
    const body = routes[path];
    if (body === undefined) {
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('GitHubClient.getSnapshot — dependency manifests', () => {
  const client = () =>
    new GitHubClient({
      fetch: fetchStub({
        '/repos/acme/widget': REPO_FIXTURE,
        '/repos/acme/widget/contents': CONTENTS_FIXTURE,
      }),
    });

  it('detects known manifests from the repository tree', async () => {
    const snapshot = await client().getSnapshot({ owner: 'acme', repo: 'widget' });
    expect(snapshot.dependencies).toHaveLength(1);
    expect(snapshot.dependencies[0]?.ecosystem).toBe('npm');
    expect(snapshot.dependencies[0]?.path).toBe('package.json');
  });

  it('reports an unknown dependency count as null, never a misleading zero', async () => {
    // Remote collection lists the tree but does not read manifest contents, so
    // the count is genuinely unknown. Reporting 0 would claim a repository has
    // no dependencies — a factual error the score and UI would inherit.
    const snapshot = await client().getSnapshot({ owner: 'acme', repo: 'widget' });
    expect(snapshot.dependencies[0]?.dependencyCount).toBeNull();
    expect(snapshot.dependencies[0]?.dependencyCount).not.toBe(0);
  });

  it('ignores directories and unknown files', async () => {
    const snapshot = await client().getSnapshot({ owner: 'acme', repo: 'widget' });
    expect(snapshot.dependencies.map((d) => d.path)).not.toContain('src');
    expect(snapshot.dependencies.map((d) => d.path)).not.toContain('README.md');
  });
});
