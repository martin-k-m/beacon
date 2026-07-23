/**
 * `@beacon/dependency-engine`
 *
 * Dependency-free analysis of a repository's dependencies for outdated,
 * unmaintained, and license concerns. Registry access is pluggable so the
 * engine can run online (against npm / PyPI / crates.io) or fully offline.
 */

export * from './types';
export * from './registry-clients';
export { analyzeDependencies, fromManifests, type AnalyzeOptions } from './engine';

/** Package version, surfaced for diagnostics and telemetry. */
export const BEACON_DEPENDENCY_ENGINE_VERSION = '0.1.0';
