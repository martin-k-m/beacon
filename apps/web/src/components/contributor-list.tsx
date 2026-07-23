'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import type { ContributorStat } from '@beacon/shared';
import { ChartCard } from '@/components/ui/chart-card';
import { formatCompact } from '@/lib/utils';

export interface ContributorListProps {
  contributors: ContributorStat[];
  /** How many to show. */
  limit?: number;
}

/** Top contributors as avatars with relative-contribution bars. */
export function ContributorList({
  contributors,
  limit = 8,
}: ContributorListProps): React.JSX.Element {
  const top = React.useMemo(
    () => [...contributors].sort((a, b) => b.contributions - a.contributions).slice(0, limit),
    [contributors, limit],
  );
  const max = top[0]?.contributions ?? 1;
  const totalPeople = contributors.length;

  return (
    <ChartCard
      title="Top contributors"
      description={`${totalPeople} contributor${totalPeople === 1 ? '' : 's'} total`}
      icon={<Users className="size-4" />}
    >
      <ul className="space-y-3">
        {top.map((c, i) => {
          const pct = Math.max(4, (c.contributions / max) * 100);
          return (
            <li key={c.login} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.avatarUrl}
                alt={c.login}
                width={32}
                height={32}
                loading="lazy"
                className="size-8 shrink-0 rounded-full border border-border bg-surface-2 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={c.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm font-medium text-foreground/90 transition-colors hover:text-beacon"
                  >
                    {c.login}
                  </a>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatCompact(c.contributions)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-beacon to-cyan"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
