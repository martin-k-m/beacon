# @beacon/plugins

The extensibility foundation for **Beacon**. Third parties contribute
**analyzers**, **recommendations**, and **widgets** without touching Beacon
core. A `PluginRegistry` collects plugins and runs their contributions over a
`PluginContext` (the raw `RepositorySnapshot` plus the derived
`BeaconAnalysis`), flattening results and isolating failures so one bad plugin
can never break the batch.

## Install

```bash
npm install @beacon/plugins
```

## Concepts

A `BeaconPlugin` bundles any combination of three contribution kinds:

| Kind | Interface | Produces |
| --- | --- | --- |
| Analyzer | `Analyzer` | `PluginMetric[]` — `{ key, label, value }` |
| Recommender | `Recommender` | `PluginRecommendation[]` — `{ id, title, recommendation, severity? }` |
| Widget | `WidgetContributor` | a `string` of SVG/markup |

Every contribution receives a `PluginContext`:

```ts
interface PluginContext {
  snapshot: RepositorySnapshot; // raw signals collected from GitHub
  analysis: BeaconAnalysis;     // snapshot + BeaconScore + summary
}
```

## Writing a plugin

```ts
import type { BeaconPlugin } from '@beacon/plugins';

export const licensePlugin: BeaconPlugin = {
  name: 'acme:license-check',
  version: '1.0.0',
  analyzers: [
    {
      name: 'has-license',
      run(ctx) {
        return [
          {
            key: 'hasLicense',
            label: 'License declared',
            value: ctx.snapshot.metadata.license ?? 'none',
          },
        ];
      },
    },
  ],
  recommenders: [
    {
      name: 'missing-license',
      run(ctx) {
        if (ctx.snapshot.metadata.license) return [];
        return [
          {
            id: 'license-missing',
            title: 'Add a LICENSE',
            recommendation: 'No license was detected. Add one so others know how they may use this code.',
            severity: 'high',
          },
        ];
      },
    },
  ],
};
```

Analyzers and recommenders may be **synchronous or async** — return an array or
a `Promise` of one. Widget `render` is synchronous and returns markup (e.g. an
SVG badge).

## Using the registry

```ts
import { PluginRegistry, examplePlugins } from '@beacon/plugins';

const registry = new PluginRegistry();
for (const plugin of examplePlugins) registry.register(plugin);
registry.register(licensePlugin);

const ctx = { snapshot, analysis };

const metrics = await registry.runAnalyzers(ctx);         // flattened PluginMetric[]
const recommendations = await registry.runRecommenders(ctx); // flattened PluginRecommendation[]

registry.listWidgetTypes();                 // e.g. ['release-freshness']
const svg = registry.widget('release-freshness', ctx); // string | null
```

### Failure isolation

If a plugin's analyzer or recommender throws (or rejects), the registry logs it
via `onError` (defaults to `console.warn`) and skips it — the rest of the batch
still runs. A widget that throws renders as `null`.

```ts
const registry = new PluginRegistry({
  onError: (message, error) => myLogger.warn(message, error),
});
```

### Name deduplication

Registering two plugins with the same `name` keeps only the **last** one
(last-wins), so a plugin can be transparently replaced by re-registering under
its name. `registry.plugins` returns the current set in registration order.

## Example plugins

The package ships two small, real plugins (see `examplePlugins`):

- **`securityPolicyPlugin`** — a recommender that flags a missing `SECURITY.md`
  from `ctx.snapshot.security.hasSecurityPolicy`.
- **`staleReleasePlugin`** — an analyzer contributing a "days since last
  release" metric, a recommender that fires when releases are very stale or
  absent, and a `release-freshness` SVG badge widget.

## API

| Member | Description |
| --- | --- |
| `new PluginRegistry(options?)` | Create a registry. `options.onError` sinks plugin failures. |
| `register(plugin)` | Register (or replace, by name) a plugin. Returns `this`. |
| `plugins` | Registered plugins, in registration order. |
| `runAnalyzers(ctx)` | Run all analyzers → flattened `PluginMetric[]`. |
| `runRecommenders(ctx)` | Run all recommenders → flattened `PluginRecommendation[]`. |
| `widget(type, ctx)` | Render the first matching widget, or `null`. |
| `listWidgetTypes()` | Distinct widget types offered by registered plugins. |
| `BEACON_PLUGINS_VERSION` | The package version string. |

## License

MIT
