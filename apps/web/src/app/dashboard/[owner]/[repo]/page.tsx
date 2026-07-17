import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  CircleDot,
  ExternalLink,
  Eye,
  GitFork,
  SearchX,
  Star,
  Users,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ScoreCard } from '@/components/score-card';
import { PillarBreakdown } from '@/components/pillar-breakdown';
import { CommitTimeline } from '@/components/commit-timeline';
import { LanguageDonut } from '@/components/language-donut';
import { ContributorList } from '@/components/contributor-list';
import { ReleaseTimeline } from '@/components/release-timeline';
import { IssueHealthCards } from '@/components/issue-health-cards';
import { HealthTrend } from '@/components/health-trend';
import { Reveal } from '@/components/reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAnalysis, getTrend } from '@/lib/api';
import { formatCompact, relativeTime } from '@/lib/utils';

interface PageProps {
  // Next 15 made dynamic route params async — they arrive as a Promise and
  // must be awaited before use.
  params: Promise<{ owner: string; repo: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { owner, repo } = await params;
  const analysis = await getAnalysis(owner, repo);
  if (!analysis) {
    return { title: `${owner}/${repo} · Not found` };
  }
  const { metadata } = analysis.snapshot;
  return {
    title: `${metadata.fullName} — Beacon Score ${analysis.score.total}`,
    description:
      metadata.description ??
      `Repository health analysis for ${metadata.fullName}.`,
  };
}

export default async function AnalysisPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { owner, repo } = await params;
  const [analysis, trend] = await Promise.all([
    getAnalysis(owner, repo),
    getTrend(owner, repo),
  ]);

  if (!analysis) {
    return <NotFoundState owner={owner} repo={repo} />;
  }

  const { snapshot, score, summary, highlights } = analysis;
  const m = snapshot.metadata;

  const quickStats = [
    { icon: Star, label: 'Stars', value: formatCompact(m.stars) },
    { icon: GitFork, label: 'Forks', value: formatCompact(m.forks) },
    { icon: Eye, label: 'Watchers', value: formatCompact(m.watchers) },
    { icon: CircleDot, label: 'Open issues', value: formatCompact(m.openIssues) },
    { icon: Users, label: 'Contributors', value: formatCompact(snapshot.contributors.length) },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Repo header */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    <span className="text-muted-foreground">{m.owner}/</span>
                    <span className="text-foreground">{m.name}</span>
                  </h1>
                  {m.isArchived && <Badge variant="warning">Archived</Badge>}
                  {m.isFork && <Badge variant="outline">Fork</Badge>}
                  {m.license && <Badge variant="default">{m.license}</Badge>}
                </div>
                {m.description && (
                  <p className="mt-2 max-w-2xl text-muted-foreground">{m.description}</p>
                )}
                {m.topics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.topics.map((topic) => (
                      <Badge key={topic} variant="cyan">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Updated {relativeTime(m.pushedAt)} · analyzed{' '}
                  {relativeTime(snapshot.collectedAt)}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <a href={m.htmlUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="size-4" />
                    View on GitHub
                  </Button>
                </a>
                {m.homepage && (
                  <a href={m.homepage} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm">
                      Homepage
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {quickStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="glass rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="size-3.5" />
                      {stat.label}
                    </div>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
                      {stat.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Analytics grid */}
        <section className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <Reveal>
            <ScoreCard score={score} summary={summary} highlights={highlights} />
          </Reveal>

          {trend && trend.series.length > 0 && (
            <Reveal>
              <HealthTrend series={trend.series} now={trend.now} initialRange="90d" />
            </Reveal>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal index={0}>
              <PillarBreakdown pillars={score.pillars} />
            </Reveal>
            <Reveal index={1}>
              <CommitTimeline activity={snapshot.commitActivity} />
            </Reveal>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal index={0}>
              <LanguageDonut languages={snapshot.languages} />
            </Reveal>
            <Reveal index={1}>
              <ContributorList contributors={snapshot.contributors} />
            </Reveal>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Reveal index={0} className="lg:col-span-2">
              <IssueHealthCards
                issues={snapshot.issues}
                pullRequests={snapshot.pullRequests}
              />
            </Reveal>
            <Reveal index={1}>
              <ReleaseTimeline releases={snapshot.releases} />
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function NotFoundState({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="glass max-w-md rounded-2xl p-10 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground">
            <SearchX className="size-6" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-foreground">
            No analysis found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Beacon has no data for{' '}
            <span className="font-mono text-foreground/80">
              {owner}/{repo}
            </span>
            . In demo mode, only the bundled sample repositories are available.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
