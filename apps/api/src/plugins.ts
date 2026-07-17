/**
 * Plugin loading for the Beacon API.
 *
 * A self-hosted Beacon extends itself by pointing `BEACON_PLUGINS` at one or
 * more module specifiers. Each module default-exports a `BeaconPlugin` (or an
 * array of them); this module imports them at boot and registers them in a
 * process-wide {@link PluginRegistry}.
 *
 * Loading is deliberately forgiving, in the same spirit as the rest of the API's
 * degraded modes: a module that fails to import, or exports something that is
 * not a plugin, is reported and skipped rather than crashing the server. A bad
 * third-party plugin must never take down an operator's Beacon. With
 * `BEACON_PLUGINS` unset the registry is simply empty, which is the default and
 * fully supported configuration.
 */

import { isAbsolute, resolve } from 'node:path';

import { PluginRegistry, type BeaconPlugin } from '@beacon/plugins';

import { config } from './config';

/** The process-wide registry. Empty until {@link loadPlugins} runs. */
export const registry = new PluginRegistry({
  onError: (message, error) => {
    // eslint-disable-next-line no-console
    console.warn(`[beacon:plugins] ${message}`, error);
  },
});

/** Structural check — we cannot trust the shape of a third-party module. */
function isBeaconPlugin(value: unknown): value is BeaconPlugin {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { name?: unknown };
  return typeof candidate.name === 'string' && candidate.name.length > 0;
}

/** Normalize a module's default export into a list of plugins. */
function toPlugins(exported: unknown): BeaconPlugin[] {
  const candidates = Array.isArray(exported) ? exported : [exported];
  return candidates.filter(isBeaconPlugin);
}

export interface LoadPluginsResult {
  loaded: string[];
  failed: { specifier: string; reason: string }[];
}

/**
 * Turn an operator-supplied specifier into one the module loader resolves the
 * way the operator expects.
 *
 * A relative specifier would otherwise resolve against *this file* (the loader
 * lives in `apps/api/dist/`), so `BEACON_PLUGINS=./my-plugin.js` would look
 * inside the API's build output rather than the directory the operator started
 * the server from. Relative paths are therefore resolved against `process.cwd()`.
 * Bare specifiers (`@acme/beacon-plugin`) are left alone so normal package
 * resolution applies.
 */
export function resolveSpecifier(specifier: string, cwd: string = process.cwd()): string {
  if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('.\\')) {
    return resolve(cwd, specifier);
  }
  if (isAbsolute(specifier)) return specifier;
  return specifier;
}

/**
 * Import and register every module named in `specifiers` (defaults to
 * `config.pluginModules`). Never throws — failures are collected and returned.
 */
export async function loadPlugins(
  specifiers: string[] = config.pluginModules,
): Promise<LoadPluginsResult> {
  const result: LoadPluginsResult = { loaded: [], failed: [] };

  for (const specifier of specifiers) {
    try {
      const imported = (await import(resolveSpecifier(specifier))) as { default?: unknown };
      const plugins = toPlugins(imported.default ?? imported);
      if (plugins.length === 0) {
        result.failed.push({
          specifier,
          reason: 'no default-exported BeaconPlugin (expected an object with a name)',
        });
        continue;
      }
      for (const plugin of plugins) {
        registry.register(plugin);
        result.loaded.push(plugin.name);
      }
    } catch (error) {
      result.failed.push({
        specifier,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/** A serializable description of what a plugin contributes. */
export interface PluginDescription {
  name: string;
  version: string | null;
  analyzers: string[];
  recommenders: string[];
  widgets: string[];
}

/** Describe every registered plugin — powers `GET /api/plugins`. */
export function describePlugins(): PluginDescription[] {
  return registry.plugins.map((plugin) => ({
    name: plugin.name,
    version: plugin.version ?? null,
    analyzers: (plugin.analyzers ?? []).map((a) => a.name),
    recommenders: (plugin.recommenders ?? []).map((r) => r.name),
    widgets: (plugin.widgets ?? []).map((w) => w.type),
  }));
}
