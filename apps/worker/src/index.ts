/**
 * @beacon/worker — a long-running process that consumes repository-analysis
 * jobs from Redis (BullMQ), runs the full analysis via @beacon/analytics, and
 * persists the result via @beacon/database.
 *
 * Degrades gracefully: with no REDIS_URL configured it does not crash — it logs
 * a clear message and idles (jobs are processed inline by the API instead).
 */
import { analyzeRepository } from '@beacon/analytics';
import { ANALYSIS_QUEUE, type AnalysisJob } from '@beacon/shared';
import { Worker, type Job } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';

import { config, hasRedis } from './config';
import { saveAnalysis } from './store';

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[worker] ${message}`);
}

function logError(message: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[worker] ${message}: ${(err as Error).message}`);
}

/** Process a single analysis job: analyze the repo, then persist the result. */
async function processJob(job: Job<AnalysisJob>): Promise<void> {
  const { repo, reason } = job.data;
  log(`Analyzing ${repo}${reason ? ` (${reason})` : ''}…`);

  const analysis = await analyzeRepository(repo, {
    githubToken: config.githubToken,
    ai: {
      provider: config.aiProvider,
      openaiApiKey: config.openaiApiKey,
      anthropicApiKey: config.anthropicApiKey,
    },
  });

  await saveAnalysis(analysis);
  log(`Done ${repo} — Beacon Score ${analysis.score.total}/100 (${analysis.score.grade}).`);
}

/**
 * Idle mode: keep the process alive with a periodic heartbeat so container
 * orchestrators see a healthy, running process even though there is nothing to
 * consume. Returns a cleanup function.
 */
function startIdle(): () => void {
  log('No REDIS_URL — worker idle (jobs will be processed inline by the API).');
  // The interval is intentionally *not* unref'd: it keeps the event loop alive
  // so the process idles (rather than exiting) until it receives a shutdown
  // signal, mirroring how a real worker would wait for work.
  const timer = setInterval(() => {
    log('Idle — waiting for REDIS_URL to be configured.');
  }, 60_000);
  return () => clearInterval(timer);
}

async function main(): Promise<void> {
  if (!hasRedis || !config.redisUrl) {
    const stopIdle = startIdle();
    installShutdown(async () => {
      stopIdle();
    });
    return;
  }

  const connection: Redis = new IORedis(config.redisUrl, {
    // BullMQ requires this for blocking commands used by workers.
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<AnalysisJob>(
    ANALYSIS_QUEUE,
    async (job) => {
      // Never let a single failed job crash the worker — BullMQ catches thrown
      // errors and marks the job failed (with retries/backoff), so we log and
      // rethrow so the job is retried rather than silently dropped.
      try {
        await processJob(job);
      } catch (err) {
        logError(`job ${job.id} (${job.data.repo}) failed`, err);
        throw err;
      }
    },
    { connection, concurrency: config.concurrency },
  );

  worker.on('failed', (job, err) => {
    logError(`job ${job?.id ?? '?'} failed after attempts`, err);
  });
  worker.on('error', (err) => {
    logError('worker error', err);
  });

  log(
    `Listening on "${ANALYSIS_QUEUE}" (concurrency ${config.concurrency})` +
      `${config.hasDatabase ? '' : ' — no DATABASE_URL, results will not be persisted'}.`,
  );

  installShutdown(async () => {
    log('Shutting down…');
    await worker.close();
    connection.disconnect();
  });
}

/** Wire graceful shutdown on SIGINT/SIGTERM, running `cleanup` once. */
function installShutdown(cleanup: () => Promise<void>): void {
  let shuttingDown = false;
  const handler = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Received ${signal}.`);
    cleanup()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        logError('shutdown failed', err);
        process.exit(1);
      });
  };
  process.on('SIGINT', () => handler('SIGINT'));
  process.on('SIGTERM', () => handler('SIGTERM'));
}

void main().catch((err: unknown) => {
  logError('fatal', err);
  process.exit(1);
});
