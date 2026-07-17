/**
 * @beacon/analytics — the analysis engine plus historical health analytics.
 *
 * Collect a {@link RepositorySnapshot} (via @beacon/github), compute a
 * deterministic {@link BeaconScore}, generate an AI summary (via @beacon/ai),
 * and turn a repository's stored analysis history into ranges, trends, and
 * human-readable narratives ("health improved 12% this month").
 */
export * from './trends';
export * from './team-health';
export * from './scoring';
export * from './analyzer';
export * from './demo-history';
