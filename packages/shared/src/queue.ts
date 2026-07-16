/**
 * The shared job-queue contract used by the API (producer) and the worker
 * (consumer). Kept dependency-free so both sides agree on the queue name and
 * job shape without pulling in a queue implementation.
 */

/** BullMQ queue name for repository analysis jobs. */
export const ANALYSIS_QUEUE = 'beacon:analysis';

/** Payload for a single repository-analysis job. */
export interface AnalysisJob {
  /** The `owner/repo` (or full GitHub URL) to analyze. */
  repo: string;
  /** Optional human-readable reason the job was enqueued (e.g. a webhook event). */
  reason?: string;
}
