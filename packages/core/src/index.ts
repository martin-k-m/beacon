/**
 * @beacon/core — the analysis engine behind Beacon.
 *
 * Collect a {@link RepositorySnapshot} from GitHub, compute a deterministic
 * {@link BeaconScore}, and generate a natural-language {@link BeaconSummary}
 * via a pluggable {@link AIProvider}.
 */
export * from './types';
export * from './scoring/score';
export * from './github/client';
export * from './ai';
export * from './analyzer';
export {
  demoHealthySnapshot,
  demoAtRiskSnapshot,
  demoSnapshots,
} from './demo/fixtures';
export {
  generateDemoHistory,
  type DemoHistoryPoint,
  type DemoHistoryOptions,
} from './demo/history';

export const BEACON_CORE_VERSION = '0.1.0';
