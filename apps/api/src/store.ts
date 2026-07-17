import type { AdvisorReport } from '@beacon/ai-advisor';
import type {
  BeaconAnalysis,
  BeaconScore,
  BeaconSummary,
  HealthGrade,
  PillarScore,
  RepositorySnapshot,
} from '@beacon/shared';
import { Prisma, prisma } from '@beacon/database';

import { config } from './config';

/**
 * Persistence layer over @beacon/database.
 *
 * The whole module is designed to degrade gracefully:
 *   - When no DATABASE_URL is configured (`config.hasDatabase === false`) every
 *     function is a no-op returning null/[] so the API runs with zero infra.
 *   - Every Prisma call is wrapped in try/catch so a transient DB failure never
 *     crashes a request — it simply behaves as "not found".
 */

/** A lightweight repository record for list views. */
export interface RepositorySummary {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  isArchived: boolean;
  latestScore: number | null;
  latestGrade: string | null;
  lastAnalyzedAt: string | null;
}

/** A single point in a repository's analysis history. */
export interface HistoryEntry {
  id: string;
  beaconScore: number;
  grade: string;
  summaryProvider: string;
  summaryModel: string | null;
  collectedAt: string;
  createdAt: string;
}

function warn(message: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`[store] ${message}: ${(err as Error).message}`);
}

/**
 * Persist an analysis: upsert the Repository by its unique fullName and append
 * a new Analysis row. No-op when the database is not configured.
 */
export async function saveAnalysis(analysis: BeaconAnalysis): Promise<void> {
  if (!config.hasDatabase) return;

  const { snapshot, score, summary } = analysis;
  const m = snapshot.metadata;

  try {
    // Upsert keeps mutable repository metadata (stars, archived, …) fresh.
    const repository = await prisma.repository.upsert({
      where: { fullName: m.fullName },
      create: {
        githubId: m.id,
        owner: m.owner,
        name: m.name,
        fullName: m.fullName,
        description: m.description,
        htmlUrl: m.htmlUrl,
        primaryLanguage: m.primaryLanguage,
        stars: m.stars,
        forks: m.forks,
        isArchived: m.isArchived,
      },
      update: {
        description: m.description,
        htmlUrl: m.htmlUrl,
        primaryLanguage: m.primaryLanguage,
        stars: m.stars,
        forks: m.forks,
        isArchived: m.isArchived,
      },
    });

    await prisma.analysis.create({
      data: {
        repositoryId: repository.id,
        beaconScore: score.total,
        grade: score.grade,
        // Prisma Json columns accept arbitrary serializable values; the double
        // cast satisfies the strict InputJsonValue type.
        pillars: score.pillars as unknown as Prisma.InputJsonValue,
        strengths: score.strengths,
        warnings: score.warnings,
        summaryText: summary.text,
        summaryProvider: summary.provider,
        summaryModel: summary.model,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        collectedAt: new Date(snapshot.collectedAt),
      },
    });
  } catch (err) {
    warn(`saveAnalysis(${m.fullName}) failed`, err);
  }
}

/**
 * Rebuild a full BeaconAnalysis from a stored Analysis row. The score is
 * reconstructed from the persisted fields; summary highlights (not stored
 * individually) are re-derived from strengths/warnings the same way the
 * heuristic provider composes them, so the shape round-trips faithfully.
 */
function reconstruct(row: {
  beaconScore: number;
  grade: string;
  pillars: Prisma.JsonValue;
  strengths: string[];
  warnings: string[];
  summaryText: string;
  summaryProvider: string;
  summaryModel: string | null;
  snapshot: Prisma.JsonValue;
  collectedAt: Date;
  createdAt: Date;
}): BeaconAnalysis {
  const snapshot = row.snapshot as unknown as RepositorySnapshot;

  const score: BeaconScore = {
    total: row.beaconScore,
    grade: row.grade as BeaconScore['grade'],
    pillars: row.pillars as unknown as PillarScore[],
    strengths: row.strengths,
    warnings: row.warnings,
  };

  const highlights = [
    ...row.strengths.slice(0, 2).map((s) => `✓ ${s}`),
    ...row.warnings.slice(0, 2).map((w) => `! ${w}`),
  ];

  const summary: BeaconSummary = {
    provider: row.summaryProvider,
    model: row.summaryModel,
    text: row.summaryText,
    highlights,
    generatedAt: row.createdAt.toISOString(),
  };

  return { snapshot, score, summary };
}

