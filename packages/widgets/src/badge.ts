import type { BeaconAnalysis, BeaconScore } from '@beacon/shared';
import { escapeXml, fonts } from './svg';
import { gradeColor, type WidgetOptions, type WidgetSize } from './theme';

export type MaintenanceStatus = 'healthy' | 'needs attention' | 'inactive';

export function maintenanceStatus(score: BeaconScore): MaintenanceStatus {
  if (score.grade === 'Excellent' || score.grade === 'Healthy') return 'healthy';
  if (score.grade === 'Critical') return 'inactive';
  return 'needs attention';
}

const BADGE_HEIGHT: Record<WidgetSize, number> = { small: 20, medium: 24, large: 28 };

/** Rough character width for the badge label geometry (Verdana-ish at the font size). */
function textWidth(value: string, fontSize: number): number {
  return value.length * fontSize * 0.62 + fontSize;
}

/**
 * 6. Maintenance Badge — a shields.io-style badge:  [ beacon | 94 healthy ]
 * Accepts either a full analysis or a bare score.
 */
export function renderMaintenanceBadge(
  input: BeaconAnalysis | BeaconScore,
  options: WidgetOptions = {},
): string {
  const score: BeaconScore = 'score' in input ? input.score : input;
  const size = options.size ?? 'small';
  const height = BADGE_HEIGHT[size];
  const fontSize = Math.round(height * 0.55);

  const label = 'beacon';
  const status = maintenanceStatus(score);
  const value = `${score.total} ${status}`;
  const color = gradeColor(score.grade);

  const pad = fontSize * 0.7;
  const labelW = Math.round(textWidth(label, fontSize) + pad);
  const valueW = Math.round(textWidth(value, fontSize) + pad);
  const width = labelW + valueW;
  const r = 4;
  // Shields-style: a neutral dark label segment, colored value segment.
  const labelBg = '#24292f';
  const cy = height / 2 + fontSize * 0.35;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${label}: ${value}`)}">
  <title>${escapeXml(`${label}: ${value}`)}</title>
  <clipPath id="beaconBadgeR"><rect width="${width}" height="${height}" rx="${r}" fill="#fff"/></clipPath>
  <g clip-path="url(#beaconBadgeR)">
    <rect width="${labelW}" height="${height}" fill="${labelBg}"/>
    <rect x="${labelW}" width="${valueW}" height="${height}" fill="${color}"/>
  </g>
  <g font-family="${fonts.sans}" font-size="${fontSize}" fill="#fff">
    <text x="${labelW / 2}" y="${cy}" text-anchor="middle" font-weight="500">${escapeXml(label)}</text>
    <text x="${labelW + valueW / 2}" y="${cy}" text-anchor="middle" font-weight="600">${escapeXml(value)}</text>
  </g>
</svg>`;
}
