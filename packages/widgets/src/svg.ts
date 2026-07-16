/** Small SVG-building helpers shared by the widget renderers. */

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO_STACK = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace";

export const fonts = { sans: FONT_STACK, mono: MONO_STACK };

/** Escape a string for safe inclusion in SVG text/attributes. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Truncate to `max` characters with an ellipsis. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Compact number formatting: 18432 → "18.4k". */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown';
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/** A rounded-rect card background + border. */
export function panel(
  width: number,
  height: number,
  fill: string,
  stroke: string,
  radius = 8,
): string {
  return `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
}

/** The Beacon lighthouse mark as an inline path, scaled into a box at (x,y). */
export function beaconMark(x: number, y: number, size: number, color: string): string {
  const s = size / 24;
  return `<g transform="translate(${x},${y}) scale(${s})" fill="${color}" aria-hidden="true">
    <path d="M12 2l2.2 4.5-2.2 1.2-2.2-1.2L12 2z" opacity="0.9"/>
    <path d="M9.5 8.2h5l1.2 12.3a1 1 0 0 1-1 1.1H9.3a1 1 0 0 1-1-1.1L9.5 8.2z"/>
    <path d="M8.9 12.6h6.2l.2 2H8.7l.2-2z" fill="#0d1117" opacity="0.35"/>
  </g>`;
}

/** Draw a text run. */
export function text(
  x: number,
  y: number,
  content: string,
  opts: {
    size?: number;
    weight?: number;
    fill?: string;
    family?: string;
    anchor?: 'start' | 'middle' | 'end';
    opacity?: number;
  } = {},
): string {
  const {
    size = 13,
    weight = 400,
    fill = '#e6edf3',
    family = FONT_STACK,
    anchor = 'start',
    opacity = 1,
  } = opts;
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${escapeXml(content)}</text>`;
}

/** A horizontal progress bar. */
export function bar(
  x: number,
  y: number,
  width: number,
  height: number,
  fraction: number,
  fill: string,
  track: string,
): string {
  const w = Math.max(0, Math.min(1, fraction)) * width;
  const r = height / 2;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}" fill="${track}"/>${
    w > 0 ? `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="${height}" rx="${r}" fill="${fill}"/>` : ''
  }`;
}

/** A circular score ring with the number in the middle. */
export function ring(
  cx: number,
  cy: number,
  radius: number,
  fraction: number,
  color: string,
  track: string,
  label: string,
  labelColor: string,
  labelSize: number,
): string {
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(1, fraction)) * circumference;
  const stroke = Math.max(4, Math.round(radius * 0.18));
  return `
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}"
      transform="rotate(-90 ${cx} ${cy})"/>
    ${text(cx, cy + labelSize * 0.35, label, { size: labelSize, weight: 700, fill: labelColor, anchor: 'middle', family: FONT_STACK })}`;
}

/** Wrap a full SVG document. */
export function svg(width: number, height: number, body: string, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>${body}</svg>`;
}

export const SVG_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';
