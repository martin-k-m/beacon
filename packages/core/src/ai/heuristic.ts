import type { BeaconSummary } from '../types';
import type { AIProvider, SummaryInput } from './provider';

/**
 * A deterministic, offline "AI" provider. It composes a natural-language
 * summary from the same signals the hosted models would see, so Beacon
 * produces a useful summary with zero configuration and zero API cost. It is
 * also the fallback when a hosted provider is unavailable.
 */
export class HeuristicProvider implements AIProvider {
  readonly name = 'heuristic';
  readonly model = null;

  async generateSummary(input: SummaryInput): Promise<BeaconSummary> {
    const { snapshot, score } = input;
    const m = snapshot.metadata;
    const sentences: string[] = [];

    const activity = score.pillars.find((p) => p.pillar === 'activity')?.score ?? 0;
    const lastPushDays = Math.round(
      (Date.parse(snapshot.collectedAt) - Date.parse(m.pushedAt)) / (1000 * 60 * 60 * 24),
    );

    if (activity >= 75) {
      sentences.push(
        `${m.name} is actively maintained${
          Number.isFinite(lastPushDays) ? `, with its most recent push ${describeDays(lastPushDays)}` : ''
        }.`,
      );
    } else if (activity >= 45) {
      sentences.push(`${m.name} sees moderate activity, last updated ${describeDays(lastPushDays)}.`);
    } else {
      sentences.push(
        `${m.name} shows limited recent activity; the last push was ${describeDays(lastPushDays)}.`,
      );
    }

    const contributors = snapshot.contributors.length;
    if (contributors >= 20) {
      sentences.push(`It has a broad contributor base of ${contributors}+ people.`);
    } else if (contributors > 1) {
      sentences.push(`Development is carried by ${contributors} contributors.`);
    } else {
      sentences.push('It is effectively a single-maintainer project.');
    }

    const releases = snapshot.releases.length;
    const lastRelease = snapshot.releases.find((r) => r.publishedAt);
    if (releases > 0 && lastRelease?.publishedAt) {
      const relDays = Math.round(
        (Date.parse(snapshot.collectedAt) - Date.parse(lastRelease.publishedAt)) /
          (1000 * 60 * 60 * 24),
      );
      sentences.push(`The latest release, ${lastRelease.tagName}, shipped ${describeDays(relDays)}.`);
    }

    const maintenance = score.pillars.find((p) => p.pillar === 'maintenance')?.score ?? 0;
    if (maintenance < 55) {
      sentences.push(
        `Issue and pull-request throughput is a weak point, with ${snapshot.issues.open} open issues.`,
      );
    }

    const text = `This repository holds a Beacon Score of ${score.total}/100 (${score.grade}). ${sentences.join(' ')}`;

    const highlights = [
      ...score.strengths.slice(0, 2).map((s) => `✓ ${s}`),
      ...score.warnings.slice(0, 2).map((w) => `! ${w}`),
    ];

    return {
      provider: this.name,
      model: this.model,
      text,
      highlights,
      generatedAt: new Date().toISOString(),
    };
  }
}

function describeDays(days: number): string {
  if (!Number.isFinite(days)) return 'at an unknown time';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
