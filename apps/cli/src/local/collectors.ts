/**
 * The local snapshot collector registry.
 *
 * A {@link RepositorySnapshot} is assembled by running an ordered array of
 * small {@link Collector} functions, each contributing one slice of the
 * snapshot (identity, commit activity, contributors, languages, manifests,
 * docs, security, …). New signals or ecosystems are added by appending a
 * collector — nothing else has to change. Every collector is defensive: a
 * missing tool or file leaves that slice at its neutral default and, where
 * relevant, records a human-readable note.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import type {
  ContributorStat,
  CommitActivityWeek,
  ReadmeInfo,
  ReleaseInfo,
  RepositorySnapshot,
} from '@beacon/shared';

import { currentBranch, gitRemoteRepo, runGit, runGitLines } from '../git';
import { scanLanguages } from './languages';
import { detectManifests } from './manifests';

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const WEEKS = 52;

/** Shared context handed to every collector. */
export interface LocalContext {
  /** Absolute repository root. */
  cwd: string;
  /** Directory/file names to skip during the filesystem walk. */
  ignore: string[];
  /** "Now", in ms, so every collector shares one clock. */
  now: number;
}

/**
 * A collector contributes to the snapshot draft in place and may return notes
 * to surface to the user (e.g. "releases unavailable — no tags").
 */
export interface Collector {
  name: string;
  collect(ctx: LocalContext, draft: RepositorySnapshot): string[] | void;
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Identity, ownership, default branch, and created/pushed timestamps. */
const identityCollector: Collector = {
  name: 'identity',
  collect(ctx, draft) {
    const remote = gitRemoteRepo(ctx.cwd);
    const owner = remote?.owner ?? 'local';
    const repo = remote?.repo ?? (basename(ctx.cwd) || 'repository');
    const fullName = `${owner}/${repo}`;

    draft.identifier = { owner, repo };
    draft.metadata.owner = owner;
    draft.metadata.name = repo;
    draft.metadata.fullName = fullName;
    draft.metadata.htmlUrl = remote ? `https://github.com/${fullName}` : `file://${ctx.cwd}`;

    const branch = currentBranch(ctx.cwd);
    if (branch) {
      draft.metadata.defaultBranch = branch;
    }

    const firstCommit = earliestRootDate(ctx.cwd);
    if (firstCommit) {
      draft.metadata.createdAt = firstCommit;
    }
    const lastCommit = runGit(['log', '-1', '--format=%cI'], ctx.cwd);
    if (lastCommit) {
      draft.metadata.pushedAt = lastCommit;
      draft.metadata.updatedAt = lastCommit;
    }
  },
};

/** Earliest root-commit commit date (repos can have multiple roots). */
function earliestRootDate(cwd: string): string | null {
  const dates = runGitLines(['log', '--max-parents=0', '--format=%cI'], cwd);
  if (dates.length === 0) {
    return null;
  }
  return (
    dates
      .map((d) => ({ d, t: Date.parse(d) }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t)[0]?.d ?? null
  );
}

/** 52 weekly commit buckets from `git log --since=1.year`. */
const commitActivityCollector: Collector = {
  name: 'commit-activity',
  collect(ctx, draft) {
    const nowSec = Math.floor(ctx.now / 1000);
    const buckets = new Array<number>(WEEKS).fill(0);
    const timestamps = runGitLines(['log', '--since=1.year', '--format=%ct'], ctx.cwd);
    for (const raw of timestamps) {
      const ts = Number.parseInt(raw, 10);
      if (!Number.isFinite(ts)) {
        continue;
      }
      const weeksAgo = Math.floor((nowSec - ts) / WEEK_SECONDS);
      if (weeksAgo >= 0 && weeksAgo < WEEKS) {
        const index = WEEKS - 1 - weeksAgo;
        buckets[index] = (buckets[index] ?? 0) + 1;
      }
    }
    const activity: CommitActivityWeek[] = buckets.map((total, i) => ({
      weekStart: nowSec - (WEEKS - 1 - i) * WEEK_SECONDS,
      total,
    }));
    draft.commitActivity = activity;
    if (timestamps.length === 0) {
      return ['No commits in the last year — activity is scored as inactive.'];
    }
  },
};

/** Contributors, aggregated from author names across all history. */
const contributorsCollector: Collector = {
  name: 'contributors',
  collect(ctx, draft) {
    const lines = runGitLines(['log', '--format=%aN'], ctx.cwd);
    if (lines.length === 0) {
      return;
    }
    const counts = new Map<string, number>();
    for (const name of lines) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const contributors: ContributorStat[] = [...counts.entries()]
      .map(([login, contributions]) => ({
        login,
        avatarUrl: '',
        htmlUrl: '',
        contributions,
      }))
      .sort((a, b) => b.contributions - a.contributions);
    draft.contributors = contributors;
  },
};

/** Releases, derived from annotated/lightweight tags. */
const releasesCollector: Collector = {
  name: 'releases',
  collect(ctx, draft) {
    const tags = runGitLines(['tag', '--sort=-creatordate'], ctx.cwd).slice(0, 20);
    if (tags.length === 0) {
      return;
    }
    const releases: ReleaseInfo[] = tags.map((tag, i) => {
      const date = runGit(['log', '-1', '--format=%cI', tag], ctx.cwd);
      return {
        id: i + 1,
        name: tag,
        tagName: tag,
        publishedAt: date,
        isPrerelease: /-(alpha|beta|rc|pre|next|canary)/i.test(tag) || tag.includes('-'),
        htmlUrl: draft.metadata.htmlUrl.startsWith('https')
          ? `${draft.metadata.htmlUrl}/releases/tag/${tag}`
          : '',
      };
    });
    draft.releases = releases;
  },
};

/** Languages + repository size, from a filesystem walk. */
const languagesCollector: Collector = {
  name: 'languages',
  collect(ctx, draft) {
    const scan = scanLanguages(ctx.cwd, ctx.ignore);
    draft.languages = scan.languages;
    draft.metadata.primaryLanguage = scan.primaryLanguage;
    draft.metadata.sizeKb = Math.round(scan.totalBytes / 1024);
    if (draft.metadata.topics.length === 0 && scan.primaryLanguage) {
      draft.metadata.topics = [scan.primaryLanguage.toLowerCase()];
    }
  },
};

/** Dependency manifests across supported ecosystems. */
const manifestsCollector: Collector = {
  name: 'manifests',
  collect(ctx, draft) {
    draft.dependencies = detectManifests(ctx.cwd);
  },
};

const README_CANDIDATES = ['README.md', 'README.MD', 'Readme.md', 'readme.md', 'README'];

/** README presence and section coverage. */
const readmeCollector: Collector = {
  name: 'readme',
  collect(ctx, draft) {
    const path = README_CANDIDATES.map((name) => join(ctx.cwd, name)).find((p) => existsSync(p));
    if (!path) {
      return;
    }
    const raw = readFileSafe(path);
    if (raw === null) {
      return;
    }
    let lengthBytes = raw.length;
    try {
      lengthBytes = statSync(path).size;
    } catch {
      // Fall back to the string length.
    }
    const readme: ReadmeInfo = {
      present: true,
      lengthBytes,
      hasBadges: /!\[[^\]]*\]\([^)]*(badge|shields\.io|beacon)[^)]*\)/i.test(raw),
      hasInstallSection: /^#{1,3}\s.*install/im.test(raw),
      hasUsageSection: /^#{1,3}\s.*(usage|getting started|quick ?start)/im.test(raw),
      hasLicenseSection: /^#{1,3}\s.*licen[cs]e/im.test(raw),
    };
    draft.readme = readme;
  },
};

