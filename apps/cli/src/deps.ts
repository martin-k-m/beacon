/**
 * Local dependency-manifest **parsing** for `beacon dependencies`.
 *
 * Where {@link detectManifests} (in `local/manifests.ts`) only counts declared
 * dependencies, this module turns the manifests at a project root into concrete
 * {@link DependencyInput}s — name + ecosystem + a best-effort current version —
 * so the dependency engine can look each one up against its registry.
 *
 * Parsers are pure over the filesystem and never throw: an unreadable or
 * malformed manifest simply contributes nothing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DependencyInput } from '@beacon/dependency-engine';

/** The manifests we parse and the ecosystem each maps to. */
const MANIFEST_FILES = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Cargo.toml',
] as const;

export interface ParsedManifests {
  /** Every dependency parsed across all manifests found. */
  deps: DependencyInput[];
  /** The manifest filenames that were present at the root. */
  found: string[];
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Strip a leading range operator (`^`, `~`, `>=`, `<=`, `v`, whitespace) and
 * return the first semver-like token, or `undefined` when there is no concrete
 * version (e.g. `*`, `latest`, `workspace:*`, a git URL).
 */
export function cleanVersion(raw: string): string | undefined {
  const match = /\d+(?:\.\d+)*/.exec(raw.trim());
  return match ? match[0] : undefined;
}

function withVersion(
  name: string,
  ecosystem: DependencyInput['ecosystem'],
  version: string | undefined,
): DependencyInput {
  const dep: DependencyInput = { name, ecosystem };
  if (version) {
    dep.currentVersion = version;
  }
  return dep;
}

/** Parse `package.json` `dependencies` + `devDependencies` (ecosystem `npm`). */
export function parsePackageJson(raw: string): DependencyInput[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }
  const out: DependencyInput[] = [];
  for (const section of ['dependencies', 'devDependencies'] as const) {
    const deps = parsed[section];
    if (deps && typeof deps === 'object') {
      for (const [name, version] of Object.entries(deps as Record<string, unknown>)) {
        out.push(withVersion(name, 'npm', cleanVersion(String(version))));
      }
    }
  }
  return out;
}

/** Parse `requirements.txt` (ecosystem `pip`). */
export function parseRequirements(raw: string): DependencyInput[] {
  const out: DependencyInput[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('-')) {
      continue;
    }
    const nameMatch = /^([A-Za-z0-9._-]+)/.exec(trimmed);
    if (!nameMatch || !nameMatch[1]) {
      continue;
    }
    const versionMatch = /[=~!<>]=?\s*([0-9][^,;\s]*)/.exec(trimmed);
    out.push(
      withVersion(
        nameMatch[1],
        'pip',
        versionMatch && versionMatch[1] ? cleanVersion(versionMatch[1]) : undefined,
      ),
    );
  }
  return out;
}

/**
 * Parse `pyproject.toml` (ecosystem `pip`) — both the PEP 621
 * `[project] dependencies = [...]` array and `[tool.poetry.dependencies]`.
 */
export function parsePyproject(raw: string): DependencyInput[] {
  const out: DependencyInput[] = [];

  // PEP 621 / Poetry PEP 621: dependencies = [ "requests>=2.0", "flask" ]
  const arrayBody = /dependencies\s*=\s*\[([\s\S]*?)\]/.exec(raw)?.[1];
  if (arrayBody) {
    for (const rawItem of arrayBody.split(',')) {
      const item = rawItem.trim().replace(/^["']|["']$/g, '');
      if (item.length === 0) {
        continue;
      }
      const nameMatch = /^([A-Za-z0-9._-]+)/.exec(item);
      if (!nameMatch || !nameMatch[1]) {
        continue;
      }
      const versionMatch = /[=~!<>]=?\s*([0-9][^,;\s]*)/.exec(item);
      out.push(
        withVersion(
          nameMatch[1],
          'pip',
          versionMatch && versionMatch[1] ? cleanVersion(versionMatch[1]) : undefined,
        ),
      );
    }
  }

  // [tool.poetry.dependencies] — name = "^1.0" | name = { version = "^1.0" }.
  const section = /\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|$)/.exec(raw)?.[1];
  if (section) {
    for (const line of section.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }
      const nameMatch = /^([A-Za-z0-9._-]+)\s*=/.exec(trimmed);
      if (!nameMatch || !nameMatch[1]) {
        continue;
      }
      const name = nameMatch[1];
      if (name.toLowerCase() === 'python') {
        continue;
      }
      const versionMatch =
        /version\s*=\s*"([^"]+)"/.exec(trimmed) ?? /=\s*"([^"]+)"/.exec(trimmed);
      out.push(
        withVersion(
          name,
          'pip',
          versionMatch && versionMatch[1] ? cleanVersion(versionMatch[1]) : undefined,
        ),
      );
    }
  }

  return out;
}

/** Parse `Cargo.toml` `[dependencies]` (ecosystem `cargo`). */
export function parseCargo(raw: string): DependencyInput[] {
  const section = /\[dependencies\]([\s\S]*?)(\n\[|$)/.exec(raw)?.[1];
  if (!section) {
    return [];
  }
  const out: DependencyInput[] = [];
  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const nameMatch = /^([A-Za-z0-9._-]+)\s*=/.exec(trimmed);
    if (!nameMatch || !nameMatch[1]) {
      continue;
    }
    // Either `name = "1.0"` or `name = { version = "1.0", … }`.
    const versionMatch =
      /version\s*=\s*"([^"]+)"/.exec(trimmed) ?? /=\s*"([^"]+)"/.exec(trimmed);
    out.push(
      withVersion(
        nameMatch[1],
        'cargo',
        versionMatch && versionMatch[1] ? cleanVersion(versionMatch[1]) : undefined,
      ),
    );
  }
  return out;
}

/**
 * Parse every supported manifest at `root` into a flat {@link DependencyInput}
 * list, reporting which manifest files were found so the caller can honestly
 * say "no manifests" when the list is empty.
 */
export function parseManifests(root: string): ParsedManifests {
  const deps: DependencyInput[] = [];
  const found: string[] = [];

  for (const file of MANIFEST_FILES) {
    const path = join(root, file);
    if (!existsSync(path)) {
      continue;
    }
    const raw = readFileSafe(path);
    if (raw === null) {
      continue;
    }
    found.push(file);

    switch (file) {
      case 'package.json':
        deps.push(...parsePackageJson(raw));
        break;
      case 'requirements.txt':
        deps.push(...parseRequirements(raw));
        break;
      case 'pyproject.toml':
        deps.push(...parsePyproject(raw));
        break;
      case 'Cargo.toml':
        deps.push(...parseCargo(raw));
        break;
    }
  }

  return { deps, found };
}
