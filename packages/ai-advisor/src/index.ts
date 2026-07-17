/**
 * @beacon/ai-advisor — turns a Beacon repository analysis into actionable
 * advice.
 *
 * The advisor explains why a repository's health looks the way it does, surfaces
 * concrete problems (grounded in the snapshot, score, and trend), and pairs each
 * with a specific recommendation. The rule engine ({@link adviseIssues}) is pure
 * and deterministic; {@link generateAdvice} wraps it with a headline and a
 * narrative summary, optionally written by a hosted AI provider.
 */
export * from './types';
export { adviseIssues } from './rules';
export { generateAdvice } from './advisor';

export const BEACON_AI_ADVISOR_VERSION = '0.1.0';
