import * as React from 'react';
import { Tag } from 'lucide-react';
import type { ReleaseInfo } from '@beacon/core';
import { ChartCard } from '@/components/ui/chart-card';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';

export interface ReleaseTimelineProps {
  releases: ReleaseInfo[];
  limit?: number;
}

/** A vertical timeline of the most recent releases. */
export function ReleaseTimeline({
  releases,
  limit = 6,
}: ReleaseTimelineProps): React.JSX.Element {
  const items = releases.slice(0, limit);

  return (
    <ChartCard
      title="Releases"
      description={`${releases.length} published release${releases.length === 1 ? '' : 's'}`}
      icon={<Tag className="size-4" />}
    >
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No releases published yet.
        </p>
      ) : (
        <ol className="relative ml-1.5 space-y-5 border-l border-border pl-6">
          {items.map((release, i) => (
            <li key={release.id} className="relative">
              <span
                className={`absolute -left-[26px] top-1 size-3 rounded-full border-2 border-background ${
                  i === 0 ? 'bg-beacon shadow-[0_0_8px_hsl(var(--beacon))]' : 'bg-muted-foreground/50'
                }`}
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={release.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-semibold text-foreground transition-colors hover:text-beacon"
                >
                  {release.tagName}
                </a>
                {i === 0 && <Badge variant="beacon">Latest</Badge>}
                {release.isPrerelease && <Badge variant="warning">Prerelease</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {release.publishedAt
                  ? relativeTime(release.publishedAt)
                  : 'Unpublished draft'}
              </p>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}
