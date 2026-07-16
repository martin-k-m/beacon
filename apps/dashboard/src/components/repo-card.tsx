import * as React from 'react';
import Link from 'next/link';
import { GitFork, Star } from 'lucide-react';
import { Badge, ScoreRing, formatCompact, gradeColor, languageColor } from '@beacon/ui';
import type { DemoAnalysis } from '@/lib/data';

export interface RepoCardProps {
  analysis: DemoAnalysis;
}

/** A dashboard grid card linking to a repository's full analytics. */
export function RepoCard({ analysis }: RepoCardProps): React.JSX.Element {
  const { snapshot, score } = analysis;
  const m = snapshot.metadata;
  const colors = gradeColor(score.grade);
  const language = m.primaryLanguage;

  return (
    <Link
      href={`/${encodeURIComponent(m.owner)}/${encodeURIComponent(m.name)}`}
      className="glass card-hover group block rounded-lg p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-muted-foreground">{m.owner}/</p>
          <h3 className="truncate text-lg font-semibold text-foreground transition-colors group-hover:text-beacon">
            {m.name}
          </h3>
        </div>
        <ScoreRing
          value={score.total}
          size={56}
          strokeWidth={5}
          color={colors.hsl}
          showValue
        />
      </div>

      {m.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {m.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {language && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: languageColor(language) }}
              />
              {language}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" />
            {formatCompact(m.stars)}
          </span>
          <span className="inline-flex items-center gap-1">
            <GitFork className="size-3.5" />
            {formatCompact(m.forks)}
          </span>
        </div>
        <Badge variant="outline" className={`${colors.text} ${colors.border}`}>
          {score.grade}
        </Badge>
      </div>
    </Link>
  );
}