/**
 * Fetch the most recent analysis for a repository, or null when unknown / when
 * the database is unavailable.
 */
export async function getLatestAnalysis(
  owner: string,
  repo: string,
): Promise<BeaconAnalysis | null> {
  if (!config.hasDatabase) return null;

  const fullName = `${owner}/${repo}`;
  try {
    const latest = await prisma.analysis.findFirst({
      where: { repository: { fullName } },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return null;
    return reconstruct(latest);
  } catch (err) {
    warn(`getLatestAnalysis(${fullName}) failed`, err);
    return null;
  }
}

/**
 * A minimal per-run score record suitable for health-series / trend analysis.
 * Includes the pillar breakdown so `@beacon/analytics.toHealthSeries` can build
 * per-pillar trends (the plain `getHistory` view omits pillars).
 */
export interface ScoreHistoryEntry {
  score: {
    total: number;
    grade: HealthGrade;
    pillars: PillarScore[];
  };
  collectedAt: string;
}

/**
 * Return the score history (ascending or unordered — the analytics layer sorts)
 * for a repository, shaped for `toHealthSeries`. Empty when the repository is
 * unknown or the database is unavailable.
 */
export async function getScoreHistory(
  owner: string,
  repo: string,
): Promise<ScoreHistoryEntry[]> {
  if (!config.hasDatabase) return [];

  const fullName = `${owner}/${repo}`;
  try {
    const analyses = await prisma.analysis.findMany({
      where: { repository: { fullName } },
      orderBy: { collectedAt: 'asc' },
      select: {
        beaconScore: true,
        grade: true,
        pillars: true,
        collectedAt: true,
      },
    });

    return analyses.map((a) => ({
      score: {
        total: a.beaconScore,
        grade: a.grade as HealthGrade,
        pillars: a.pillars as unknown as PillarScore[],
      },
      collectedAt: a.collectedAt.toISOString(),
    }));
  } catch (err) {
    warn(`getScoreHistory(${fullName}) failed`, err);
    return [];
  }
}

/** List all known repositories with their latest score. Empty when no DB. */
export async function listRepositories(): Promise<RepositorySummary[]> {
  if (!config.hasDatabase) return [];

  try {
    const repositories = await prisma.repository.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return repositories.map((r) => {
      const latest = r.analyses[0];
      return {
        id: r.id,
        owner: r.owner,
        name: r.name,
        fullName: r.fullName,
        description: r.description,
        htmlUrl: r.htmlUrl,
        primaryLanguage: r.primaryLanguage,
        stars: r.stars,
        forks: r.forks,
        isArchived: r.isArchived,
        latestScore: latest ? latest.beaconScore : null,
        latestGrade: latest ? latest.grade : null,
        lastAnalyzedAt: latest ? latest.collectedAt.toISOString() : null,
      };
    });
  } catch (err) {
    warn('listRepositories failed', err);
    return [];
  }
}

/**
 * Return the analysis history (newest first) for a repository. Empty when the
 * repository is unknown or the database is unavailable.
 */
export async function getHistory(
  owner: string,
  repo: string,
): Promise<HistoryEntry[]> {
  if (!config.hasDatabase) return [];

  const fullName = `${owner}/${repo}`;
  try {
    const analyses = await prisma.analysis.findMany({
      where: { repository: { fullName } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        beaconScore: true,
        grade: true,
        summaryProvider: true,
        summaryModel: true,
        collectedAt: true,
        createdAt: true,
      },
    });

    return analyses.map((a) => ({
      id: a.id,
      beaconScore: a.beaconScore,
      grade: a.grade,
      summaryProvider: a.summaryProvider,
      summaryModel: a.summaryModel,
      collectedAt: a.collectedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    }));
  } catch (err) {
    warn(`getHistory(${fullName}) failed`, err);
    return [];
  }
}

/** A repository timeline event as returned to API clients. */
export interface RepositoryEventRecord {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  pillar: string | null;
  healthDelta: number | null;
  occurredAt: string;
  createdAt: string;
}

/** Input for {@link recordEvent}. */
export interface RepositoryEventInput {
  type: string;
  title: string;
  detail?: string;
  pillar?: string;
  healthDelta?: number;
  payload?: unknown;
  occurredAt: Date | string;
}

/** Default page size for the events timeline. */
const DEFAULT_EVENTS_LIMIT = 50;

/**
 * A stable, positive 32-bit hash of a string. Used to synthesize a `githubId`
 * for a repository first seen through a webhook (before it has been analyzed),
 * so `recordEvent` can create the row without real GitHub metadata.
 */
function hashToInt(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Return the most recent {@link RepositoryEventRecord}s (newest first) for a
 * repository. Empty when the repository is unknown or the database is
 * unavailable — the timeline endpoint stays a 200 either way.
 */
export async function getEvents(
  owner: string,
  repo: string,
  limit: number = DEFAULT_EVENTS_LIMIT,
): Promise<RepositoryEventRecord[]> {
  if (!config.hasDatabase) return [];

  const fullName = `${owner}/${repo}`;
  try {
    const events = await prisma.repositoryEvent.findMany({
      where: { repository: { fullName } },
      orderBy: { occurredAt: 'desc' },
      take: Math.max(1, Math.min(200, Math.floor(limit))),
    });

    return events.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      detail: event.detail,
      pillar: event.pillar,
      healthDelta: event.healthDelta,
      occurredAt: event.occurredAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
    }));
  } catch (err) {
    warn(`getEvents(${fullName}) failed`, err);
    return [];
  }
}

