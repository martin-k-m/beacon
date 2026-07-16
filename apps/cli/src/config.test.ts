import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  findProjectConfig,
  loadConfig,
  readGlobalConfig,
  readProjectConfig,
  writeGlobalConfig,
} from './config';

/** A scratch directory tree, plus an isolated fake home for global config. */
let root: string;
let home: string;
let project: string;
const savedEnv: Record<string, string | undefined> = {};

const ENV_KEYS = ['BEACON_API_URL', 'BEACON_TOKEN', 'GITHUB_TOKEN', 'HOME', 'USERPROFILE'];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'beacon-cfg-'));
  home = join(root, 'home');
  project = join(root, 'project');
  mkdirSync(home, { recursive: true });
  mkdirSync(project, { recursive: true });

  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  // Isolate the global config to the fake home.
  process.env.HOME = home;
  process.env.USERPROFILE = home;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  rmSync(root, { recursive: true, force: true });
});

function writeProjectConfig(dir: string, config: unknown): void {
  const beaconDir = join(dir, '.beacon');
  mkdirSync(beaconDir, { recursive: true });
  writeFileSync(join(beaconDir, 'config.json'), JSON.stringify(config), 'utf8');
}

describe('project config discovery', () => {
  it('finds .beacon/config.json in the current directory', () => {
    writeProjectConfig(project, { repository: 'acme/widget' });
    expect(findProjectConfig(project)).toBe(join(project, '.beacon', 'config.json'));
  });

  it('walks up to a parent directory', () => {
    writeProjectConfig(project, { repository: 'acme/widget' });
    const nested = join(project, 'src', 'deep');
    mkdirSync(nested, { recursive: true });
    expect(findProjectConfig(nested)).toBe(join(project, '.beacon', 'config.json'));
  });

  it('returns an empty config when none exists', () => {
    expect(readProjectConfig(project)).toEqual({ config: {} });
  });

  it('reads a .beaconrc JSON file', () => {
    writeFileSync(join(project, '.beaconrc'), JSON.stringify({ scoreThreshold: 80 }), 'utf8');
    expect(readProjectConfig(project).config.scoreThreshold).toBe(80);
  });
});

describe('global config', () => {
  it('round-trips through the fake home', () => {
    writeGlobalConfig({ token: 'gho_test', user: { login: 'octocat' } });
    const read = readGlobalConfig();
    expect(read.token).toBe('gho_test');
    expect(read.user?.login).toBe('octocat');
  });
});

describe('loadConfig merge', () => {
  it('prefers environment variables over the global config', () => {
    writeGlobalConfig({ apiUrl: 'https://global.example', token: 'global-token' });
    process.env.BEACON_API_URL = 'https://env.example';
    process.env.GITHUB_TOKEN = 'env-token';

    const config = loadConfig(project);
    expect(config.apiUrl).toBe('https://env.example');
    expect(config.githubToken).toBe('env-token');
  });

  it('falls back to the global config when env is unset', () => {
    writeGlobalConfig({ apiUrl: 'https://global.example', token: 'global-token' });
    const config = loadConfig(project);
    expect(config.apiUrl).toBe('https://global.example');
    expect(config.githubToken).toBe('global-token');
  });

  it('exposes the merged project config', () => {
    writeProjectConfig(project, {
      repository: 'acme/widget',
      scoreThreshold: 85,
      tracking: ['acme/widget', 'acme/other'],
    });
    const config = loadConfig(project);
    expect(config.project.repository).toBe('acme/widget');
    expect(config.project.scoreThreshold).toBe(85);
    expect(config.project.tracking).toEqual(['acme/widget', 'acme/other']);
  });
});
