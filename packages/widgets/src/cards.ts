import type { BeaconAnalysis, RepositorySnapshot, ScorePillar } from '@beacon/shared';
import {
  bar,
  beaconMark,
  fonts,
  formatCompact,
  panel,
  relativeTime,
  ring,
  svg,
  text,
  truncate,
} from './svg';
import { resolveTheme, scoreColor, type WidgetOptions, type WidgetSize } from './theme';

const CARD_WIDTH: Record<WidgetSize, number> = { small: 340, medium: 470, large: 540 };

const PILLAR_LABEL: Record<ScorePillar, string> = {
  activity: 'Activity',
  community: 'Community',
  maintenance: 'Maintenance',
  documentation: 'Docs',
  security: 'Security',
};

/** A small, stable color map for common languages (falls back to a hash). */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Scala: '#c22d40',
  Elixir: '#6e4a7e',
  Makefile: '#427819',
};

function languageColor(name: string): string {
  const known = LANGUAGE_COLORS[name];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 55% 55%)`;
}

function header(
  snapshot: RepositorySnapshot,
  t: ReturnType<typeof resolveTheme>,
  width: number,
): string {
  const name = truncate(snapshot.metadata.fullName, Math.floor((width - 90) / 9));
  return `${beaconMark(20, 20, 18, t.accent)}${text(46, 34, name, {
    size: 16,
    weight: 700,
    fill: t.text,
  })}`;
}

/** 1. Repository Health Card — the flagship widget. */
export function renderHealthCard(analysis: BeaconAnalysis, options: WidgetOptions = {}): string {
  const t = resolveTheme(options);
  const size = options.size ?? 'medium';
  const width = CARD_WIDTH[size];
  const showPillars = size !== 'small';
  const showSummary = size === 'large';
  const height = size === 'small' ? 128 : showSummary ? 236 : 200;

  const { snapshot, score } = analysis;
  const ringCx = width - 74;
  const ringCy = size === 'small' ? 64 : 100;
  const ringR = size === 'small' ? 38 : 46;
  const color = scoreColor(score.total);

  const parts: string[] = [panel(width, height, t.bg, t.border), header(snapshot, t, width)];

  if (snapshot.metadata.description) {
    parts.push(
      text(20, 56, truncate(snapshot.metadata.description, Math.floor((width - 150) / 6.4)), {
        size: 12,
        fill: t.subtext,
      }),
    );
  }

  // Score ring + grade pill.
  parts.push(
    ring(
      ringCx,
      ringCy,
      ringR,
      score.total / 100,
      color,
      t.track,
      String(score.total),
      t.text,
      ringR * 0.62,
    ),
  );
  const gradeW = 8 + score.grade.length * 7.2;
  parts.push(
    `<rect x="${ringCx - gradeW / 2}" y="${ringCy + ringR + 8}" width="${gradeW}" height="20" rx="10" fill="${color}" opacity="0.15"/>`,
    text(ringCx, ringCy + ringR + 22, score.grade, {
      size: 12,
      weight: 600,
      fill: color,
      anchor: 'middle',
    }),
  );

  if (showPillars) {
    const barX = 110;
    const barW = ringCx - ringR - barX - 26;
    let y = 82;
    for (const pillar of score.pillars) {
      parts.push(
        text(20, y + 4, PILLAR_LABEL[pillar.pillar], { size: 11, fill: t.subtext }),
        bar(barX, y - 5, barW, 7, pillar.score / 100, scoreColor(pillar.score), t.track),
        text(barX + barW + 8, y + 4, String(pillar.score), {
          size: 11,
          weight: 600,
          fill: t.text,
          family: fonts.mono,
        }),
      );
      y += 22;
    }
  }

  if (showSummary) {
    parts.push(
      text(20, height - 44, truncate(analysis.summary.text, Math.floor((width - 40) / 6.1)), {
        size: 11,
        fill: t.subtext,
      }),
    );
  }

  // Stats footer.
  const stats = [
    `${formatCompact(snapshot.metadata.stars)} stars`,
    `${formatCompact(snapshot.metadata.forks)} forks`,
    snapshot.metadata.primaryLanguage,
    `updated ${relativeTime(snapshot.metadata.pushedAt, Date.parse(snapshot.collectedAt) || Date.now())}`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  parts.push(text(20, height - 16, stats, { size: 11, fill: t.subtext }));

  return svg(width, height, parts.join(''), `Beacon health card for ${snapshot.metadata.fullName}`);
}

/** 2. Activity Graph — 52-week commit sparkline. */
export function renderActivityGraph(analysis: BeaconAnalysis, options: WidgetOptions = {}): string {
  const t = resolveTheme(options);
  const size = options.size ?? 'medium';
  const width = CARD_WIDTH[size];
  const height = 150;
  const { snapshot } = analysis;
  const weeks = snapshot.commitActivity.length
    ? snapshot.commitActivity
    : [{ weekStart: 0, total: 0 }];
  const max = Math.max(1, ...weeks.map((w) => w.total));

  const gx = 20;
  const gy = 64;
  const gw = width - 40;
  const gh = 58;
  const step = gw / Math.max(1, weeks.length - 1);
  const points = weeks
    .map((w, i) => `${(gx + i * step).toFixed(1)},${(gy + gh - (w.total / max) * gh).toFixed(1)}`)
    .join(' ');
  const area = `${gx},${gy + gh} ${points} ${gx + gw},${gy + gh}`;

  const total12 = weeks.slice(-12).reduce((s, w) => s + w.total, 0);
  const parts = [
    panel(width, height, t.bg, t.border),
    header(snapshot, t, width),
    text(20, 54, 'Commit activity · last 52 weeks', { size: 12, fill: t.subtext }),
    `<defs><linearGradient id="beaconArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.accent}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient></defs>`,
    `<polygon points="${area}" fill="url(#beaconArea)"/>`,
    `<polyline points="${points}" fill="none" stroke="${t.accent}" stroke-width="2" stroke-linejoin="round"/>`,
    text(
      20,
      height - 12,
      `${total12} commits in the last 12 weeks · ${snapshot.contributors.length} contributors`,
      {
        size: 11,
        fill: t.subtext,
      },
    ),
  ];
  return svg(
    width,
    height,
    parts.join(''),
    `Beacon activity graph for ${snapshot.metadata.fullName}`,
  );
}

