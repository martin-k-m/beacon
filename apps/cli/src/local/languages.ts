/**
 * Local language detection.
 *
 * Walks the working tree, sizes each file, and attributes its bytes to a
 * language by file extension (or, for a handful of extension-less files, by
 * name). The result mirrors the GitHub "languages" API shape — a map of
 * language → bytes — so it feeds the scorer unchanged.
 */

import { readdirSync, statSync } from 'node:fs';
import { extname, join, basename } from 'node:path';

import type { LanguageBreakdown } from '@beacon/shared';

/** Directories never worth walking, regardless of user ignore config. */
export const ALWAYS_SKIP = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  'build',
  'coverage',
  '.turbo',
  '.cache',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  'target',
]);

/**
 * Extension → language name. Covers the required set (TS/JS, Python, Go, Rust,
 * Java) plus common companions so mixed repositories classify sensibly. Keys
 * are lower-cased and include the leading dot.
 */
const EXTENSION_LANGUAGES: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.pyi': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.c': 'C',
  '.h': 'C',
  '.cc': 'C++',
  '.cpp': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.swift': 'Swift',
  '.scala': 'Scala',
  '.dart': 'Dart',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.clj': 'Clojure',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.ps1': 'PowerShell',
  '.lua': 'Lua',
  '.r': 'R',
  '.pl': 'Perl',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',
  '.html': 'HTML',
  '.md': 'Markdown',
  '.mdx': 'MDX',
  '.json': 'JSON',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.toml': 'TOML',
  '.sql': 'SQL',
  '.proto': 'Protocol Buffers',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
};

/** A few notable extension-less files mapped by basename. */
const FILENAME_LANGUAGES: Record<string, string> = {
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  rakefile: 'Ruby',
  gemfile: 'Ruby',
};

/** Map a file path to a language name, or `null` when it is unclassified. */
export function languageForFile(path: string): string | null {
  const ext = extname(path).toLowerCase();
  const byExtension = ext ? EXTENSION_LANGUAGES[ext] : undefined;
  if (byExtension) {
    return byExtension;
  }
  const name = basename(path).toLowerCase();
  return FILENAME_LANGUAGES[name] ?? null;
}

/** True when a directory/file name should be skipped during the walk. */
function shouldSkip(name: string, ignore: Set<string>): boolean {
  if (ALWAYS_SKIP.has(name) || ignore.has(name)) {
    return true;
  }
  // Skip dotfiles/dotdirs other than a few we care about elsewhere.
  return name.startsWith('.') && name !== '.github';
}

export interface LanguageScanResult {
  languages: LanguageBreakdown;
  /** Largest language by bytes, or `null` when nothing was classified. */
  primaryLanguage: string | null;
  /** Total files visited (classified or not). */
  fileCount: number;
  /** Total bytes across all files visited. */
  totalBytes: number;
}

/** Cap the walk so a pathological tree cannot stall the CLI. */
const MAX_FILES = 50_000;

/**
 * Recursively scan `root`, accumulating bytes per language. `ignore` is a list
 * of directory/file names (not globs) to skip in addition to {@link ALWAYS_SKIP}.
 */
export function scanLanguages(
  root: string,
  ignore: readonly string[] = [],
): LanguageScanResult {
  const ignoreSet = new Set(ignore.map((entry) => entry.replace(/[\\/]+$/, '')));
  const languages: LanguageBreakdown = {};
  let fileCount = 0;
  let totalBytes = 0;

  const stack: string[] = [root];
  while (stack.length > 0 && fileCount < MAX_FILES) {
    const dir = stack.pop();
    if (dir === undefined) {
      break;
    }
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (shouldSkip(entry.name, ignoreSet)) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        continue;
      }
      fileCount += 1;
      totalBytes += size;
      const language = languageForFile(full);
      if (language) {
        languages[language] = (languages[language] ?? 0) + size;
      }
    }
  }

  let primaryLanguage: string | null = null;
  let best = -1;
  for (const [language, bytes] of Object.entries(languages)) {
    if (bytes > best) {
      best = bytes;
      primaryLanguage = language;
    }
  }

  return { languages, primaryLanguage, fileCount, totalBytes };
}
