import * as React from 'react';
import type { Metadata } from 'next';
import { LayoutGrid } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { RepoSearch } from '@/components/repo-search';
import { RepoCard } from '@/components/repo-card';
import { Reveal } from '@/components/reveal';
import { Badge } from '@/components/ui/badge';
import { listAnalyses, isLiveMode } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Browse analyzed repositories and their Beacon health scores.',
};

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const analyses = await listAnalyses();
  const live = isLiveMode();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Badge variant={live ? 'success' : 'beacon'}>{live ? 'Live API' : 'Demo mode'}</Badge>
              <Badge variant="outline">{analyses.length} repositories</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Repository control center
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Analyze a new repository, or dive into one already scored below.
            </p>
            <div className="mt-6 max-w-2xl">
              <RepoSearch size="md" />
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