/** Security signals: a policy file and Dependabot config. */
const securityCollector: Collector = {
  name: 'security',
  collect(ctx, draft) {
    const hasSecurityPolicy = ['SECURITY.md', '.github/SECURITY.md', 'docs/SECURITY.md'].some((p) =>
      existsSync(join(ctx.cwd, p)),
    );
    const hasDependabot = ['.github/dependabot.yml', '.github/dependabot.yaml'].some((p) =>
      existsSync(join(ctx.cwd, p)),
    );
    draft.security = {
      hasSecurityPolicy,
      hasDependabot,
      vulnerabilityAlertCount: null,
    };
  },
};

const LICENSE_CANDIDATES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'LICENCE'];

/** Best-effort license identification from a LICENSE file. */
const licenseCollector: Collector = {
  name: 'license',
  collect(ctx, draft) {
    const path = LICENSE_CANDIDATES.map((name) => join(ctx.cwd, name)).find((p) => existsSync(p));
    if (!path) {
      return;
    }
    const raw = readFileSafe(path);
    draft.metadata.license = raw ? identifyLicense(raw) : 'Custom';
  },
};

/** Map a license file's text to a common SPDX-ish label. */
function identifyLicense(text: string): string {
  const head = text.slice(0, 2000).toLowerCase();
  if (head.includes('mit license') || /permission is hereby granted, free of charge/.test(head)) {
    return 'MIT';
  }
  if (head.includes('apache license')) {
    return 'Apache-2.0';
  }
  if (head.includes('gnu general public license')) {
    return head.includes('version 3') ? 'GPL-3.0' : 'GPL-2.0';
  }
  if (head.includes('gnu lesser general public')) {
    return 'LGPL';
  }
  if (head.includes('mozilla public license')) {
    return 'MPL-2.0';
  }
  if (head.includes('bsd ')) {
    return 'BSD';
  }
  if (head.includes('the unlicense')) {
    return 'Unlicense';
  }
  if (head.includes('isc license')) {
    return 'ISC';
  }
  return 'Custom';
}

/**
 * The ordered collector registry. Identity runs first so later collectors can
 * read the resolved `htmlUrl`; everything else is independent.
 */
export const COLLECTORS: Collector[] = [
  identityCollector,
  commitActivityCollector,
  contributorsCollector,
  releasesCollector,
  languagesCollector,
  manifestsCollector,
  readmeCollector,
  securityCollector,
  licenseCollector,
];
