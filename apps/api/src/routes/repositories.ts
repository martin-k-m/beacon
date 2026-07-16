import { computeTrend, toHealthSeries, type TrendRange } from '@beacon/analytics';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { cache } from '../cache';
import { config } from '../config';
import {
  getHistory,
  getLatestAnalysis,
  getScoreHistory,
  listRepositories,
} from '../store';
import type { BeaconAnalysis } from '@beacon/core';

const repoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const trendQuerySchema = z.object({
  range: z.enum(['30d', '90d', '1y', 'all']).default('30d'),
});

/**
 * Read-only endpoints backed by the persistence layer (and cache). All degrade
 * to empty results / 404 when no database is configured.
 */
export const repositoryRoutes: FastifyPluginAsync = async (app) => {
  // List all stored repositories with their latest score.
  app.get('/api/repositories', async () => {
    const repositories = await listRepositories();
    return repositories;
  });

  // Latest analysis for a single repository.
  app.get('/api/repositories/:owner/:repo', async (request, reply) => {
    const params = repoParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid repository path' });
    }
    const { owner, repo } = params.data;
    const key = `analysis:${owner.toLowerCase()}/${repo.toLowerCase()}`;

    // Prefer the warm cache, then fall back to the store.
    const cached = await cache.get<BeaconAnalysis>(key);
    if (cached) return cached;

    const stored = await getLatestAnalysis(owner, repo);
    if (stored) {
      await cache.set(key, stored, config.cacheTtlSeconds);
      return stored;
    }

    return reply.status(404).send({
      error: `No analysis found for ${owner}/${repo}.`,
      hint: 'POST /api/analyze with { "repo": "' + owner + '/' + repo + '" } to create one.',
    });
  });

  // Historical analyses (newest first) for a repository.
  app.get('/api/repositories/:owner/:repo/history', async (request, reply) => {
    const params = repoParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid repository path' });
    }
    const { owner, repo } = params.data;
    const history = await getHistory(owner, repo);
    return history;
  });

  // Health trend over a time range, plus the underlying series for charting.
  // Degrades gracefully: with no stored history (or no DB) it returns a
  // zero-point trend and an empty series — still 200, never an error.
  app.get('/api/repositories/:owner/:repo/trend', async (request, reply) => {
    const params = repoParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'Invalid repository path' });
    }
    const query = trendQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({
        error: 'Invalid range',
        hint: 'range must be one of 30d, 90d, 1y, all.',
      });
    }

    const { owner, repo } = params.data;
    const range: TrendRange = query.data.range;

    const entries = await getScoreHistory(owner, repo);
    const series = toHealthSeries(entries);
    const trend = computeTrend(series, range);

    return { range, trend, series };
  });
};
