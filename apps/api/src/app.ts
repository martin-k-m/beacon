import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

import { config } from './config';
import { routes } from './routes';

/**
 * Build and configure a Fastify instance: logging, CORS, routes, and JSON
 * error/not-found handlers. Exported (rather than started) so tests and the
 * server entrypoint can share the exact same wiring.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv === 'test' ? false : { level: config.nodeEnv === 'production' ? 'info' : 'debug' },
    // Trust proxy headers so client IPs / protocol are correct behind a load
    // balancer (common in container deployments).
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.corsOrigin,
  });

  // Parse JSON as usual for every route, but also retain the raw request bytes
  // on `request.rawBody`. Webhook signature verification (GitHub's
  // X-Hub-Signature-256) must run against the exact bytes received, not a
  // re-serialized object. All other routes continue to receive parsed JSON.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      (req as { rawBody?: Buffer }).rawBody = body as Buffer;
      try {
        const text = (body as Buffer).toString('utf8');
        done(null, text.length ? JSON.parse(text) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(routes);

  // Consistent JSON 404 for unknown routes.
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not found',
      message: `Route ${request.method} ${request.url} does not exist.`,
    });
  });

  // Global error handler: log and return a JSON envelope. Fastify's built-in
  // validation errors carry a `statusCode`; everything else is a 500.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(error);
    }
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : error.name,
      message: statusCode >= 500 && config.nodeEnv === 'production' ? undefined : error.message,
    });
  });

  return app;
}
