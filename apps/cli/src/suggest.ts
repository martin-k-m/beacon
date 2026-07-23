/**
 * "Did you mean …?" suggestions for mistyped commands.
 *
 * A small, allocation-light Levenshtein implementation ranks known commands by
 * edit distance to the user's input, so `beacon analize` can point at
 * `beacon analyze`. Pure and dependency-free, so it is trivially unit-testable.
 */

/** Compute the Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  // Single-row DP: `row[j]` is the distance for the prefix b[0..j].
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  let current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(deletion, insertion, substitution);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length] ?? 0;
}

export interface SuggestionOptions {
  /**
   * Maximum edit distance to consider a match. Defaults to a length-aware
   * threshold so short commands are matched strictly and longer ones loosely.
   */
  maxDistance?: number;
  /** Maximum number of suggestions to return. Defaults to 3. */
  limit?: number;
}

/**
 * Return the known commands closest to `input`, nearest first. Exact substring
 * prefixes are always included so `an` suggests `analyze`.
 */
export function suggestCommands(
  input: string,
  candidates: readonly string[],
  options: SuggestionOptions = {},
): string[] {
  const needle = input.toLowerCase();
  const limit = options.limit ?? 3;
  const threshold = options.maxDistance ?? Math.max(2, Math.floor(needle.length / 2) + 1);

  const scored = candidates
    .map((candidate) => {
      const name = candidate.toLowerCase();
      const distance = levenshtein(needle, name);
      const isPrefix = name.startsWith(needle) || needle.startsWith(name);
      return { candidate, distance, isPrefix };
    })
    .filter((entry) => entry.isPrefix || entry.distance <= threshold)
    .sort((a, b) => {
      if (a.isPrefix !== b.isPrefix) {
        return a.isPrefix ? -1 : 1;
      }
      return a.distance - b.distance;
    });

  return scored.slice(0, limit).map((entry) => entry.candidate);
}

/**
 * Build the multi-line "Unknown command" message, or `null` when there are no
 * close matches (so the caller can fall back to generic help).
 */
export function formatUnknownCommand(input: string, candidates: readonly string[]): string {
  const suggestions = suggestCommands(input, candidates);
  const header = `Unknown command: ${input}`;
  if (suggestions.length === 0) {
    return header;
  }
  const lines = suggestions.map((name) => `  beacon ${name}`);
  return `${header}\n\nDid you mean:\n${lines.join('\n')}`;
}
