import * as React from 'react';
import type { Metadata } from 'next';
import { LayoutGrid, LineChart, Sparkles } from 'lucide-react';
import { Badge } from '@beacon/ui';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { RepoSearch } from '@/components/repo-search';
import { RepoCard } from '@/components/repo-card';
import { Reveal } from '@/components/reveal';
import { listAnalyses, isLiveMode } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Browse analyzed repositories and open their historical Beacon health trends.',
};

export default async function DashboardHome(): Promise<React.JSX.Element> {
  const analyses = await listAnalyses();
  const live = isLiveMode();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={live ? 'success' : 'beacon'}>
                {live ? 'Live API' : 'Demo mode'}
              </Badge>
              <Badge variant="outline">{analyses.length} repositories</Badge>
              <Badge variant="cyan">
                <LineChart className="size-3" />
                Health trends
              </Badge>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Repository health, <span className="beacon-text">over time.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Beacon Analytics charts how a project&apos;s Beacon Score and its
              five pillars move week over week. Search a repository, or open one
              already scored below.
            </p>
            <div className="mt-6 max-w-2xl">
              <RepoSearch size="md" />
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <LineChart className="size-3.5 text-beacon" />
                Historical trend charts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-beacon" />
                Per-pillar deltas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LayoutGrid className="size-3.5 text-beacon" />
                Full activity breakdown
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutGrid className="size-4" />
            Analyzed repositories
          </div>

          {analyses.length === 0 ? (
            <div className="glass rounded-lg p-12 text-center text-muted-foreground">
              No analyses available yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analyses.map((analysis, i) => (
                <Reveal key={analysis.snapshot.metadata.fullName} index={i}>
                  <RepoCard analysis={analysis} />
                </Reveal>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
