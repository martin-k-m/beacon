import type {
  BeaconPlugin,
  PluginContext,
  PluginMetric,
  PluginRecommendation,
} from './types';

/** Sink for plugin failures. Defaults to `console.warn`. */
export type PluginErrorLogger = (message: string, error: unknown) => void;

export interface PluginRegistryOptions {
  /** Called when a plugin's analyzer/recommender throws. Defaults to `console.warn`. */
  onError?: PluginErrorLogger;
}

function defaultLogger(message: string, error: unknown): void {
  console.warn(`[@beacon/plugins] ${message}`, error);
}

/**
 * Holds registered {@link BeaconPlugin}s and runs their contributions.
 *
 * The registry is failure-isolating: if a single plugin's analyzer or
 * recommender throws (or rejects), that failure is logged and skipped so one
 * misbehaving plugin can never break the whole batch.
 *
 * Registration deduplicates by plugin name — **last registration wins**, so a
 * plugin can be transparently replaced by re-registering under the same name.
 */
export class PluginRegistry {
  private readonly byName = new Map<string, BeaconPlugin>();
  private readonly order: string[] = [];
  private readonly onError: PluginErrorLogger;

  constructor(options: PluginRegistryOptions = {}) {
    this.onError = options.onError ?? defaultLogger;
  }

  /** Register a plugin. Re-registering the same name replaces the prior one. */
  register(plugin: BeaconPlugin): this {
    if (!this.byName.has(plugin.name)) {
      this.order.push(plugin.name);
    }
    this.byName.set(plugin.name, plugin);
    return this;
  }

  /** All registered plugins, in registration order. */
  get plugins(): readonly BeaconPlugin[] {
    return this.order
      .map((name) => this.byName.get(name))
      .filter((plugin): plugin is BeaconPlugin => plugin !== undefined);
  }

  /** Run every analyzer across every plugin and flatten the metrics. */
  async runAnalyzers(ctx: PluginContext): Promise<PluginMetric[]> {
    const metrics: PluginMetric[] = [];
    for (const plugin of this.plugins) {
      for (const analyzer of plugin.analyzers ?? []) {
        try {
          const produced = await analyzer.run(ctx);
          metrics.push(...produced);
        } catch (error) {
          this.onError(
            `analyzer "${analyzer.name}" in plugin "${plugin.name}" failed; skipping`,
            error,
          );
        }
      }
    }
    return metrics;
  }

  /** Run every recommender across every plugin and flatten the recommendations. */
  async runRecommenders(ctx: PluginContext): Promise<PluginRecommendation[]> {
    const recommendations: PluginRecommendation[] = [];
    for (const plugin of this.plugins) {
      for (const recommender of plugin.recommenders ?? []) {
        try {
          const produced = await recommender.run(ctx);
          recommendations.push(...produced);
        } catch (error) {
          this.onError(
            `recommender "${recommender.name}" in plugin "${plugin.name}" failed; skipping`,
            error,
          );
        }
      }
    }
    return recommendations;
  }

  /**
   * Render the first widget contributor matching `type`, or `null` if none is
   * registered. A throwing widget is logged and treated as "no widget".
   */
  widget(type: string, ctx: PluginContext): string | null {
    for (const plugin of this.plugins) {
      for (const contributor of plugin.widgets ?? []) {
        if (contributor.type === type) {
          try {
            return contributor.render(ctx);
          } catch (error) {
            this.onError(
              `widget "${type}" in plugin "${plugin.name}" failed to render`,
              error,
            );
            return null;
          }
        }
      }
    }
    return null;
  }

  /** All distinct widget types offered by registered plugins, in first-seen order. */
  listWidgetTypes(): string[] {
    const types: string[] = [];
    const seen = new Set<string>();
    for (const plugin of this.plugins) {
      for (const contributor of plugin.widgets ?? []) {
        if (!seen.has(contributor.type)) {
          seen.add(contributor.type);
          types.push(contributor.type);
        }
      }
    }
    return types;
  }
}
