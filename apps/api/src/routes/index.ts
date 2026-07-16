import type { FastifyPluginAsync } from 'fastify';

import { analyzeRoutes } from './analyze';
import { demoRoutes } from './demo';
import { healthRoutes } from './health';
import { repositoryRoutes } from './repositories';
import { webhookRoutes } from './webhooks';
import { widgetRoutes } from './widgets';

/** Register every route plugin on the application instance. */
export const routes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(demoRoutes);
  await app.register(analyzeRoutes);
  await app.register(repositoryRoutes);
  await app.register(widgetRoutes);
  await app.register(webhookRoutes);
};
