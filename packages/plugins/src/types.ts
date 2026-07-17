import type { BeaconAnalysis, RepositorySnapshot } from '@beacon/shared';

/** A single named metric contributed by a plugin analyzer. */
export interface PluginMetric {
  key: string;
  label: string;
  value: number | string;
}

/** A single actionable recommendation contributed by a plugin recommender. */
export interface PluginRecommendation {
  id: string;
  title: string;
  recommendation: string;
  severity?: 'high' | 'medium' | 'low';
}

/**
 * Everything a plugin is given to do its work: the raw {@link RepositorySnapshot}
 * and the derived {@link BeaconAnalysis} (score + summary). Plugins are pure
 * consumers of this context and never mutate core state.
 */
export interface PluginContext {
  snapshot: RepositorySnapshot;
  analysis: BeaconAnalysis;
}

/** Produces metrics from the analysis context. */
export interface Analyzer {
  name: string;
  run(ctx: PluginContext): PluginMetric[] | Promise<PluginMetric[]>;
}

/** Produces recommendations from the analysis context. */
export interface Recommender {
  name: string;
  run(ctx: PluginContext): PluginRecommendation[] | Promise<PluginRecommendation[]>;
}

/** Renders a widget (SVG or other markup) from the analysis context. */
export interface WidgetContributor {
  type: string;
  render(ctx: PluginContext): string;
}

/**
 * A Beacon plugin bundles any combination of analyzers, recommenders, and
 * widget contributors under a single name. Third parties ship these to extend
 * Beacon without touching core.
 */
export interface BeaconPlugin {
  name: string;
  version?: string;
  analyzers?: Analyzer[];
  recommenders?: Recommender[];
  widgets?: WidgetContributor[];
}
