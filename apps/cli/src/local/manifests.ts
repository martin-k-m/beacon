/**
 * Local dependency-manifest detection.
 *
 * Each ecosystem has a small detector that, given the repository root, reports
 * whether its manifest is present and a best-effort dependency count. Detectors
 * are pure over the filesystem and never throw — an unreadable or malformed
 * manifest simply yields a zero count.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DependencyManifest } from '@beacon/shared';

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Count the members of the top-level JSON objects named in `keys`. */
function countJsonDependencyKeys(raw: string, keys: string[]): number {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    let count = 0;
    for (const key of keys) {
      const section = parsed[key];
      if (section && typeof section === 'object') {
        count += Object.keys(section as Record<string, unknown>).length;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/** Count non-empty, non-comment lines matching an optional predicate. */
function countLines(raw: string, predicate?: (line: string) => boolean): number {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .filter((line) => (predicate ? predicate(line) : true)).length;
}

/** One ecosystem detector. */
interface ManifestDetector {
  ecosystem: string;
  file: string;
  count(raw: string): number;
}

const DETECTORS: ManifestDetector[] = [
  {
    ecosystem: 'npm',
    file: 'package.json',
    count: (raw) =>
      countJsonDependencyKeys(raw, [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ]),
  },
  {
    ecosystem: 'pip',
    file: 'requirements.txt',
    count: (raw) => countLines(raw, (line) => !line.startsWith('-')),
  },
  {
    ecosystem: 'pip',
    file: 'pyproject.toml',
    count: (raw) => {
      // Count entries under [project] dependencies array…
      const array = raw.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)?.[1];
      if (array) {
        return array.split(',').filter((part) => part.trim().length > 0).length;
      }
      // …or under [tool.poetry.dependencies].
      const section = raw.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|$)/)?.[1];
      return section ? countLines(section, (l) => l.includes('=')) : 0;
    },
  },
  {
    ecosystem: 'go',
    file: 'go.mod',
    count: (raw) => {
      const block = raw.match(/require\s*\(([\s\S]*?)\)/)?.[1];
      if (block) {
        return countLines(block);
      }
      return countLines(raw, (line) => line.startsWith('require '));
    },
  },
  {
    ecosystem: 'cargo',
    file: 'Cargo.toml',
    count: (raw) => {
      const section = raw.match(/\[dependencies\]([\s\S]*?)(\n\[|$)/)?.[1];
      return section ? countLines(section, (l) => l.includes('=')) : 0;
    },
  },
  {
    ecosystem: 'maven',
    file: 'pom.xml',
    count: (raw) => (raw.match(/<dependency>/g) ?? []).length,
  },
  {
    ecosystem: 'gradle',
    file: 'build.gradle',
    count: (raw) =>
      countLines(raw, (line) =>
        /\b(implementation|api|compile|testImplementation|runtimeOnly)\b/.test(line),
      ),
  },
  {
    ecosystem: 'rubygems',
    file: 'Gemfile',
    count: (raw) => countLines(raw, (line) => line.startsWith('gem ')),
  },
  {
    ecosystem: 'composer',
    file: 'composer.json',
    count: (raw) => countJsonDependencyKeys(raw, ['require', 'require-dev']),
  },
];

/**
 * Detect every dependency manifest present at the repository root and report a
 * best-effort dependency count for each.
 */
export function detectManifests(root: string): DependencyManifest[] {
  const manifests: DependencyManifest[] = [];
  for (const detector of DETECTORS) {
    const path = join(root, detector.file);
    if (!existsSync(path)) {
      continue;
    }
    const raw = readFileSafe(path);
    manifests.push({
      ecosystem: detector.ecosystem,
      path: detector.file,
      dependencyCount: raw ? detector.count(raw) : 0,
    });
  }
  return manifests;
}
