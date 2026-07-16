import { z } from 'zod';

/**
 * Environment schema for the Beacon API.
 *
 * Every external dependency is optional: with no DATABASE_URL, REDIS_URL, or
 * GITHUB_TOKEN the server still boots and serves the demo endpoint. Optional
 * values are coerced/defaulted here so the rest of the app can consume a single
 * strongly-typed `config` object.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // `coerce` lets a string env var become a number; the default covers a
  // missing value entirely.
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  BEACON_AI_PROVIDER: z
    .enum(['heuristic', 'openai', 'anthropic'])
    .default('heuristic'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1).default('*'),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  // Public base URL used to build embed snippets (widget/badge URLs). Falls back
  // to http://localhost:${PORT} when neither is set. BEACON_HOST is accepted as
  // an alias for PUBLIC_URL.
  PUBLIC_URL: z.string().min(1).optional(),
  BEACON_HOST: z.string().min(1).optional(),
  // GitHub App webhook HMAC secret. When set, incoming webhook signatures are
  // verified; when absent, verification is skipped (dev mode).
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  // GitHub App credentials — architecture-ready for authenticated installs.
  // Not required for the service to function today.
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Surface a readable message and exit rather than starting in a broken state.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

/**
 * `corsOrigin` is `true` for the wildcard (reflect any origin) or a concrete
 * list of allowed origins when a comma-separated value is provided.
 */
function resolveCorsOrigin(value: string): boolean | string[] {
  if (value === '*') return true;
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}

export interface BeaconApiConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  githubToken: string | undefined;
  aiProvider: 'heuristic' | 'openai' | 'anthropic';
  openaiApiKey: string | undefined;
  anthropicApiKey: string | undefined;
  corsOrigin: boolean | string[];
  cacheTtlSeconds: number;
  /** Public base URL (no trailing slash) used to build embed snippets. */
  publicUrl: string;
  /** GitHub App webhook HMAC secret, if configured. */
  webhookSecret: string | undefined;
  /** True when a webhook secret is configured (signature verification on). */
  hasWebhookSecret: boolean;
  /** GitHub App ID — architecture-ready for authenticated installs. */
  githubAppId: string | undefined;
  /** GitHub App private key (PEM) — architecture-ready for App installs. */
  githubAppPrivateKey: string | undefined;
  /** True when a database is configured and persistence is available. */
  hasDatabase: boolean;
  /** True when Redis is configured (otherwise an in-memory cache is used). */
  hasRedis: boolean;
}

/** Resolve the public base URL, stripping any trailing slash. */
function resolvePublicUrl(
  explicit: string | undefined,
  alias: string | undefined,
  port: number,
): string {
  const value = explicit ?? alias ?? `http://localhost:${port}`;
  return value.replace(/\/$/, '');
}

export const config: BeaconApiConfig = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  host: env.HOST,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  githubToken: env.GITHUB_TOKEN,
  aiProvider: env.BEACON_AI_PROVIDER,
  openaiApiKey: env.OPENAI_API_KEY,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  corsOrigin: resolveCorsOrigin(env.CORS_ORIGIN),
  cacheTtlSeconds: env.CACHE_TTL_SECONDS,
  publicUrl: resolvePublicUrl(env.PUBLIC_URL, env.BEACON_HOST, env.PORT),
  webhookSecret: env.GITHUB_WEBHOOK_SECRET,
  hasWebhookSecret: Boolean(env.GITHUB_WEBHOOK_SECRET),
  githubAppId: env.GITHUB_APP_ID,
  githubAppPrivateKey: env.GITHUB_APP_PRIVATE_KEY,
  hasDatabase: Boolean(env.DATABASE_URL),
  hasRedis: Boolean(env.REDIS_URL),
};
