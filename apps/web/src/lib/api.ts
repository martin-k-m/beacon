import type { BeaconScore, RepositorySnapshot } from '@beacon/core';
import {
  buildDemoAnalysis,
  getDemoAnalyses,
  getDemoAnalysis,
  type DemoAnalysis,
} from './data';

/**
 * Typed data client for the dashboard.
 *
 * When `NEXT_PUBLIC_API_URL` is set, it fetches live analyses from the Beacon
 * API. Otherwise — and whenever a request fails — it falls back to the local
 * `@beacon/core` demo fixtures so the UI is always populated. Safe to call
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

/** Whether the dashboard is running against a live API or demo fixtures. */
export function isLiveMode(): boolean {
  return Boolean(API_BASE);
}
