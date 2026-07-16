import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isGitRepo } from './git';
import {
  analyzeLocal,
  buildLocalSnapshot,
  detectManifests,
  languageForFile,
  scanLanguages,
} from './local';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beacon-local-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(relative: string, contents: string): void {
  const full = join(dir, relative);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, contents, 'utf8');
}

describe('languageForFile', () => {
  it('maps common extensions to languages', () => {
    expect(languageForFile('src/index.ts')).toBe('TypeScript');
    expect(languageForFile('app/main.py')).toBe('Python');
    expect(languageForFile('cmd/root.go')).toBe('Go');
    expect(languageForFile('src/lib.rs')).toBe('Rust');
    expect(languageForFile('Main.java')).toBe('Java');
  });

  it('returns null for unknown extensions', () => {
    expect(languageForFile('data.bin')).toBeNull();
  });
});

describe('scanLanguages', () => {
  it('sums bytes per language and skips ignored directories', () => {
    write('src/a.ts', 'const a = 1;\n'.repeat(20));
    write('src/b.py', 'x = 1\n'.repeat(5));
    write('node_modules/pkg/index.ts', 'export const x = 1;\n'.repeat(100));
    write('README.md', '# Title\n');

    const result = scanLanguages(dir);
    expect(result.languages.TypeScript).toBeGreaterThan(0);
    expect(result.languages.Python).toBeGreaterThan(0);
    // node_modules is skipped, so TS stays smaller than Python here would be.
    expect(result.primaryLanguage).toBe('TypeScript');
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it('honors extra ignore entries', () => {
    write('keep/a.ts', 'const a = 1;\n');
    write('skip/b.ts', 'const b = 2;\n');
    const result = scanLanguages(dir, ['skip']);
    expect(result.fileCount).toBe(1);
  });
});

describe('detectManifests', () => {
  it('detects package.json and counts dependencies', () => {
    write(
      'package.json',
      JSON.stringify({
        dependencies: { a: '1', b: '2' },
        devDependencies: { c: '3' },
      }),
    );
    const manifests = detectManifests(dir);
    const npm = manifests.find((m) => m.ecosystem === 'npm');
    expect(npm?.dependencyCount).toBe(3);
  });

  it('detects a Go module', () => {
    write('go.mod', 'module example.com/x\n\nrequire (\n\tgithub.com/a/b v1.0.0\n)\n');
    const manifests = detectManifests(dir);
    expect(manifests.some((m) => m.ecosystem === 'go')).toBe(true);
  });
});

describe('buildLocalSnapshot', () => {
  it('assembles a snapshot from filesystem signals without git', () => {
    write('src/index.ts', 'export const x = 1;\n'.repeat(20));
    write('README.md', '# Project\n\n## Install\n\n## Usage\n');
    write('LICENSE', 'MIT License\n\nPermission is hereby granted, free of charge...');
    write('package.json', JSON.stringify({ dependencies: { left: '1' } }));

    const { snapshot, notes } = buildLocalSnapshot({ cwd: dir, now: Date.parse('2026-07-16T00:00:00Z') });

    expect(snapshot.metadata.primaryLanguage).toBe('TypeScript');
    expect(snapshot.readme.present).toBe(true);
    expect(snapshot.readme.hasInstallSection).toBe(true);
    expect(snapshot.metadata.license).toBe('MIT');
    expect(snapshot.dependencies.some((d) => d.ecosystem === 'npm')).toBe(true);
    expect(snapshot.commitActivity).toHaveLength(52);
    expect(Array.isArray(notes)).toBe(true);
  });
});

describe('analyzeLocal', () => {
  it('scores the current repository when it is a git repo', async () => {
    if (!isGitRepo(process.cwd())) {
      return; // Not a git checkout — skip gracefully.
    }
    const { analysis, notes } = await analyzeLocal({ cwd: process.cwd() });
    expect(analysis.score.total).toBeGreaterThanOrEqual(0);
    expect(analysis.score.total).toBeLessThanOrEqual(100);
    expect(analysis.summary.text.length).toBeGreaterThan(0);
    // The offline caveat is always present.
    expect(notes.some((n) => n.toLowerCase().includes('offline'))).toBe(true);
  });

  it('throws for a non-git directory', async () => {
    await expect(analyzeLocal({ cwd: dir })).rejects.toThrow(/not a git repository/);
  });
});
