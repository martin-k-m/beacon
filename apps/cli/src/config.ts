/**
 * Configuration for the `beacon` CLI.
 *
 * Two layers stack on top of the environment:
 *
 *  - **Global config** at `~/.beacon/config.json` — the machine-wide account:
 *    the stored GitHub token, an optional Beacon API URL, and the logged-in
 *    user. Written by `beacon login`, cleared by `beacon logout`.
 *  - **Project config** at `.beacon/config.json` or `.beaconrc` (JSON) in a
 *    repository — the tracked repository, dashboard watch-list, ignore globs,
 *    and score threshold.
 *
 * {@link loadConfig} merges environment variables, the global config, and the
 * nearest project config into a single {@link ResolvedConfig}, and
 * {@link resolveClient} turns that into a ready-to-use {@link Beacon} client.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { Beacon } from '@beacon/sdk';

/** The logged-in user, resolved from the GitHub API at login time. */
export interface BeaconUser {
  login: string;
}

/** Machine-wide account config stored at `~/.beacon/config.json`. */
export interface GlobalConfig {
  /** GitHub token (PAT or device-flow token) used for direct analysis. */
  token?: string;
  /** Beacon API base URL, when analyzing through a hosted service. */
  apiUrl?: string;
  /** The currently logged-in user. */
  user?: BeaconUser;
  /** Repositories to surface on the dashboard, machine-wide. */
  tracking?: string[];
}

/** Per-repository config stored at `.beacon/config.json` or `.beaconrc`. */
export interface ProjectConfig {
  /** The repository this project maps to, as `owner/repo`. */
  repository?: string;
  /** Repositories to track on the dashboard for this project. */
  tracking?: string[];
  /** Widget types to surface for this project. */
  widgets?: string[];
  /** Path fragments to skip when analyzing locally. */
  ignore?: string[];
  /** Score below which a repository is flagged on the dashboard. */
  scoreThreshold?: number;
  /** Default poll interval (seconds) for `beacon watch`. */
  watchInterval?: number;
}

/** The fully-merged config every command reads from. */
export interface ResolvedConfig {
  /** Beacon API base URL (env > global). */
  apiUrl?: string;
  /** Beacon API bearer token (env `BEACON_TOKEN`). */
  apiToken?: string;
  /** GitHub token (flag > env `GITHUB_TOKEN` > global). */
  githubToken?: string;
  /** The logged-in user, if any. */
  user?: BeaconUser;
  /** The merged project config (empty object when none is present). */
  project: ProjectConfig;
  /** The raw global config (empty object when none is present). */
  global: GlobalConfig;
  /** Absolute path of the loaded project config file, if any. */
  projectConfigPath?: string;
  /** The directory the config was loaded from. */
  cwd: string;
}

/** Default score threshold for dashboard status when none is configured. */
export const DEFAULT_SCORE_THRESHOLD = 70;

/** Absolute path to the global config directory (`~/.beacon`). */
export function globalConfigDir(): string {
  return join(homedir(), '.beacon');
}

/** Absolute path to the global config file (`~/.beacon/config.json`). */
export function globalConfigPath(): string {
  return join(globalConfigDir(), 'config.json');
}

function parseJsonFile<T>(path: string): T | null {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Read the global config, or an empty object when it does not exist. */
export function readGlobalConfig(): GlobalConfig {
  const parsed = parseJsonFile<GlobalConfig>(globalConfigPath());
  return parsed ?? {};
}

/**
 * Persist the global config, creating `~/.beacon` if needed and tightening the
 * file permissions to `600` (best effort — a no-op on platforms that lack
 * POSIX modes, and never fatal).
 */
export function writeGlobalConfig(config: GlobalConfig): void {
  const dir = globalConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const path = globalConfigPath();
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows and some filesystems do not support chmod — ignore.
  }
}

/** Merge a patch into the stored global config and write it back. */
export function updateGlobalConfig(patch: Partial<GlobalConfig>): GlobalConfig {
  const next = { ...readGlobalConfig(), ...patch };
  writeGlobalConfig(next);
  return next;
}

/** Candidate project-config filenames, in priority order. */
const PROJECT_CONFIG_FILES = ['.beacon/config.json', '.beaconrc'] as const;

/**
 * Find the nearest project config by walking up from `cwd` to the filesystem
 * root. Returns the absolute path of the first match, or `null`.
 */
export function findProjectConfig(cwd: string): string | null {
  let dir = resolve(cwd);
  for (;;) {
    for (const candidate of PROJECT_CONFIG_FILES) {
      const path = join(dir, candidate);
      if (existsSync(path)) {
        return path;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/** Read and parse the nearest project config, or an empty object. */
export function readProjectConfig(cwd: string): {
  config: ProjectConfig;
  path?: string;
} {
  const path = findProjectConfig(cwd);
  if (!path) {
    return { config: {} };
  }
  const parsed = parseJsonFile<ProjectConfig>(path);
  return { config: parsed ?? {}, path };
}

function envValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Merge environment variables, global config, and the nearest project config
 * into a single {@link ResolvedConfig}. Environment variables win over the
 * global config for the API URL and tokens.
 */
export function loadConfig(cwd: string = process.cwd()): ResolvedConfig {
  const global = readGlobalConfig();
  const { config: project, path: projectConfigPath } = readProjectConfig(cwd);

  return {
    apiUrl: envValue('BEACON_API_URL') ?? global.apiUrl,
    apiToken: envValue('BEACON_TOKEN'),
    githubToken: envValue('GITHUB_TOKEN') ?? global.token,
    user: global.user,
    project,
    global,
    projectConfigPath,
    cwd,
  };
}

/** Options that can override the resolved config when building a client. */
export interface ResolveClientOptions {
  /** Explicit GitHub token (e.g. from `--token`), highest priority. */
  githubToken?: string;
  /** AI provider config passed straight through to the SDK. */
  ai?: {
    provider?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    model?: string;
  };
}

/**
 * Build a {@link Beacon} SDK client from a resolved config. When an `apiUrl`
 * is configured the client uses the hosted API (falling back to direct GitHub
 * when a GitHub token is available); otherwise it analyzes directly from
 * GitHub in-process.
 */
export function resolveClient(
  config: ResolvedConfig,
  options: ResolveClientOptions = {},
): Beacon {
  return new Beacon({
    apiUrl: config.apiUrl,
    token: config.apiToken,
    githubToken: options.githubToken ?? config.githubToken,
    ai: options.ai,
  });
}
