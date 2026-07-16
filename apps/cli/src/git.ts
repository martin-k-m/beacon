/**
 * Thin, dependency-free wrappers around the local `git` executable.
 *
 * Every helper degrades gracefully: if `git` is missing, the directory is not a
 * repository, or a sub-command fails, the helper returns `null`/`[]` instead of
 * throwing. Commands are run with {@link execFileSync} (no shell) so paths and
 * arguments never need quoting, and each has a short timeout so a wedged repo
 * can never hang the CLI.
 */

import { execFileSync } from 'node:child_process';

import { parseRepoIdentifier } from '@beacon/github';
import type { RepoIdentifier } from '@beacon/shared';

const GIT_TIMEOUT_MS = 5000;

/** Run a git command in `cwd`, returning trimmed stdout or `null` on failure. */
export function runGit(args: string[], cwd: string): string | null {
  try {
    const out = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    return out.trim();
  } catch {
    return null;
  }
}

/** Run a git command and return its non-empty output lines. */
export function runGitLines(args: string[], cwd: string): string[] {
  const out = runGit(args, cwd);
  if (out === null || out.length === 0) {
    return [];
  }
  return out.split(/\r?\n/).filter((line) => line.length > 0);
}

/** True when `cwd` is inside a git working tree. */
export function isGitRepo(cwd: string): boolean {
  return runGit(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';
}

/** The `origin` remote URL, or `null` when there is no such remote. */
export function gitRemoteUrl(cwd: string): string | null {
  return runGit(['remote', 'get-url', 'origin'], cwd);
}

/**
 * Resolve the `owner/repo` for the repository in `cwd` from its `origin`
 * remote. Returns `null` when there is no remote or it cannot be parsed.
 */
export function gitRemoteRepo(cwd: string): RepoIdentifier | null {
  const url = gitRemoteUrl(cwd);
  if (!url) {
    return null;
  }
  return parseRemote(url);
}

/**
 * Parse a git remote URL into an `owner/repo`. Handles HTTPS, SSH
 * (`git@github.com:owner/repo.git`), and `git://` forms.
 */
export function parseRemote(url: string): RepoIdentifier | null {
  const normalized = url
    .trim()
    .replace(/^git@([^:]+):/i, 'https://$1/')
    .replace(/^ssh:\/\/git@/i, 'https://')
    .replace(/^git:\/\//i, 'https://');
  try {
    return parseRepoIdentifier(normalized);
  } catch {
    return null;
  }
}

/** The current branch name (e.g. `main`), or `null` when detached/unknown. */
export function currentBranch(cwd: string): string | null {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (!branch || branch === 'HEAD') {
    return null;
  }
  return branch;
}