/**
 * Record a repository timeline event: upsert the Repository by its unique
 * fullName, then create a RepositoryEvent. Returns the event id, or null when
 * the database is not configured or the write fails (best-effort — never
 * throws, so callers can fire-and-forget it from a webhook).
 */
export async function recordEvent(
  owner: string,
  repo: string,
  event: RepositoryEventInput,
): Promise<string | null> {
  if (!config.hasDatabase) return null;

  const fullName = `${owner}/${repo}`;
  try {
    // The repository may not have been analyzed yet (webhook before scan), so
    // create it with best-effort placeholders; a later saveAnalysis fills in
    // the real metadata via the same fullName key.
    const repository = await prisma.repository.upsert({
      where: { fullName },
      create: {
        githubId: hashToInt(fullName),
        owner,
        name: repo,
        fullName,
        htmlUrl: `https://github.com/${fullName}`,
      },
      update: {},
    });

    const created = await prisma.repositoryEvent.create({
      data: {
        repositoryId: repository.id,
        type: event.type,
        title: event.title,
        detail: event.detail ?? null,
        pillar: event.pillar ?? null,
        healthDelta: typeof event.healthDelta === 'number' ? event.healthDelta : null,
        payload:
          event.payload === undefined
            ? undefined
            : (event.payload as Prisma.InputJsonValue),
        occurredAt: new Date(event.occurredAt),
      },
    });
    return created.id;
  } catch (err) {
    warn(`recordEvent(${fullName}) failed`, err);
    return null;
  }
}

/**
 * Persist an AI Advisor run for a repository. No-op returning null without a
 * database, and never throws — persistence is best-effort.
 */
export async function saveRecommendation(
  owner: string,
  repo: string,
  report: AdvisorReport,
  provider: string = 'heuristic',
): Promise<string | null> {
  if (!config.hasDatabase) return null;

  const fullName = `${owner}/${repo}`;
  try {
    const repository = await prisma.repository.upsert({
      where: { fullName },
      create: {
        githubId: hashToInt(fullName),
        owner,
        name: repo,
        fullName,
        htmlUrl: `https://github.com/${fullName}`,
      },
      update: {},
    });

    const created = await prisma.aIRecommendation.create({
      data: {
        repositoryId: repository.id,
        headline: report.headline,
        summary: report.summary,
        healthDeltaPercent:
          typeof report.healthDeltaPercent === 'number' ? report.healthDeltaPercent : null,
        issues: report.issues as unknown as Prisma.InputJsonValue,
        provider,
      },
    });
    return created.id;
  } catch (err) {
    warn(`saveRecommendation(${fullName}) failed`, err);
    return null;
  }
}
