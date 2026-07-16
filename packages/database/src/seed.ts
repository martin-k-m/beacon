/**
 * Seed the database with the analyzed demo repositories so a fresh install has
 * something to show. Safe to run repeatedly (upserts by fullName).
 */
import { computeBeaconScore, demoSnapshots, HeuristicProvider } from '@beacon/core';
import { prisma } from './index';

async function main(): Promise<void> {
  const ai = new HeuristicProvider();

  for (const snapshot of Object.values(demoSnapshots)) {
    const score = computeBeaconScore(snapshot);
    const summary = await ai.generateSummary({ snapshot, score });
    const m = snapshot.metadata;

    const repository = await prisma.repository.upsert({
      where: { fullName: m.fullName },
      update: {
        description: m.description,
        stars: m.stars,
        forks: m.forks,
        isArchived: m.isArchived,
        primaryLanguage: m.primaryLanguage,
      },
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
    });

    await prisma.analysis.create({
      data: {
        repositoryId: repository.id,
        beaconScore: score.total,
        grade: score.grade,
        pillars: score.pillars as unknown as object,
        strengths: score.strengths,
        warnings: score.warnings,
        summaryText: summary.text,
        summaryProvider: summary.provider,
        summaryModel: summary.model,
        snapshot: snapshot as unknown as object,
        collectedAt: new Date(snapshot.collectedAt),
      },
    });

    console.log(`Seeded ${m.fullName} — Beacon Score ${score.total}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
