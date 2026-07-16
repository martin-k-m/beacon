import { GitHubError } from '@beacon/core';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { getAnalysis } from '../service';

const analyzeBodySchema = z.object({
  repo: z.string().min(1, 'repo is required'),
  refresh: z.boolean().optional(),
});

/**
 * Determine whether a GitHub 403 is a rate-limit rejection (as opposed to a
 * genuine permission error) so we can respond with 429 Too Many Requests.
 */
function isRateLimit(err: GitHubError): boolean {
  return /rate limit|abuse|secondary/i.test(err.message);
}

/**
 * POST /api/analyze — collect, score, and summarize a repository.
 * Body: { repo: string, refresh?: boolean }.
 */
export const analyzeRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/analyze', async (request, reply) => {
    const parsed = analyzeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const { repo, refresh } = parsed.data;

    try {
      const analysis = await getAnalysis(repo, { refresh });
      return analysis;
    } catch (err) {
      if (err instanceof GitHubError) {
        if (err.status === 404) {
          return reply.status(404).send({ error: `Repository not found: ${repo}` });
        }
        if (err.status === 403 && isRateLimit(err)) {
          return reply
            .status(429)
            .send({ error: 'GitHub rate limit exceeded. Try again later or configure GITHUB_TOKEN.' });
        }
        if (err.status === 403) {
          return reply.status(403).send({ error: err.message });
        }
        // Other GitHub failures surface as a bad gateway upstream error.
        return reply.status(502).send({ error: `GitHub request failed: ${err.message}` });
      }

      // parseRepoIdentifier throws a plain Error for malformed "owner/repo".
      if (err instanceof Error && /Invalid repository/i.test(err.message)) {
        return reply.status(400).send({ error: err.message });
      }

      throw err; // Delegate to the global error handler (500).
    }
  });
};
