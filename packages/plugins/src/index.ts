/**
 * @beacon/plugins — the extensibility foundation for Beacon.
 *
 * Third parties contribute **analyzers** (metrics), **recommenders**
 * (recommendations), and **widgets** (SVG/markup) by shipping a
 * {@link BeaconPlugin} and registering it with a {@link PluginRegistry}. The
 * registry runs every contribution over a {@link PluginContext} (snapshot +
 * analysis), flattening results and isolating failures so one bad plugin can
 * never break the batch — all without touching Beacon core.
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
