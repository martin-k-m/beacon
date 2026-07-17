/**
 * Shared stdout/stderr helpers used by every `beacon` command.
 *
 * Keeping the colour gate, error formatting, and note printing in one place
 * means JSON output stays clean (diagnostics go to stderr) and error messages
 * read the same way across commands.
 */

import { GitHubError } from '@beacon/github';
import pc from 'picocolors';

import { BeaconCliError } from './analysis';

/** Standard colour gate: only colourize when enabled and stdout is a TTY. */
export function colorEnabled(color: boolean): boolean {
  return color && Boolean(process.stdout.isTTY);
}

/** Translate any thrown value into a friendly, single-line message. */
export function describeError(error: unknown): string {
  if (error instanceof GitHubError) {
    if (error.status === 404) {
      return 'Repository not found. Check the owner/repo spelling, or run `beacon login` for private repositories.';
    }
    if (error.status === 403 || error.status === 429) {
      return 'Rate limited by GitHub. Run `beacon login` (or set GITHUB_TOKEN) to raise your limit.';
    }
    return `GitHub request failed (${error.status}): ${error.message}`;
  }
  if (error instanceof BeaconCliError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Write a red ✖ error line to stderr so JSON stdout stays clean. */
export function writeError(message: string, color: boolean): void {
  process.stderr.write(`${color ? pc.red('✖') : '✖'} ${message}\n`);
}

/** Print `--local` caveats, dimmed, to stderr so JSON stdout stays clean. */
export function printNotes(notes: string[], color: boolean): void {
  for (const note of notes) {
    process.stderr.write(`${color ? pc.dim(`note: ${note}`) : `note: ${note}`}\n`);
  }
}
