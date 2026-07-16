import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { cache } from '../cache';
import { config } from '../config';
import { getHistory, getLatestAnalysis, listRepositories } from '../store';
import type { BeaconAnalysis } from '@beacon/core';

const repoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
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
};
