/**
 * @beacon/plugins — the extensibility foundation for Beacon.
 *
 * A plugin contributes **analyzers** (metrics), **recommenders**
 * (recommendations), and **widgets** (SVG/markup) by exporting a
 * {@link BeaconPlugin}. The registry runs every contribution over a
 * {@link PluginContext} (snapshot + analysis), flattening results and isolating
 * failures so one bad plugin can never break the batch — all without touching
 * Beacon core.
 *
 * **How plugins reach a running Beacon:** this package is not published to npm
 * (the CLI is Beacon's only published artifact), so plugins are a
 * **self-hosting** feature rather than something an external package installs.
 * A self-hosted API points `BEACON_PLUGINS` at one or more module specifiers;
 * `apps/api` imports them at boot, registers them here, and exposes the results
 * at `GET /api/plugins`, `GET /api/repositories/:owner/:repo/plugins`, and —
 * for widget contributors — the existing `/widget/:type/:owner/:repo` route.
 * See `docs/plugins.md`.
 */
export * from './types';
export { PluginRegistry } from './registry';
export type { PluginErrorLogger, PluginRegistryOptions } from './registry';
export {
  securityPolicyPlugin,
  staleReleasePlugin,
  examplePlugins,
} from './examplePlugins';

export const BEACON_PLUGINS_VERSION = '0.1.0';
