import type { BeaconScore, RepositorySnapshot } from '@beacon/shared';
import {
  computeTrend,
  toHealthSeries,
  type AnalysisLike,
  type HealthPoint,
  type TrendRange,
} from '@beacon/analytics';
import {
  buildDemoAnalysis,
  getDemoAnalyses,
  getDemoAnalysis,
  getDemoTrend,
  type DemoAnalysis,
  type HealthTrend,
} from './data';

/**
 * Typed data client for the dashboard.
 *
 * When `NEXT_PUBLIC_API_URL` is set, it fetches live analyses from the Beacon
 * API. Otherwise — and whenever a request fails — it falls back to the local
 * `@beacon/shared` demo fixtures so the UI is always populated. Safe to call
 * from Server Components.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

/** Shape the API returns for a single analysis (a superset of DemoAnalysis). */
interface ApiAnalysis {
  snapshot: RepositorySnapshot;
  score: BeaconScore;
  summary?: { text?: string; highlights?: string[] } | string | null;
  highlights?: string[];
}

/** Shape the API returns for a repository's health history. */
interface ApiTrend {
  series?: HealthPoint[];
  history?: AnalysisLike[];
}

function normalizeAnalysis(payload: ApiAnalysis): DemoAnalysis {
  // Recompute a synchronous summary/highlights locally so the client shape is
  // uniform regardless of whether the API returned an AI summary.
  const base = buildDemoAnalysis(payload.snapshot);
  const summaryText =
    typeof payload.summary === 'string'
      ? payload.summary
      : payload.summary?.text ?? base.summary;
  const summaryHighlights =
    typeof payload.summary === 'object' && payload.summary
      ? payload.summary.highlights
      : undefined;
  const highlights = payload.highlights ?? summaryHighlights ?? base.highlights;

  return {
    snapshot: payload.snapshot,
    score: payload.score ?? base.score,
    summary: summaryText,
    highlights,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
    // Revalidate periodically; analysis is not real-time.
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Fetch a single analysis for `owner/repo`, falling back to demo data. */
export async function getAnalysis(
  owner: string,
  repo: string,
): Promise<DemoAnalysis | null> {
  if (API_BASE) {
    try {
      const data = await fetchJson<ApiAnalysis>(
        `/api/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      );
      return normalizeAnalysis(data);
    } catch {
      // Fall through to demo data on any transport/parse error.
    }
  }
  return getDemoAnalysis(owner, repo);
}

/** List all available analyses, falling back to demo data. */
export async function listAnalyses(): Promise<DemoAnalysis[]> {
  if (API_BASE) {
    try {
      const data = await fetchJson<ApiAnalysis[]>(`/api/demo`);
      if (Array.isArray(data) && data.length > 0) {
        return data
          .map(normalizeAnalysis)
          .sort((a, b) => b.score.total - a.score.total);
      }
    } catch {
      // Fall through to demo data.
    }
  }
  return getDemoAnalyses();
}

/**
 * Fetch the health history + trend for `owner/repo`. When live, it reads stored
 * history from `…/trend?range=`; on any failure it falls back to the synthesized
 * demo history. Either way the full series is returned so the chart can
 * re-window client-side.
 */
export async function getTrend(
  owner: string,
  repo: string,
  range: TrendRange = '90d',
): Promise<HealthTrend | null> {
  if (API_BASE) {
    try {
      const data = await fetchJson<ApiTrend>(
        `/api/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(
          repo,
        )}/trend?range=${encodeURIComponent(range)}`,
      );
      const series = data.series ?? toHealthSeries(data.history ?? []);
      if (series.length > 0) {
        const latest = series[series.length - 1];
        const now = latest ? latest.timestamp : Date.now();
        return { series, trend: computeTrend(series, range, now), range, now };
      }
    } catch {
      // Fall through to demo history.
    }
  }
  return getDemoTrend(owner, repo, range);
}

/** Whether the dashboard is running against a live API or demo fixtures. */
export function isLiveMode(): boolean {
  return Boolean(API_BASE);
}
