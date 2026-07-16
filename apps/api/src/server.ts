import { buildApp } from './app';
import { cache } from './cache';
import { config } from './config';

/**
 * Process entrypoint: build the app, start listening, and wire graceful
 * shutdown. Warns loudly when running in degraded (zero-infra) mode so the
 * operator knows persistence/caching are limited.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  // Surface the runtime posture up front.
  if (!config.hasDatabase) {
    app.log.warn('No DATABASE_URL configured — persistence is disabled (analyses will not be stored).');
  }
  if (!config.hasRedis) {
    app.log.warn('No REDIS_URL configured — using in-memory cache (not shared across instances).');
  }
  if (!config.githubToken) {
    app.log.warn('No GITHUB_TOKEN configured — live analysis will hit low unauthenticated rate limits.');
  }
  app.log.info(`AI provider: ${config.aiProvider}`);

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Beacon API listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown: stop accepting connections, then release the cache.
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Received ${signal}, shutting down…`);
    try {
      await app.close();
      await cache.close();
      app.log.info('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