/** 3. Language Card. */
export function renderLanguageCard(analysis: BeaconAnalysis, options: WidgetOptions = {}): string {
  const t = resolveTheme(options);
  const size = options.size ?? 'medium';
  const width = CARD_WIDTH[size];
  const { snapshot } = analysis;
  const entries = Object.entries(snapshot.languages).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const top = entries.slice(0, 6);
  const height = 82 + top.length * 22;

  const barX = 20;
  const barW = width - 40;
  let cursor = barX;
  const segments = top
    .map(([name, value]) => {
      const w = (value / total) * barW;
      const seg = `<rect x="${cursor.toFixed(1)}" y="60" width="${Math.max(0, w).toFixed(1)}" height="10" fill="${languageColor(name)}"/>`;
      cursor += w;
      return seg;
    })
    .join('');

  let y = 96;
  const legend = top
    .map(([name, value]) => {
      const pct = ((value / total) * 100).toFixed(1);
      const row = `<circle cx="26" cy="${y - 4}" r="5" fill="${languageColor(name)}"/>${text(
        38,
        y,
        name,
        {
          size: 12,
          fill: t.text,
        },
      )}${text(width - 20, y, `${pct}%`, { size: 12, fill: t.subtext, anchor: 'end', family: fonts.mono })}`;
      y += 22;
      return row;
    })
    .join('');

  const parts = [
    panel(width, height, t.bg, t.border),
    header(snapshot, t, width),
    text(20, 54, 'Languages', { size: 12, fill: t.subtext }),
    `<clipPath id="langClip"><rect x="${barX}" y="60" width="${barW}" height="10" rx="5"/></clipPath>`,
    `<g clip-path="url(#langClip)">${segments}</g>`,
    legend,
  ];
  return svg(
    width,
    height,
    parts.join(''),
    `Beacon language breakdown for ${snapshot.metadata.fullName}`,
  );
}

