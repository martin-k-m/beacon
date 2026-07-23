import { generateAdvice, type AdvisorReport } from '@beacon/ai-advisor';
import {
  computeContributorHealth,
  computeTrend,
  toHealthSeries,
  type TrendResult,
} from '@beacon/analytics';
import { GitHubError } from '@beacon/github';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';

import { config } from '../config';
import { getAnalysis } from '../service';
import { getEvents, getScoreHistory, saveRecommendation } from '../store';

const repoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

/**
 * Map a thrown error to a Fastify reply the same way the analyze route does:
 * GitHub 404 → 404, rate-limited 403 → 429, other 403 → 403, other GitHub
 * failures → 502, malformed identifiers → 400. Returns `null` when the error is
 * not one we translate (the caller rethrows for the global 500 handler).
 */
function replyForError(err: unknown, reply: FastifyReply, repo: string): FastifyReply | null {
  if (err instanceof GitHubError) {
    if (err.status === 404) {
      return reply.status(404).send({ error: `Repository not found: ${repo}` });
    }
    if (err.status === 403 && /rate limit|abuse|secondary/i.test(err.message)) {
      return reply
        .status(429)
        .send({ error: 'GitHub rate limit exceeded. Try again later or configure GITHUB_TOKEN.' });
    }
    if (err.status === 403) {
      return reply.status(403).send({ error: err.message });
    }
    return reply.status(502).send({ error: `GitHub request failed: ${err.message}` });
  }
  if (err instanceof Error && /Invalid repository/i.test(err.message)) {
    return reply.status(400).send({ error: err.message });
  }
  return null;
}

/**
 * Phase 2 intelligence endpoints: AI Advisor insights, contributor/team-health,
 * and the stored repository event timeline. All are repository-scoped and reuse
 * the same analysis + persistence layers as the rest of the API.
 */
export const intelligenceRoutes: FastifyPluginAsync = async (app) => {
  // AI Advisor recommendations for a repository.
  app.get('/api/repositories/:owner/:repo/insights', async (request, reply) => {
    const params = repoParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid repository path' });
    }
    const { owner, repo } = params.data;
    const fullName = `${owner}/${repo}`;

    try {
      const analysis = await getAnalysis(fullName);

      // Build a trend from stored history when we have any; otherwise skip it.
      const entries = await getScoreHistory(owner, repo);
      let trend: TrendResult | undefined;
      if (entries.length >= 2) {
        trend = computeTrend(toHealthSeries(entries), '90d');
      }

      const report: AdvisorReport = await generateAdvice(
        { analysis, ...(trend ? { trend } : {}) },
        {
          ai: {
            provider: config.aiProvider,
            openaiApiKey: config.openaiApiKey,
            anthropicApiKey: config.anthropicApiKey,
          },
        },
      );

      // Persist the run (best-effort; no-op without a DB, never throws).
      void saveRecommendation(owner, repo, report, config.aiProvider);

      return report;
    } catch (err) {
      const handled = replyForError(err, reply, fullName);
      if (handled) return handled;
      throw err;
    }
  });

  // Contributor / team-health signals for a repository.
  app.get('/api/repositories/:owner/:repo/contributors', async (request, reply) => {
    const params = repoParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid repository path' });
    }
    const { owner, repo } = params.data;
    const fullName = `${owner}/${repo}`;

    try {
      const analysis = await getAnalysis(fullName);
      return computeContributorHealth(analysis.snapshot);
    } catch (err) {
      const handled = replyForError(err, reply, fullName);
      if (handled) return handled;
      throw err;
    }
  });

  // Stored repository timeline events (empty [] without a database — still 200).
  app.get('/api/repositories/:owner/:repo/events', async (request, reply) => {
    const params = repoParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid repository path' });
    }
    const { owner, repo } = params.data;
    const events = await getEvents(owner, repo);
    return events;
  });
};
