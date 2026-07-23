import { ANALYSIS_QUEUE, type AnalysisJob } from '@beacon/shared';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { config } from './config';

/**
 * Producer side of the analysis job queue.
 *
 * The API enqueues repository-analysis jobs onto Redis (BullMQ); the standalone
 * `@beacon/worker` process consumes them. Everything here degrades gracefully:
 * when no REDIS_URL is configured the queue is never created and
 * {@link enqueueAnalysis} returns `false`, letting the caller fall back to
 * inline analysis. No function ever throws.
 */

let queue: Queue<AnalysisJob> | null = null;
let initialized = false;

/** Lazily create the BullMQ queue, or return null when Redis is unavailable. */
function getQueue(): Queue<AnalysisJob> | null {
  if (initialized) return queue;
  initialized = true;

  if (!config.hasRedis || !config.redisUrl) {
    return null;
  }

  try {
    const connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
    queue = new Queue<AnalysisJob>(ANALYSIS_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  } catch {
    // If the queue can't be constructed (e.g. a malformed URL), behave as if
    // Redis were absent so requests still succeed via the inline fallback.
    queue = null;
  }
  return queue;
}

/**
 * Enqueue a repository for background analysis.
 *
 * @returns `true` when the job was enqueued, `false` when no Redis is
 *   configured (or enqueue failed) — in which case the caller should fall back
 *   to inline analysis. Never throws.
 */
export async function enqueueAnalysis(repo: string, reason?: string): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;

  try {
    await q.add('analyze', { repo, reason }, { jobId: `analyze:${repo.toLowerCase()}` });
    return true;
  } catch {
    return false;
  }
}
