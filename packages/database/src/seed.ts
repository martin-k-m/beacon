/**
 * Seed the database with the analyzed demo repositories — including a synthetic
 * health **history** per repo — so a fresh install has trends to chart. Safe to
 * run repeatedly (it upserts the repository and replaces its analyses).
 */
import { HeuristicProvider } from '@beacon/ai';
import { generateDemoHistory } from '@beacon/analytics';
import { demoSnapshots, type BeaconScore } from '@beacon/shared';
import { prisma } from './index';

async function main(): Promise<void> {
  const ai = new HeuristicProvider();

  for (const snapshot of Object.values(demoSnapshots)) {
    const m = snapshot.metadata;
    const history = generateDemoHistory(snapshot, { points: 12, stepDays: 7 });
    const latest = history[history.length - 1]!;

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

    // Replace prior analyses so re-seeding stays idempotent.
    await prisma.analysis.deleteMany({ where: { repositoryId: repository.id } });

    // The most recent point gets a full AI summary; older points get a short one.
    const latestSummary = await ai.generateSummary({ snapshot, score: latest.score });

    for (const point of history) {
      const isLatest = point === latest;
      const summaryText = isLatest
        ? latestSummary.text
        : shortSummary(m.fullName, point.score);

      await prisma.analysis.create({
        data: {
          repositoryId: repository.id,
          beaconScore: point.score.total,
          grade: point.score.grade,
          pillars: point.score.pillars as unknown as object,
          strengths: point.score.strengths,
          warnings: point.score.warnings,
          summaryText,
          summaryProvider: latestSummary.provider,
          summaryModel: latestSummary.model,
          snapshot: snapshot as unknown as object,
          collectedAt: new Date(point.collectedAt),
        },
      });
    }

    console.log(
      `Seeded ${m.fullName} — ${history.length} snapshots, latest Beacon Score ${latest.score.total}`,
    );
  }
}

function shortSummary(fullName: string, score: BeaconScore): string {
  return `${fullName} held a Beacon Score of ${score.total}/100 (${score.grade}) at this point in time.`;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
