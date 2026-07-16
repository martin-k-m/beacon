import type { FastifyPluginAsync } from 'fastify';

import { config } from '../config';
import { API_VERSION } from '../version';

/**
 * Liveness/readiness endpoint. Reports which optional services are enabled so
 * operators can confirm whether the API is running in degraded (zero-infra)
 * mode.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok' as const,
    version: API_VERSION,
    uptime: process.uptime(),
    services: {
      database: config.hasDatabase,
      redis: config.hasRedis,
      aiProvider: config.aiProvider,
    },
  }));
};
