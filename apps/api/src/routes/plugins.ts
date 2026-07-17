import { GitHubError } from '@beacon/github';
import type { PluginMetric, PluginRecommendation } from '@beacon/plugins';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';

import { describePlugins, registry } from '../plugins';
import { getAnalysis } from '../service';

const repoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

/**
 * Same error translation the analyze/intelligence routes use: GitHub 404 → 404,
 * rate-limited 403 → 429, other 403 → 403, other GitHub failures → 502,
 * malformed identifiers → 400. Returns null when we don't translate the error.
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

export interface RepositoryPluginOutput {
  metrics: PluginMetric[];
  recommendations: PluginRecommendation[];
}

/**
 * Plugin introspection and per-repository plugin output.
 *
 * With no plugins configured both endpoints still answer `200` with empty
 * collections — "no plugins" is a supported configuration, not an error.
 */
export const pluginRoutes: FastifyPluginAsync = async (app) => {
  /** What is loaded in this process. */
  app.get('/api/plugins', async () => ({ plugins: describePlugins() }));

  /**
   * Run every registered analyzer and recommender against a repository.
   * Failure isolation lives in the registry, so one broken plugin degrades to
   * fewer results rather than an error.
   */
  app.get<{ Params: { owner: string; repo: string } }>(
    '/api/repositories/:owner/:repo/plugins',
    async (request, reply) => {
      const params = repoParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid owner/repo.' });
      }
      const { owner, repo } = params.data;
      const full = `${owner}/${repo}`;

      // Skip the GitHub round-trip entirely when nothing would consume it.
      if (registry.plugins.length === 0) {
        return reply.send({ metrics: [], recommendations: [] } satisfies RepositoryPluginOutput);
      }

      try {
        const analysis = await getAnalysis(full);
        const ctx = { snapshot: analysis.snapshot, analysis };
        const [metrics, recommendations] = await Promise.all([
          registry.runAnalyzers(ctx),
          registry.runRecommenders(ctx),
        ]);
        return reply.send({ metrics, recommendations } satisfies RepositoryPluginOutput);
      } catch (err) {
        const translated = replyForError(err, reply, full);
        if (translated) return translated;
        throw err;
      }
    },
  );
};
