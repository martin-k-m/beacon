import type { FastifyPluginAsync } from 'fastify';

import { getDemoAnalyses } from '../service';

/**
 * Returns analyses for the built-in demo repositories. Fully offline — works
 * with zero configuration (no GitHub token, database, or Redis required).
 */
export const demoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/demo', async () => {
    const analyses = await getDemoAnalyses();
    return analyses;
  });
};
