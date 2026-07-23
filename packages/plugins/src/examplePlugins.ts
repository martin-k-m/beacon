import type { BeaconPlugin, PluginContext } from './types';

const DAY_MS = 1000 * 60 * 60 * 24;

/** Days between `iso` and the context's collection time, or null if unknown. */
function daysSince(iso: string | null, ctx: PluginContext): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const now = Date.parse(ctx.snapshot.collectedAt) || Date.now();
  return Math.max(0, Math.round((now - then) / DAY_MS));
}

/**
 * Flags a missing security policy. A tiny but real recommender: it reads
 * `ctx.snapshot.security.hasSecurityPolicy` and, when absent, asks the
 * maintainer to add a `SECURITY.md`.
 */
export const securityPolicyPlugin: BeaconPlugin = {
  name: 'beacon:security-policy',
  version: '0.1.0',
  recommenders: [
    {
      name: 'missing-security-policy',
      run(ctx) {
        if (ctx.snapshot.security.hasSecurityPolicy) return [];
        return [
          {
            id: 'security-policy-missing',
            title: 'Add a SECURITY.md',
            recommendation:
              'This repository has no security policy. Add a SECURITY.md so ' +
              'researchers know how to report vulnerabilities responsibly.',
            severity: 'medium' as const,
          },
        ];
      },
    },
  ],
};

/**
 * Reports how long it has been since the most recent published release, both
 * as a metric and (when very stale) as a recommendation. Also contributes a
 * small SVG "badge" widget so the freshness can be surfaced in a card.
 */
export const staleReleasePlugin: BeaconPlugin = {
  name: 'beacon:stale-release',
  version: '0.1.0',
  analyzers: [
    {
      name: 'days-since-last-release',
      run(ctx) {
        const lastRelease = ctx.snapshot.releases.find((r) => r.publishedAt);
        const days = daysSince(lastRelease?.publishedAt ?? null, ctx);
        return [
          {
            key: 'daysSinceLastRelease',
            label: 'Days since last release',
            value: days ?? 'no releases',
          },
        ];
      },
    },
  ],
  recommenders: [
    {
      name: 'stale-release',
      run(ctx) {
        const lastRelease = ctx.snapshot.releases.find((r) => r.publishedAt);
        const days = daysSince(lastRelease?.publishedAt ?? null, ctx);
        if (days === null) {
          return [
            {
              id: 'release-none',
              title: 'Publish a release',
              recommendation:
                'No published releases were found. Cutting tagged releases ' +
                'helps downstream users track changes and pin versions.',
              severity: 'low' as const,
            },
          ];
        }
        if (days > 365) {
          return [
            {
              id: 'release-stale',
              title: 'Cut a fresh release',
              recommendation:
                `The last release was ${days} days ago. A newer ` +
                'release signals the project is actively maintained.',
              severity: 'medium' as const,
            },
          ];
        }
        return [];
      },
    },
  ],
  widgets: [
    {
      type: 'release-freshness',
      render(ctx) {
        const lastRelease = ctx.snapshot.releases.find((r) => r.publishedAt);
        const days = daysSince(lastRelease?.publishedAt ?? null, ctx);
        const label = days === null ? 'no releases' : `${days}d ago`;
        return (
          `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40" role="img" ` +
          `aria-label="Last release: ${label}">` +
          `<rect width="180" height="40" rx="6" fill="#0d1117"/>` +
          `<text x="12" y="24" fill="#c9d1d9" font-family="sans-serif" font-size="13">` +
          `Last release: ${label}</text>` +
          `</svg>`
        );
      },
    },
  ],
};

/** The built-in example plugins, ready to register. */
export const examplePlugins: BeaconPlugin[] = [securityPolicyPlugin, staleReleasePlugin];
