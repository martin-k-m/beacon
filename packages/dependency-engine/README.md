# @beacon/dependency-engine

Dependency-free analysis of a repository's dependencies for **outdated**,
**unmaintained**, and **license** concerns. Registry access is pluggable, so the
engine can run online (against npm, PyPI, and crates.io) or fully offline.

The engine itself performs no network I/O and never fabricates data: every
signal comes from a `RegistryClient`, and anything a client can't answer is
classified as `unknown` rather than guessed.

## Install

```jsonc
// package.json
{
  "dependencies": {
    "@beacon/dependency-engine": "*"
  }
}
```

## Usage

```ts
import {
  analyzeDependencies,
  MultiRegistryClient,
  type DependencyInput,
} from '@beacon/dependency-engine';

const deps: DependencyInput[] = [
  { name: 'react', ecosystem: 'npm', currentVersion: '17.0.2' },
  { name: 'requests', ecosystem: 'pip', currentVersion: '2.31.0' },
  { name: 'serde', ecosystem: 'cargo', currentVersion: '1.0.0' },
];

// Online by default (MultiRegistryClient). Pass your own client to override.
const report = await analyzeDependencies(deps, {
  registry: new MultiRegistryClient(),
});

console.log(report.summary);
// e.g. "1 outdated, 1 unmaintained across 3 dependencies."

for (const dep of report.dependencies) {
  console.log(dep.name, dep.status, dep.latestVersion, dep.notes);
}
```

### Offline / air-gapped

```ts
import { analyzeDependencies, OfflineRegistryClient } from '@beacon/dependency-engine';

// Never touches the network — every dependency is classified `unknown`.
const report = await analyzeDependencies(deps, {
  registry: new OfflineRegistryClient(),
});
```

### Custom registry (e.g. private feed or a test double)

```ts
import type { RegistryClient } from '@beacon/dependency-engine';

const myRegistry: RegistryClient = {
  async getPackage(ecosystem, name) {
    return { latestVersion: '2.0.0', license: 'MIT', deprecated: false };
  },
};

const report = await analyzeDependencies(deps, { registry: myRegistry });
```

## Ecosystems

| Ecosystem  | Registry checked                         | Result when unchecked |
| ---------- | ---------------------------------------- | --------------------- |
| `npm`      | `registry.npmjs.org`                     | —                     |
| `pip`      | `pypi.org`                               | —                     |
| `cargo`    | `crates.io` (sends a `User-Agent`)       | —                     |
| `go`       | not checked                              | `unknown`             |
| `maven`    | not checked                              | `unknown`             |
| `gradle`   | not checked                              | `unknown`             |
| `rubygems` | not checked                              | `unknown`             |
| `composer` | not checked                              | `unknown`             |
| `unknown`  | not checked                              | `unknown`             |

`MultiRegistryClient` routes by ecosystem and returns `null` for any ecosystem
without a bundled client, which the engine surfaces as `unknown`.

## Classification rules

For each dependency, in priority order:

1. **`unmaintained`** — the registry reports the package as deprecated
   (note: `package is deprecated`).
2. **`unmaintained`** — the latest release is older than ~2 years
   (note: `no release in N years`).
3. **`outdated`** — a `currentVersion` was supplied and is a **major** version
   behind latest (note: `X → Y available`).
4. **`current`** — the supplied `currentVersion` equals the latest version.
5. **`unknown`** — no metadata, an unparseable version, or not enough signal.

`vulnerable` is part of the status model but none of the bundled clients source
advisory data, so the engine never assigns it on its own. A caller with its own
vulnerability feed can supply a `RegistryClient` and map it through.

Licenses are copied through when the registry reports them, with a cheap
permissive-vs-copyleft hint added to `notes` when the SPDX id is recognizable.

## `fromManifests`

```ts
import { fromManifests } from '@beacon/dependency-engine';
```

A Beacon `RepositorySnapshot` records only that a manifest exists and how many
dependencies it declared — not the dependency names or versions. `fromManifests`
therefore returns an empty list; it is the documented seam where a real manifest
parser would feed parsed `DependencyInput`s into the engine.

## Exports

- `analyzeDependencies`, `fromManifests`, `AnalyzeOptions`
- `RegistryClient`, `RegistryPackageInfo`
- `NpmRegistryClient`, `PyPiRegistryClient`, `CratesRegistryClient`,
  `MultiRegistryClient`, `OfflineRegistryClient`, `RegistryClientOptions`
- Types: `DependencyEcosystem`, `DependencyStatus`, `DependencyInput`,
  `DependencyStatusResult`, `DependencyReport`
- `BEACON_DEPENDENCY_ENGINE_VERSION`

## Scripts

```bash
npm run build      # tsc -> dist
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src
npm run test       # vitest run (offline; uses a mock RegistryClient)
```
