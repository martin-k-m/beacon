import { z } from 'zod';

/**
 * Environment schema for the Beacon worker.
 *
 * Every dependency is optional so the process always boots: with no REDIS_URL
 * the worker idles (jobs are processed inline by the API instead); with no
 * DATABASE_URL a completed analysis simply isn't persisted. Values are
 * coerced/defaulted here so the rest of the process consumes a single typed
 * `config` object.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  REDIS_URL: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  BEACON_AI_PROVIDER: z
    .enum(['heuristic', 'openai', 'anthropic'])
    .default('heuristic'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Number of jobs processed concurrently by a single worker instance.
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

export interface BeaconWorkerConfig {
  nodeEnv: 'development' | 'test' | 'production';
  redisUrl: string | undefined;
  databaseUrl: string | undefined;
  githubToken: string | undefined;
  aiProvider: 'heuristic' | 'openai' | 'anthropic';
  openaiApiKey: string | undefined;
  anthropicApiKey: string | undefined;
  concurrency: number;
  /** True when Redis is configured and the worker can consume jobs. */
  hasRedis: boolean;
  /** True when a database is configured and analyses can be persisted. */
  hasDatabase: boolean;
}

export const config: BeaconWorkerConfig = {
  nodeEnv: env.NODE_ENV,
  redisUrl: env.REDIS_URL,
  databaseUrl: env.DATABASE_URL,
  githubToken: env.GITHUB_TOKEN,
  aiProvider: env.BEACON_AI_PROVIDER,
  openaiApiKey: env.OPENAI_API_KEY,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  concurrency: env.WORKER_CONCURRENCY,
  hasRedis: Boolean(env.REDIS_URL),
  hasDatabase: Boolean(env.DATABASE_URL),
};

/** Convenience re-export of the Redis flag for the entrypoint. */
export const hasRedis = config.hasRedis;
