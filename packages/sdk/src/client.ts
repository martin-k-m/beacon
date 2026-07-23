import { analyzeRepository, analyzeSnapshot as analyzeSnapshotCore } from '@beacon/analytics';
import { parseRepoIdentifier } from '@beacon/github';
import type { BeaconAnalysis, BeaconScore, RepositorySnapshot } from '@beacon/shared';

/**
 * How an analysis is resolved:
 * - `api`    — call a running Beacon API service over HTTP.
 * - `github` — collect and score directly from GitHub, in-process.
 * - `auto`   — use `api` when an `apiUrl` is configured, otherwise `github`.
 */
export type AnalyzeSource = 'auto' | 'api' | 'github';

export interface BeaconClientOptions {
  /** Beacon API base URL. When set, 'auto' uses the API. */
  apiUrl?: string;
  /** Beacon API auth token (Bearer) for the API mode. */
  token?: string;
  /** GitHub token for direct ('github') mode. */
  githubToken?: string;
  /** AI provider config for direct mode summaries. */
  ai?: { provider?: string; openaiApiKey?: string; anthropicApiKey?: string; model?: string };
  fetch?: typeof fetch;
}

export interface AnalyzeOptions {
  refresh?: boolean;
  source?: AnalyzeSource;
}

export interface TrendResponse {
  range: string;
  trend: unknown;
  series: unknown[];
}

/** Widget/badge variants supported by the Beacon API embed endpoints. */
export type WidgetType = 'health' | 'activity' | 'language' | 'contributor' | 'release' | 'badge';

export type TrendRange = '30d' | '90d' | '1y' | 'all';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Programmatic client for Beacon repository intelligence.
 *
 * A `Beacon` instance resolves an analysis either through a running Beacon API
 * service (`api` mode) or by collecting and scoring directly from GitHub in the
 * current process (`github` mode). `auto` picks the API when an `apiUrl` is
 * configured and falls back to direct GitHub otherwise.
 */
export class Beacon {
  private readonly options: BeaconClientOptions;
  private readonly fetchImpl?: typeof fetch;

  /** The configured Beacon API base URL, if any (trailing slash trimmed). */
  readonly apiUrl?: string;

  constructor(options: BeaconClientOptions = {}) {
    this.options = options;
    this.apiUrl = options.apiUrl ? trimTrailingSlash(options.apiUrl) : undefined;
    this.fetchImpl = options.fetch;
  }

  /** Resolve the concrete source given the caller's requested source. */
  private resolveSource(requested?: AnalyzeSource): 'api' | 'github' {
    const source = requested ?? 'auto';
    if (source === 'api') return 'api';
    if (source === 'github') return 'github';
    return this.apiUrl ? 'api' : 'github';
  }

  private getFetch(): typeof fetch {
    const impl = this.fetchImpl ?? globalThis.fetch;
    if (!impl) {
      throw new Error(
        'No fetch implementation available. Provide options.fetch or run on Node >= 20.',
      );
    }
    return impl;
  }

  /**
   * Analyze `owner/repo` (or a GitHub URL). With `source: 'auto'` (the default)
   * the API is used when an `apiUrl` is configured, otherwise the repository is
   * analyzed directly from GitHub.
   *
   * When `auto` selects `api` but the request fails and a `githubToken` is
   * available, the client transparently falls back to direct GitHub analysis.
   */
  async analyze(repo: string, options: AnalyzeOptions = {}): Promise<BeaconAnalysis> {
    const source = this.resolveSource(options.source);

    if (source === 'github') {
      return this.analyzeViaGitHub(repo);
    }

    try {
      return await this.analyzeViaApi(repo, options.refresh);
    } catch (err) {
      const canFallback =
        (options.source ?? 'auto') === 'auto' && Boolean(this.options.githubToken);
      if (canFallback) {
        return this.analyzeViaGitHub(repo);
      }
      throw err;
    }
  }

  /** Just the Beacon Score for a repository. */
  async score(repo: string, options: AnalyzeOptions = {}): Promise<BeaconScore> {
    const analysis = await this.analyze(repo, options);
    return analysis.score;
  }

  /**
   * Score and summarize an already-collected snapshot. Runs entirely in-process
   * (no network), using the configured AI provider for the summary.
   */
  async analyzeSnapshot(snapshot: RepositorySnapshot): Promise<BeaconAnalysis> {
    return analyzeSnapshotCore(snapshot, { ai: this.options.ai });
  }

  /**
   * Health trend over a range. API mode only — throws a clear error when no
   * `apiUrl` is configured (direct mode has no history to trend).
   */
  async trend(repo: string, range: TrendRange = '30d'): Promise<TrendResponse> {
    if (!this.apiUrl) {
      throw new Error(
        'trend() requires the API: set apiUrl (or BEACON_API_URL). ' +
          'Direct GitHub mode has no stored history to build a trend from.',
      );
    }
    const { owner, repo: name } = parseRepoIdentifier(repo);
    const url = `${this.apiUrl}/api/repositories/${owner}/${name}/trend?range=${encodeURIComponent(
      range,
    )}`;
    const res = await this.getFetch()(url, { headers: this.apiHeaders() });
    if (!res.ok) {
      throw new Error(`Beacon API trend request failed (${res.status}) for ${owner}/${name}.`);
    }
    return (await res.json()) as TrendResponse;
  }

  /**
   * Build an embeddable widget/badge URL for the configured `apiUrl`. Throws a
   * clear error when no `apiUrl` is configured.
   */
  widgetUrl(
    repo: string,
    type: WidgetType = 'health',
    opts: { theme?: string; size?: string } = {},
  ): string {
    if (!this.apiUrl) {
      throw new Error('widgetUrl() requires apiUrl: set apiUrl (or BEACON_API_URL).');
    }
    const { owner, repo: name } = parseRepoIdentifier(repo);
    const path = type === 'badge' ? `/badge/${owner}/${name}` : `/widget/${type}/${owner}/${name}`;
    const params = new URLSearchParams();
    if (opts.theme) params.set('theme', opts.theme);
    if (opts.size) params.set('size', opts.size);
    const query = params.toString();
    return `${this.apiUrl}${path}${query ? `?${query}` : ''}`;
  }

  private apiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }
    return headers;
  }

  private async analyzeViaApi(repo: string, refresh?: boolean): Promise<BeaconAnalysis> {
    if (!this.apiUrl) {
      throw new Error(
        'API mode selected but no apiUrl is configured. Set apiUrl (or BEACON_API_URL), ' +
          "or use source: 'github'.",
      );
    }
    const res = await this.getFetch()(`${this.apiUrl}/api/analyze`, {
      method: 'POST',
      headers: this.apiHeaders(),
      body: JSON.stringify({ repo, refresh }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as { error?: string };
        if (body && typeof body.error === 'string') detail = `: ${body.error}`;
      } catch {
        // Non-JSON error body — the status alone is enough context.
      }
      throw new Error(`Beacon API analyze request failed (${res.status}) for ${repo}${detail}.`);
    }
    return (await res.json()) as BeaconAnalysis;
  }

  private async analyzeViaGitHub(repo: string): Promise<BeaconAnalysis> {
    if (!this.options.githubToken) {
      throw new Error('No GitHub token: set githubToken or GITHUB_TOKEN, or configure apiUrl.');
    }
    return analyzeRepository(repo, {
      githubToken: this.options.githubToken,
      ai: this.options.ai,
      fetch: this.fetchImpl,
    });
  }
}
