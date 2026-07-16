import Redis from 'ioredis';

import { config } from './config';

/**
 * Minimal async cache interface used across the service. Two implementations
 * back it: a Redis-backed cache when REDIS_URL is set, and an in-memory Map
 * fallback otherwise so the API is fully runnable with zero infrastructure.
 *
 * Implementations must never throw on backend failures — a cache miss (null)
 * is always an acceptable degraded result.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  close(): Promise<void>;
}

interface MemoryEntry {
  value: string;
  /** Epoch millis after which the entry is considered expired. */
  expiresAt: number;
}

/**
 * In-memory cache with per-key TTL. Suitable for single-process, zero-config
 * runs. Expired entries are evicted lazily on read and opportunistically on
 * write to bound memory use.
 */
class MemoryCache implements Cache {
  private readonly store = new Map<string, MemoryEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      // Corrupt entry — treat as a miss.
      this.store.delete(key);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.pruneExpired();
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async close(): Promise<void> {
    this.store.clear();
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

/**
 * Redis-backed cache. All operations are wrapped so a transient Redis outage
 * degrades to a cache miss instead of failing the request.
 */
class RedisCache implements Cache {
  private readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      // Fail fast rather than queueing commands forever when Redis is down.
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    // A connection-level error listener is required or ioredis emits an
    // unhandled 'error' event that can crash the process.
    this.client.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.warn(`[cache] Redis error (falling back to miss): ${err.message}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[cache] get(${key}) failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[cache] set(${key}) failed: ${(err as Error).message}`);
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // Best-effort shutdown; force-disconnect if quit fails.
      this.client.disconnect();
    }
  }
}

/** Construct the appropriate cache based on runtime configuration. */
export function createCache(): Cache {
  if (config.hasRedis && config.redisUrl) {
    return new RedisCache(config.redisUrl);
  }
  return new MemoryCache();
}

/** Shared cache instance for the process. */
export const cache: Cache = createCache();
