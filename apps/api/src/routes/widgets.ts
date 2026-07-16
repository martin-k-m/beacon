import {
  isWidgetType,
  renderMaintenanceBadge,
  renderWidget,
  SVG_CONTENT_TYPE,
  type WidgetOptions,
  type WidgetSize,
  type WidgetTheme,
} from '@beacon/widgets';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import { cache } from '../cache';
import { config } from '../config';
import { getAnalysis } from '../service';

const THEMES: readonly WidgetTheme[] = ['dark', 'light', 'transparent'];
const SIZES: readonly WidgetSize[] = ['small', 'medium', 'large'];

// Conservative accent validation: only hex colors or basic rgb/rgba/hsl() forms
// are accepted so nothing user-controlled can break out of the SVG attribute.
const ACCENT_RE = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\([0-9%.,\s]+\))$/;

interface WidgetQuery {
  theme?: string;
  size?: string;
  accent?: string;
}

/**
 * Parse and validate widget options from the query string. Invalid values are
 * ignored (the renderer falls back to its defaults) rather than rejected, so an
 * embedded image never breaks over a typo.
 */
function parseOptions(query: WidgetQuery): WidgetOptions {
  const options: WidgetOptions = {};
  if (query.theme && (THEMES as readonly string[]).includes(query.theme)) {
    options.theme = query.theme as WidgetTheme;
  }
  if (query.size && (SIZES as readonly string[]).includes(query.size)) {
    options.size = query.size as WidgetSize;
  }
  if (query.accent && ACCENT_RE.test(query.accent)) {
    options.accent = query.accent;
  }
  return options;
}

/**
 * A minimal standalone SVG shown when analysis can't be produced (unknown repo,
 * rate limit, transient failure). Embeds must never render a broken image, so we
 * always return 200 with a small, cache-friendly "unavailable" card.
 */
export function errorBadge(message: string): string {
  const text = String(message).slice(0, 48);
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const width = 132 + Math.max(0, safe.length - 11) * 6.5;
  const labelW = 62;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="20" viewBox="0 0 ${Math.round(width)} 20" role="img" aria-label="beacon: ${safe}">
  <title>beacon: ${safe}</title>
  <clipPath id="r"><rect width="${Math.round(width)}" height="20" rx="4" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#24292f"/>
    <rect x="${labelW}" width="${Math.round(width) - labelW}" height="20" fill="#6e7681"/>
  </g>
  <g font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11" fill="#fff">
    <text x="${labelW / 2}" y="14" text-anchor="middle" font-weight="500">beacon</text>
    <text x="${labelW + (Math.round(width) - labelW) / 2}" y="14" text-anchor="middle">${safe}</text>
  </g>
</svg>`;
}

/** Send an SVG body with the standard content type and a cache policy. */
function sendSvg(reply: FastifyReply, svg: string, maxAge: number): FastifyReply {
  return reply
    .header('Content-Type', SVG_CONTENT_TYPE)
    .header('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`)
    .send(svg);
}

function svgCacheKey(
  kind: string,
  owner: string,
  repo: string,
  options: WidgetOptions,
): string {
  const theme = options.theme ?? 'dark';
  const size = options.size ?? 'default';
  const accent = options.accent ?? 'default';
  return `svg:${kind}:${owner.toLowerCase()}/${repo.toLowerCase()}:${theme}:${size}:${accent}`;
}

/**
 * Embeddable SVG widgets and badges. Every endpoint always returns an SVG
 * (200), rendering a small "unavailable" card on any failure so a README/image
 * embed never shows a broken image. Rendered SVGs are cached for
 * `config.cacheTtlSeconds`; responses carry a 30-minute browser/CDN cache.
 */
export const widgetRoutes: FastifyPluginAsync = async (app) => {
  const SUCCESS_MAX_AGE = 1800;
  const ERROR_MAX_AGE = 60;

  /**
   * Render a widget of `kind` (a WidgetType or 'badge') for owner/repo, using
   * the cached SVG when available and degrading to an error card on failure.
   */
  async function renderTo(
    reply: FastifyReply,
    kind: string,
    owner: string,
    repo: string,
    options: WidgetOptions,
    render: (svgOptions: WidgetOptions) => Promise<string>,
  ): Promise<FastifyReply> {
    const key = svgCacheKey(kind, owner, repo, options);
    const cached = await cache.get<string>(key);
    if (cached) return sendSvg(reply, cached, SUCCESS_MAX_AGE);

    try {
      const svg = await render(options);
      await cache.set(key, svg, config.cacheTtlSeconds);
      return sendSvg(reply, svg, SUCCESS_MAX_AGE);
    } catch {
      // Any failure (GitHubError 404/429, network, malformed repo) → 200 error
      // card with a short cache so a fixed repo recovers quickly.
      return sendSvg(reply, errorBadge('unavailable'), ERROR_MAX_AGE);
    }
  }

  // Typed widget: /widget/health/facebook/react?theme=dark&size=large
  app.get<{
    Params: { type: string; owner: string; repo: string };
    Querystring: WidgetQuery;
  }>('/widget/:type/:owner/:repo', async (request, reply) => {
    const { type, owner, repo } = request.params;
    if (!isWidgetType(type)) {
      return reply.status(404).send({
        error: `Unknown widget type: ${type}`,
        hint: 'Valid types: health, activity, language, contributor, release, badge.',
      });
    }
    const options = parseOptions(request.query);
    return renderTo(reply, type, owner, repo, options, async (opts) => {
      const analysis = await getAnalysis(`${owner}/${repo}`);
      return renderWidget(type, analysis, opts);
    });
  });

  // Canonical simple embed — the health card.
  app.get<{
    Params: { owner: string; repo: string };
    Querystring: WidgetQuery;
  }>('/widget/repo/:owner/:repo', async (request, reply) => {
    const { owner, repo } = request.params;
    const options = parseOptions(request.query);
    return renderTo(reply, 'health', owner, repo, options, async (opts) => {
      const analysis = await getAnalysis(`${owner}/${repo}`);
      return renderWidget('health', analysis, opts);
    });
  });

  // Maintenance badge (shields.io-style).
  app.get<{
    Params: { owner: string; repo: string };
    Querystring: WidgetQuery;
  }>('/badge/:owner/:repo', async (request, reply) => {
    const { owner, repo } = request.params;
    const options = parseOptions(request.query);
    return renderTo(reply, 'badge', owner, repo, options, async (opts) => {
      const analysis = await getAnalysis(`${owner}/${repo}`);
      return renderMaintenanceBadge(analysis, opts);
    });
  });
};