/** 4. Contributor Card. */
export function renderContributorCard(
  analysis: BeaconAnalysis,
  options: WidgetOptions = {},
): string {
  const t = resolveTheme(options);
  const size = options.size ?? 'medium';
  const width = CARD_WIDTH[size];
  const { snapshot } = analysis;
  const top = snapshot.contributors.slice(0, 6);
  const max = Math.max(1, ...top.map((c) => c.contributions));
  const height = 78 + top.length * 24;

  let y = 78;
  const rows = top
    .map((c, i) => {
      const barX = 40;
      const barW = width - 120;
      const row = `${text(24, y + 4, String(i + 1), { size: 11, fill: t.subtext, family: fonts.mono })}${text(
        barX,
        y + 4,
        truncate(c.login, 18),
        { size: 12, fill: t.text },
      )}${bar(barX, y + 10, barW, 5, c.contributions / max, t.accent, t.track)}${text(
        width - 20,
        y + 4,
        formatCompact(c.contributions),
        { size: 11, fill: t.subtext, anchor: 'end', family: fonts.mono },
      )}`;
      y += 24;
      return row;
    })
    .join('');

  const parts = [
    panel(width, height, t.bg, t.border),
    header(snapshot, t, width),
    text(20, 54, `Top contributors · ${snapshot.contributors.length} total`, {
      size: 12,
      fill: t.subtext,
    }),
    rows,
  ];
  return svg(
    width,
    height,
    parts.join(''),
    `Beacon contributors for ${snapshot.metadata.fullName}`,
  );
}

/** 5. Release Card. */
export function renderReleaseCard(analysis: BeaconAnalysis, options: WidgetOptions = {}): string {
  const t = resolveTheme(options);
  const size = options.size ?? 'medium';
  const width = CARD_WIDTH[size];
  const { snapshot } = analysis;
  const releases = snapshot.releases.filter((r) => r.publishedAt);
  const height = 150;
  const now = Date.parse(snapshot.collectedAt) || Date.now();

  const parts = [
    panel(width, height, t.bg, t.border),
    header(snapshot, t, width),
    text(20, 54, 'Releases', { size: 12, fill: t.subtext }),
  ];

  if (releases.length === 0) {
    parts.push(text(20, 92, 'No published releases', { size: 14, fill: t.text }));
  } else {
    const latest = releases[0]!;
    parts.push(
      `<rect x="20" y="66" width="${width - 40}" height="34" rx="6" fill="${t.panel}" stroke="${t.border}"/>`,
      text(32, 88, truncate(latest.tagName, 22), {
        size: 15,
        weight: 700,
        fill: t.accent,
        family: fonts.mono,
      }),
      text(width - 32, 88, latest.publishedAt ? relativeTime(latest.publishedAt, now) : '', {
        size: 12,
        fill: t.subtext,
        anchor: 'end',
      }),
    );
    const prior = releases.slice(1, 3);
    let y = 122;
    for (const r of prior) {
      parts.push(
        text(32, y, truncate(r.tagName, 20), { size: 12, fill: t.text, family: fonts.mono }),
        text(width - 32, y, r.publishedAt ? relativeTime(r.publishedAt, now) : '', {
          size: 11,
          fill: t.subtext,
          anchor: 'end',
        }),
      );
      y += 20;
    }
  }
  return svg(width, height, parts.join(''), `Beacon releases for ${snapshot.metadata.fullName}`);
}
