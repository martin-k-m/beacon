# Plugins

Beacon's analysis is a pure function of a snapshot, which makes it easy to add
your own signals on top without forking. A **plugin** contributes any mix of:

- **analyzers** — extra metrics,
- **recommenders** — extra recommendations,
- **widgets** — extra embeddable SVG.

Plugins are a **self-hosting** feature. `@beacon/plugins` is not published to npm
(the CLI is Beacon's only published package), so plugins are loaded by a Beacon
API that you run — from your own module, in your own deployment.

## Writing a plugin

A plugin is a plain object with a `name` and whatever it contributes. Every
contribution receives the same context: the collected `snapshot` and the derived
`analysis` (score + summary). Plugins are pure consumers — they never mutate core
state.

```ts
// my-plugin.ts
import type { BeaconPlugin } from '@beacon/plugins';

const monorepoPlugin: BeaconPlugin = {
  name: 'monorepo-signals',
  version: '1.0.0',

  analyzers: [
    {
      name: 'workspace-count',
      run: ({ snapshot }) => [
        {
          key: 'manifests',
          label: 'Dependency manifests',
          value: snapshot.dependencies.length,
        },
      ],
    },
  ],

  recommenders: [
    {
      name: 'archived-warning',
      run: ({ snapshot }) =>
        snapshot.metadata.isArchived
          ? [
              {
                id: 'archived',
                title: 'Repository is archived',
                recommendation: 'Unarchive it or point users at the successor.',
                severity: 'high',
              },
            ]
          : [],
    },
  ],

  widgets: [
    {
      type: 'manifest-count',
      render: ({ snapshot }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
           <text x="6" y="14">${snapshot.dependencies.length} manifests</text>
         </svg>`,
    },
  ],
};

export default monorepoPlugin;
```

A module may default-export a single plugin or an array of them.

If you ship plain **CommonJS** rather than ESM, the plugin *is* `module.exports`:

```js
// my-plugin.js — CommonJS
module.exports = { name: 'monorepo-signals', analyzers: [/* … */] };
```

Don't write `module.exports = { default: plugin }` — that nests it one level too
deep and the loader will report *"no default-exported BeaconPlugin"*.

## Loading plugins

Point `BEACON_PLUGINS` at a comma-separated list of module specifiers. They are
imported at API boot:

```bash
BEACON_PLUGINS=./dist/my-plugin.js npm run start --workspace @beacon/api

# several, including a package on disk
BEACON_PLUGINS=./dist/my-plugin.js,/opt/beacon/plugins/audit.js
```

Registration deduplicates by `name` — **last registration wins** — so a plugin
can be replaced by re-registering under the same name.

With `BEACON_PLUGINS` unset, no plugins load and every endpoint below still
answers normally with empty results. That is the default, supported
configuration — see the zero-config guarantee in the [README](../README.md).

## Failure isolation

Nothing a plugin does can take down Beacon:

- A module that fails to import, or exports something that isn't a plugin, is
  **logged and skipped** — the API still boots.
- An analyzer or recommender that throws is logged and skipped; the rest of the
  batch still returns.
- A widget contributor that throws renders the standard "unavailable" card
  (`200`), because an embedded image must never break.

## Endpoints

### `GET /api/plugins`

What's loaded in this process.

```json
{
  "plugins": [
    {
      "name": "monorepo-signals",
      "version": "1.0.0",
      "analyzers": ["workspace-count"],
      "recommenders": ["archived-warning"],
      "widgets": ["manifest-count"]
    }
  ]
}
```

Returns `{ "plugins": [] }` when none are configured.

### `GET /api/repositories/:owner/:repo/plugins`

Runs every analyzer and recommender against the repository and returns the
flattened results.

```json
{
  "metrics": [{ "key": "manifests", "label": "Dependency manifests", "value": 3 }],
  "recommendations": [
    {
      "id": "archived",
      "title": "Repository is archived",
      "recommendation": "Unarchive it or point users at the successor.",
      "severity": "high"
    }
  ]
}
```

With no plugins registered this returns empty collections **without** contacting
GitHub. Errors mirror the analyze route: `404` (repo not found), `429` (rate
limit), `400` (malformed identifier).

### `GET /widget/:type/:owner/:repo`

Plugin widget types are served by the **same** widget route as the built-ins, so
an embed can't tell the difference — same caching, same "unavailable" card.
Built-in types (`health`, `activity`, `language`, `contributor`, `release`,
`badge`) always win; unknown types fall through to the registry, and a type no
plugin offers still `404`s.

```
/widget/manifest-count/facebook/react
```

## Related

- [Architecture](architecture.md) — where plugins sit in the package graph.
- [API reference](api.md) — every endpoint.
- [Self-hosting](self-hosting.md) — running the API you'd load plugins into.
