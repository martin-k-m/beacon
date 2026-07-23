/**
 * Registry clients that fetch package metadata from public package registries.
 *
 * Every client is dependency-free (uses the global `fetch`), never throws
 * (returns `null` on any error / timeout / non-200), and applies a small
 * request timeout via {@link AbortController}. Clients are constructed with an
 * optional `fetch` override so the engine can be tested fully offline.
 */

import type { DependencyEcosystem, RegistryClient, RegistryPackageInfo } from './types';

/** Default per-request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 8000;

export interface RegistryClientOptions {
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds (default 8000). */
  timeoutMs?: number;
}

/**
 * Perform a GET returning parsed JSON, or `null` on any failure.
 * Never throws.
 */
async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...headers,
      },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Narrow an unknown value to a record for safe property access. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * npm registry client — reads `https://registry.npmjs.org/<name>`.
 *
 * Uses `dist-tags.latest` for the latest version, the `time` map for the last
 * publish timestamp, top-level `license`, and detects deprecation via the
 * `deprecated` field on the latest version's manifest.
 */
export class NpmRegistryClient implements RegistryClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(options: RegistryClientOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public async getPackage(
    _ecosystem: DependencyEcosystem,
    name: string,
  ): Promise<RegistryPackageInfo | null> {
    // Scoped names (`@scope/pkg`) keep their `@` and use `%2f` for the slash;
    // unscoped names are percent-encoded normally.
    const encoded = name.startsWith('@') ? name.replace('/', '%2f') : encodeURIComponent(name);
    const url = `https://registry.npmjs.org/${encoded}`;
    const body = asRecord(await fetchJson(this.fetchImpl, url, this.timeoutMs));
    if (!body) {
      return null;
    }

    const distTags = asRecord(body['dist-tags']);
    const latestVersion = distTags ? asString(distTags['latest']) : undefined;

    const time = asRecord(body['time']);
    let lastPublished: string | undefined;
    if (time && latestVersion) {
      lastPublished = asString(time[latestVersion]) ?? asString(time['modified']);
    } else if (time) {
      lastPublished = asString(time['modified']);
    }

    const license = normalizeLicense(body['license']);

    // Deprecation lives on the latest version's manifest.
    let deprecated = false;
    const versions = asRecord(body['versions']);
    if (versions && latestVersion) {
      const manifest = asRecord(versions[latestVersion]);
      if (manifest && typeof manifest['deprecated'] !== 'undefined') {
        deprecated = manifest['deprecated'] !== false;
      }
    }

    return {
      ...(latestVersion ? { latestVersion } : {}),
      ...(license ? { license } : {}),
      ...(lastPublished ? { lastPublished } : {}),
      deprecated,
    };
  }
}

/**
 * PyPI registry client — reads `https://pypi.org/pypi/<name>/json`.
 */
export class PyPiRegistryClient implements RegistryClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(options: RegistryClientOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public async getPackage(
    _ecosystem: DependencyEcosystem,
    name: string,
  ): Promise<RegistryPackageInfo | null> {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const body = asRecord(await fetchJson(this.fetchImpl, url, this.timeoutMs));
    if (!body) {
      return null;
    }

    const info = asRecord(body['info']);
    const latestVersion = info ? asString(info['version']) : undefined;
    const license = info ? normalizeLicense(info['license']) : undefined;

    // Last publish = newest upload time across the latest release's files.
    let lastPublished: string | undefined;
    const releases = asRecord(body['releases']);
    if (releases && latestVersion) {
      const files = releases[latestVersion];
      if (Array.isArray(files)) {
        for (const file of files) {
          const record = asRecord(file);
          const uploaded = record
            ? (asString(record['upload_time_iso_8601']) ?? asString(record['upload_time']))
            : undefined;
          if (uploaded && (!lastPublished || uploaded > lastPublished)) {
            lastPublished = uploaded;
          }
        }
      }
    }

    return {
      ...(latestVersion ? { latestVersion } : {}),
      ...(license ? { license } : {}),
      ...(lastPublished ? { lastPublished } : {}),
      deprecated: false,
    };
  }
}

/**
 * crates.io registry client — reads `https://crates.io/api/v1/crates/<name>`.
 *
 * crates.io requires a descriptive `User-Agent`; requests without one are
 * rejected, so one is always sent.
 */
export class CratesRegistryClient implements RegistryClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  public constructor(options: RegistryClientOptions & { userAgent?: string } = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = options.userAgent ?? 'beacon-dependency-engine (https://github.com/beacon)';
  }

  public async getPackage(
    _ecosystem: DependencyEcosystem,
    name: string,
  ): Promise<RegistryPackageInfo | null> {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
    const body = asRecord(
      await fetchJson(this.fetchImpl, url, this.timeoutMs, {
        'user-agent': this.userAgent,
      }),
    );
    if (!body) {
      return null;
    }

    const crate = asRecord(body['crate']);
    const latestVersion = crate
      ? (asString(crate['max_stable_version']) ?? asString(crate['newest_version']))
      : undefined;
    const lastPublished = crate ? asString(crate['updated_at']) : undefined;

    // License lives on the version entries; use the first (newest) one.
    let license: string | undefined;
    const versions = body['versions'];
    if (Array.isArray(versions)) {
      const first = asRecord(versions[0]);
      license = first ? normalizeLicense(first['license']) : undefined;
    }

    return {
      ...(latestVersion ? { latestVersion } : {}),
      ...(license ? { license } : {}),
      ...(lastPublished ? { lastPublished } : {}),
      deprecated: false,
    };
  }
}

/**
 * Routes a lookup to the right per-ecosystem client.
 *
 * Ecosystems without a bundled client (`go`, `maven`, `gradle`, `rubygems`,
 * `composer`, `unknown`) return `null`, which the engine treats as `unknown`.
 */
export class MultiRegistryClient implements RegistryClient {
  private readonly npm: RegistryClient;
  private readonly pypi: RegistryClient;
  private readonly crates: RegistryClient;

  public constructor(options: RegistryClientOptions = {}) {
    this.npm = new NpmRegistryClient(options);
    this.pypi = new PyPiRegistryClient(options);
    this.crates = new CratesRegistryClient(options);
  }

  public async getPackage(
    ecosystem: DependencyEcosystem,
    name: string,
  ): Promise<RegistryPackageInfo | null> {
    switch (ecosystem) {
      case 'npm':
        return this.npm.getPackage(ecosystem, name);
      case 'pip':
        return this.pypi.getPackage(ecosystem, name);
      case 'cargo':
        return this.crates.getPackage(ecosystem, name);
      case 'go':
      case 'maven':
      case 'gradle':
      case 'rubygems':
      case 'composer':
      case 'unknown':
        return null;
      default:
        return null;
    }
  }
}

/**
 * A registry that never reaches the network. Every lookup returns `null`, so
 * every dependency is classified as `unknown`. Useful for air-gapped runs.
 */
export class OfflineRegistryClient implements RegistryClient {
  public async getPackage(
    _ecosystem: DependencyEcosystem,
    _name: string,
  ): Promise<RegistryPackageInfo | null> {
    return Promise.resolve(null);
  }
}

/**
 * Coerce the many shapes a registry uses for `license` into a display string.
 * npm and others sometimes report an object (`{ type: 'MIT' }`) or an SPDX
 * string; PyPI reports a free-text string.
 */
function normalizeLicense(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  const record = asRecord(value);
  if (record) {
    const type = asString(record['type']);
    if (type) {
      return type;
    }
  }
  return undefined;
}
