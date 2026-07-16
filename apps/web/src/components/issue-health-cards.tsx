import * as React from 'react';
import { CircleDot, GitPullRequest } from 'lucide-react';
import type { IssueMetrics, PullRequestMetrics } from '@beacon/shared';
import { Card } from '@/components/ui/card';
import { formatHours, formatNumber } from '@/lib/utils';

export interface IssueHealthCardsProps {
  issues: IssueMetrics;
  pullRequests: PullRequestMetrics;
}

interface Row {
  label: string;
  value: string;
  /** Signed delta shown as a small chip; sign meaning depends on `goodWhen`. */
  delta?: number;
  goodWhen?: 'up' | 'down';
}

function DeltaChip({ delta, goodWhen }: { delta: number; goodWhen: 'up' | 'down' }): React.JSX.Element {
  const up = delta > 0;
  const good = goodWhen === 'up' ? up : !up;
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        good ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
      }`}
    >
      {up ? '+' : ''}
      {delta}
    </span>
  );
}

function HealthCard({
  title,
  icon,
  open,
  openLabel,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  open: number;
  openLabel: string;
  rows: Row[];
}): React.JSX.Element {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <span className="text-beacon">{icon}</span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
          {formatNumber(open)}
        </span>
        <span className="text-sm text-muted-foreground">{openLabel}</span>
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-border pt-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="flex items-center font-mono font-medium text-foreground/90">
              {row.value}
              {typeof row.delta === 'number' && row.goodWhen && (
                <DeltaChip delta={row.delta} goodWhen={row.goodWhen} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Two stat cards summarizing issue and pull-request health. */
export function IssueHealthCards({
  issues,
  pullRequests,
}: IssueHealthCardsProps): React.JSX.Element {
  const issueNetOpen = issues.openedLast30Days - issues.closedLast30Days;
  const prNetMerged = pullRequests.mergedLast30Days - pullRequests.openedLast30Days;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <HealthCard
        title="Issue health"
        icon={<CircleDot className="size-4" />}
        open={issues.open}
        openLabel="open issues"
        rows={[
          { label: 'Closed (all time)', value: formatNumber(issues.closed) },
          { label: 'Median time to close', value: formatHours(issues.medianTimeToCloseHours) },
          {
            label: 'Opened · closed (30d)',
            value: `${issues.openedLast30Days} · ${issues.closedLast30Days}`,
            delta: issueNetOpen,
            goodWhen: 'down',
          },
        ]}
      />
      <HealthCard
        title="Pull request health"
        icon={<GitPullRequest className="size-4" />}
        open={pullRequests.open}
        openLabel="open PRs"
        rows={[
          { label: 'Merged (all time)', value: formatNumber(pullRequests.merged) },
          { label: 'Median time to merge', value: formatHours(pullRequests.medianTimeToMergeHours) },
          {
            label: 'Opened · merged (30d)',
            value: `${pullRequests.openedLast30Days} · ${pullRequests.mergedLast30Days}`,
            delta: prNetMerged,
            goodWhen: 'up',
          },
        ]}
      />
    </div>
  );
}
