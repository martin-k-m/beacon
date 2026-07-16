import { Prisma, prisma } from '@beacon/database';
import type { BeaconAnalysis } from '@beacon/shared';

import { config } from './config';

/**
 * Persist a completed analysis, mirroring `apps/api/src/store.ts`'s
 * `saveAnalysis`: upsert the Repository by its unique `fullName` and append a
 * new Analysis row. A no-op when no database is configured, and never throws —
 * a persistence failure must not crash the worker or fail a job.
 */
export async function saveAnalysis(analysis: BeaconAnalysis): Promise<void> {
  if (!config.hasDatabase) return;

  const { snapshot, score, summary } = analysis;
  const m = snapshot.metadata;

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
}
