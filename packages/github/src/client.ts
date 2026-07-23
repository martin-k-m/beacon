import type {
  CommitActivityWeek,
  ContributorStat,
  DependencyManifest,
  IssueMetrics,
  LanguageBreakdown,
  PullRequestMetrics,
  ReadmeInfo,
  ReleaseInfo,
  RepoIdentifier,
  RepositoryMetadata,
  RepositorySnapshot,
  SecuritySignals,
} from '@beacon/shared';

export interface GitHubClientOptions {
  /** A GitHub personal access token. Optional, but strongly recommended to avoid low unauthenticated rate limits. */
  token?: string;
  /** Override the API base URL (for GitHub Enterprise). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
  userAgent?: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

interface RequestResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

const DAY_HOURS = 24;

/** Parse a `owner/repo` (or full GitHub URL) into a {@link RepoIdentifier}. */
export function parseRepoIdentifier(input: string): RepoIdentifier {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid repository "${input}". Expected "owner/repo".`);
  }
  return { owner: parts[0]!, repo: parts[1]! };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
}

function withinLastDays(iso: string, days: number, now: number): boolean {
  return now - new Date(iso).getTime() <= days * 1000 * 60 * 60 * DAY_HOURS;
}

/**
 * A small, dependency-free GitHub REST client scoped to the reads Beacon
 * needs. Every sub-request degrades gracefully so a single failing endpoint
 * (e.g. stats not yet computed, or a private sub-resource) never aborts the
 * whole snapshot.
 */
export class GitHubClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(options: GitHubClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.token = options.token;
    this.userAgent = options.userAgent ?? 'beacon-intelligence';
    const impl = options.fetch ?? globalThis.fetch;
    if (!impl) {
      throw new Error('No fetch implementation available. Provide options.fetch.');
    }
    this.fetchImpl = impl;
  }

  private async request<T>(path: string): Promise<RequestResult<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': this.userAgent,
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { headers });
    if (res.status === 404) {
      throw new GitHubError(`Not found: ${path}`, 404, path);
    }
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      throw new GitHubError('GitHub API rate limit exceeded. Set GITHUB_TOKEN.', 403, path);
    }
    if (!res.ok) {
      throw new GitHubError(`GitHub request failed (${res.status}): ${path}`, res.status, path);
    }
    const data = (await res.json()) as T;
    return { data, status: res.status, headers: res.headers };
  }

  /** Like {@link request} but returns null instead of throwing on failure. */
  private async tryRequest<T>(path: string): Promise<RequestResult<T> | null> {
    try {
      return await this.request<T>(path);
    } catch {
      return null;
    }
  }

  /** Collect a complete snapshot for a repository. */
  async getSnapshot(identifier: RepoIdentifier): Promise<RepositorySnapshot> {
    const { owner, repo } = identifier;
    const base = `/repos/${owner}/${repo}`;

    const repoRes = await this.request<GitHubRepo>(base);
    const now = Date.now();

    const [
      languages,
      contributors,
      commitActivity,
      releases,
      readme,
      issues,
      pullRequests,
      security,
      dependencies,
    ] = await Promise.all([
      this.getLanguages(base),
      this.getContributors(base),
      this.getCommitActivity(base),
      this.getReleases(base),
      this.getReadme(base, owner, repo),
      this.getIssueMetrics(owner, repo, repoRes.data.open_issues_count, now),
      this.getPullRequestMetrics(owner, repo, now),
      this.getSecuritySignals(base),
      this.getDependencies(base),
    ]);

    return {
      identifier,
      metadata: toMetadata(repoRes.data),
      languages,
      contributors,
      commitActivity,
      releases,
      issues,
      pullRequests,
      readme,
      dependencies,
      security,
      collectedAt: new Date(now).toISOString(),
    };
  }

  private async getLanguages(base: string): Promise<LanguageBreakdown> {
    const res = await this.tryRequest<LanguageBreakdown>(`${base}/languages`);
    return res?.data ?? {};
  }

  private async getContributors(base: string): Promise<ContributorStat[]> {
    const res = await this.tryRequest<GitHubContributor[]>(
      `${base}/contributors?per_page=100&anon=false`,
    );
    if (!res) return [];
    return res.data
      .filter((c) => c.type !== 'Bot')
      .map((c) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        htmlUrl: c.html_url,
        contributions: c.contributions,
      }))
      .sort((a, b) => b.contributions - a.contributions);
  }

  private async getCommitActivity(base: string): Promise<CommitActivityWeek[]> {
    const res = await this.tryRequest<GitHubCommitActivity[]>(`${base}/stats/commit_activity`);
    if (!res || !Array.isArray(res.data)) return [];
    return res.data.map((w) => ({ weekStart: w.week, total: w.total }));
  }

  private async getReleases(base: string): Promise<ReleaseInfo[]> {
    const res = await this.tryRequest<GitHubRelease[]>(`${base}/releases?per_page=20`);
    if (!res) return [];
    return res.data.map((r) => ({
      id: r.id,
      name: r.name || r.tag_name,
      tagName: r.tag_name,
      publishedAt: r.published_at,
      isPrerelease: r.prerelease,
      htmlUrl: r.html_url,
    }));
  }

  private async getReadme(base: string, owner: string, repo: string): Promise<ReadmeInfo> {
    const res = await this.tryRequest<GitHubReadme>(`${base}/readme`);
    if (!res) {
      return {
        present: false,
        lengthBytes: 0,
        hasBadges: false,
        hasInstallSection: false,
        hasUsageSection: false,
        hasLicenseSection: false,
      };
    }
    const content = res.data.content
      ? Buffer.from(res.data.content, (res.data.encoding as BufferEncoding) || 'base64').toString(
          'utf-8',
        )
      : '';
    const lower = content.toLowerCase();
    void owner;
    void repo;
    return {
      present: true,
      lengthBytes: res.data.size ?? content.length,
      hasBadges: /!\[[^\]]*\]\([^)]*(shields\.io|badge)/i.test(content),
      hasInstallSection: /#+\s*(install|installation|getting started|setup)/i.test(lower),
      hasUsageSection: /#+\s*(usage|quick ?start|example)/i.test(lower),
      hasLicenseSection: /#+\s*licen[cs]e/i.test(lower),
    };
  }

  private async getIssueMetrics(
    owner: string,
    repo: string,
    fallbackOpen: number,
    now: number,
  ): Promise<IssueMetrics> {
    const q = (extra: string) =>
      `/search/issues?q=repo:${owner}/${repo}+type:issue+${extra}&per_page=1`;
    const [openRes, closedRes, recentClosed] = await Promise.all([
      this.tryRequest<GitHubSearch>(q('state:open')),
      this.tryRequest<GitHubSearch>(q('state:closed')),
      this.tryRequest<GitHubSearch<GitHubIssueItem>>(
        `/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed&sort=updated&order=desc&per_page=40`,
      ),
    ]);

    const closedItems = recentClosed?.data.items ?? [];
    const durations = closedItems
      .filter((i) => i.closed_at)
      .map((i) => hoursBetween(i.created_at, i.closed_at!));

    const recentOpenRes = await this.tryRequest<GitHubSearch>(
      `/search/issues?q=repo:${owner}/${repo}+type:issue+state:open&sort=created&order=desc&per_page=50`,
    );

    return {
      open: openRes?.data.total_count ?? fallbackOpen,
      closed: closedRes?.data.total_count ?? 0,
      medianTimeToCloseHours: median(durations),
      openedLast30Days: countRecent(
        (recentOpenRes?.data as GitHubSearch<GitHubIssueItem>)?.items,
        'created_at',
        now,
      ),
      closedLast30Days: countRecent(closedItems, 'closed_at', now),
    };
  }

  private async getPullRequestMetrics(
    owner: string,
    repo: string,
    now: number,
  ): Promise<PullRequestMetrics> {
    const q = (extra: string) =>
      `/search/issues?q=repo:${owner}/${repo}+type:pr+${extra}&per_page=1`;
    const [openRes, mergedRes, closedRes, recentMerged] = await Promise.all([
      this.tryRequest<GitHubSearch>(q('state:open')),
      this.tryRequest<GitHubSearch>(q('is:merged')),
      this.tryRequest<GitHubSearch>(q('state:closed+is:unmerged')),
      this.tryRequest<GitHubSearch<GitHubIssueItem>>(
        `/search/issues?q=repo:${owner}/${repo}+type:pr+is:merged&sort=updated&order=desc&per_page=40`,
      ),
    ]);

    const mergedItems = recentMerged?.data.items ?? [];
    const durations = mergedItems
      .filter((i) => i.closed_at)
      .map((i) => hoursBetween(i.created_at, i.closed_at!));

    return {
      open: openRes?.data.total_count ?? 0,
      merged: mergedRes?.data.total_count ?? 0,
      closedWithoutMerge: closedRes?.data.total_count ?? 0,
      medianTimeToMergeHours: median(durations),
      openedLast30Days: countRecent(mergedItems, 'created_at', now),
      mergedLast30Days: countRecent(mergedItems, 'closed_at', now),
    };
  }

  private async getSecuritySignals(base: string): Promise<SecuritySignals> {
    const [policy, dependabot] = await Promise.all([
      this.tryRequest<unknown>(`${base}/contents/SECURITY.md`),
      this.tryRequest<unknown>(`${base}/contents/.github/dependabot.yml`),
    ]);
    return {
      hasSecurityPolicy: policy !== null,
      hasDependabot: dependabot !== null,
      // Vulnerability alerts require an authenticated admin scope; left null when unavailable.
      vulnerabilityAlertCount: null,
    };
  }

  private async getDependencies(base: string): Promise<DependencyManifest[]> {
    const res = await this.tryRequest<GitHubContentEntry[]>(`${base}/contents`);
    if (!res || !Array.isArray(res.data)) return [];
    const manifests: DependencyManifest[] = [];
    const known: Record<string, string> = {
      'package.json': 'npm',
      'requirements.txt': 'pip',
      'pyproject.toml': 'pip',
      'go.mod': 'go',
      'Cargo.toml': 'cargo',
      'pom.xml': 'maven',
      'build.gradle': 'gradle',
      Gemfile: 'rubygems',
      'composer.json': 'composer',
    };
    for (const entry of res.data) {
      const ecosystem = known[entry.name];
      if (ecosystem && entry.type === 'file') {
        // The tree listing proves the manifest exists but carries no contents.
        // Counting would cost one extra request per manifest against a budget
        // that matters most for anonymous callers (60/hr), so the count is left
        // null — "unknown", not zero. Local analysis parses manifests off disk
        // and reports real counts.
        manifests.push({ ecosystem, path: entry.path, dependencyCount: null });
      }
    }
    return manifests;
  }
}

function countRecent<T extends Record<string, unknown>>(
  items: T[] | undefined,
  field: keyof T,
  now: number,
): number {
  if (!items) return 0;
  return items.filter((i) => {
    const value = i[field];
    return typeof value === 'string' && withinLastDays(value, 30, now);
  }).length;
}

function toMetadata(r: GitHubRepo): RepositoryMetadata {
  return {
    id: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    homepage: r.homepage || null,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch,
    license: r.license?.spdx_id ?? r.license?.name ?? null,
    topics: r.topics ?? [],
    isArchived: r.archived,
    isFork: r.fork,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,
    stars: r.stargazers_count,
    forks: r.forks_count,
    watchers: r.subscribers_count ?? r.watchers_count,
    openIssues: r.open_issues_count,
    primaryLanguage: r.language,
    sizeKb: r.size,
  };
}

// --- Minimal shapes of the GitHub REST responses we consume ---

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  homepage: string | null;
  html_url: string;
  default_branch: string;
  license: { spdx_id: string | null; name: string | null } | null;
  topics?: string[];
  archived: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  subscribers_count?: number;
  open_issues_count: number;
  language: string | null;
  size: number;
}

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

interface GitHubCommitActivity {
  week: number;
  total: number;
  days: number[];
}

interface GitHubRelease {
  id: number;
  name: string | null;
  tag_name: string;
  published_at: string | null;
  prerelease: boolean;
  html_url: string;
}

interface GitHubReadme {
  content: string;
  encoding: string;
  size: number;
}

interface GitHubSearch<T = unknown> {
  total_count: number;
  items: T[];
}

interface GitHubIssueItem extends Record<string, unknown> {
  created_at: string;
  closed_at: string | null;
}

interface GitHubContentEntry {
  name: string;
  path: string;
  type: string;
}
