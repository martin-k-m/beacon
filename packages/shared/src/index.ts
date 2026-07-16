/**
 * @beacon/shared — the leaf package every other Beacon package builds on.
 *
 * Exports the domain model ({@link RepositorySnapshot}, {@link BeaconScore},
 * {@link BeaconAnalysis}, …), the deterministic demo fixtures, and the shared
 * job-queue contract consumed by the API and the background worker.
 */
export * from './types';
export * from './queue';
export {
  demoHealthySnapshot,
  demoAtRiskSnapshot,
  demoSnapshots,
} from './demo/fixtures';

export const BEACON_SHARED_VERSION = '0.1.0';
