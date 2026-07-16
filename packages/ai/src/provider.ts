import type { BeaconScore, BeaconSummary, RepositorySnapshot } from '@beacon/shared';

export interface SummaryInput {
  snapshot: RepositorySnapshot;
  score: BeaconScore;
}

/**
 * An AI provider turns the structured analysis into a natural-language
 * "Beacon Summary". Implementations must be interchangeable — the heuristic
 * provider works offline, while the OpenAI/Anthropic providers call out to a
 * hosted model. All share this interface so the provider can be swapped via
 * configuration.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string | null;
  generateSummary(input: SummaryInput): Promise<BeaconSummary>;
}

/**
 * Build the shared prompt used by the hosted providers. Kept here so every
 * provider frames the model identically and only the transport differs.
 */
export function buildSummaryPrompt(input: SummaryInput): { system: string; user: string } {
  const { snapshot, score } = input;
  const m = snapshot.metadata;
  const facts = {
    repository: m.fullName,
    description: m.description,
    beaconScore: score.total,
    grade: score.grade,
    stars: m.stars,
    forks: m.forks,
    contributors: snapshot.contributors.length,
    primaryLanguage: m.primaryLanguage,
    openIssues: snapshot.issues.open,
    openPullRequests: snapshot.pullRequests.open,
    lastPush: m.pushedAt,
    releaseCount: snapshot.releases.length,
    lastRelease: snapshot.releases.find((r) => r.publishedAt)?.publishedAt ?? null,
    pillars: score.pillars.map((p) => ({ pillar: p.pillar, score: p.score })),
    strengths: score.strengths,
    warnings: score.warnings,
  };

  const system =
    'You are Beacon, an assistant that writes concise, factual health summaries ' +
    'of open-source GitHub repositories. Write 2–4 sentences in a neutral, ' +
    'analytical tone. Only state things supported by the provided data. Do not ' +
    'invent metrics. Never use marketing language.';

  const user =
    'Write a "Beacon Summary" for the following repository based only on this JSON data:\n\n' +
    JSON.stringify(facts, null, 2) +
    '\n\nReturn only the summary paragraph.';

  return { system, user };
}
