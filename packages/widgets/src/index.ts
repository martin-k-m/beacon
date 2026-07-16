/**
 * @beacon/widgets — self-contained SVG widgets for embedding Beacon anywhere
 * (READMEs, profiles, dashboards). Every renderer takes a {@link BeaconAnalysis}
 * and returns a standalone SVG string with no external assets or fonts.
 */
import type { BeaconAnalysis } from '@beacon/shared';
import { renderMaintenanceBadge } from './badge';
import {
  renderActivityGraph,
  renderContributorCard,
  renderHealthCard,
  renderLanguageCard,
  renderReleaseCard,
} from './cards';
import type { WidgetOptions } from './theme';

export * from './theme';
export { SVG_CONTENT_TYPE } from './svg';
export * from './cards';
export * from './badge';

/** Every embeddable widget type. */
export const WIDGET_TYPES = [
  'health',
  'activity',
  'language',
  'contributor',
  'release',
  'badge',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value);
}

const RENDERERS: Record<WidgetType, (a: BeaconAnalysis, o: WidgetOptions) => string> = {
  health: renderHealthCard,
  activity: renderActivityGraph,
  language: renderLanguageCard,
  contributor: renderContributorCard,
  release: renderReleaseCard,
  badge: renderMaintenanceBadge,
};

/** Render any widget by type. Unknown types fall back to the health card. */
export function renderWidget(
  type: WidgetType,
  analysis: BeaconAnalysis,
  options: WidgetOptions = {},
): string {
  const renderer = RENDERERS[type] ?? renderHealthCard;
  return renderer(analysis, options);
}

/**
 * Build the canonical embed snippets for a widget, given the Beacon host and
 * repository. Used by the CLI and docs to show copy-paste embed code.
 */
export function embedSnippets(
  host: string,
  owner: string,
  repo: string,
  type: WidgetType = 'health',
  options: WidgetOptions = {},
): { url: string; markdown: string; html: string } {
  const base = host.replace(/\/$/, '');
  const path = type === 'badge' ? `badge/${owner}/${repo}` : `widget/${type}/${owner}/${repo}`;
  const query: string[] = [];
  if (options.theme) query.push(`theme=${options.theme}`);
  if (options.size) query.push(`size=${options.size}`);
  const url = `${base}/${path}${query.length ? `?${query.join('&')}` : ''}`;
  const alt = `Beacon ${type} — ${owner}/${repo}`;
  const link = `https://github.com/${owner}/${repo}`;
  return {
    url,
    markdown: `[![${alt}](${url})](${link})`,
    html: `<a href="${link}"><img src="${url}" alt="${alt}" /></a>`,
  };
}

export const BEACON_WIDGETS_VERSION = '0.1.0';
