import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, GaugeCircle, Github, Star } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { RepoSearch } from '@/components/repo-search';
import { FeatureGrid } from '@/components/feature-grid';
import { Reveal } from '@/components/reveal';
import { ScoreRing } from '@/components/ui/score-ring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { getDemoAnalyses } from '@/lib/data';
import { formatCompact, gradeColor, pillarLabel, scoreColor } from '@/lib/utils';

const GITHUB_URL = 'https://github.com/martin-k-m/beacon';

export default function LandingPage(): React.JSX.Element {
  const analyses = getDemoAnalyses();
  const preview = analyses[0];

  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="aurora" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)',
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-28">
            <Reveal className="mx-auto max-w-3xl text-center">
              <a
                href={`${GITHUB_URL}`}
                target="_blank"
                rel="noreferrer"
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-beacon/40 hover:text-foreground"
              >
                <span className="inline-flex size-1.5 rounded-full bg-beacon shadow-[0_0_8px_hsl(var(--beacon))]" />
                Open source · MIT licensed
                <ArrowRight className="size-3" />
              </a>
              <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
                Understand any GitHub <span className="gradient-text">repository instantly.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
                Beacon turns raw GitHub signals into a clear read on repository health — activity,
                contributors, maintenance, and AI summaries, all in one dashboard.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="mx-auto mt-10 max-w-2xl">
              <RepoSearch />
            </Reveal>

            <Reveal delay={0.2} className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href="/dashboard">
                <Button variant="secondary" size="md">
                  View demo dashboard
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="md">
                  <Github className="size-4" />
                  Star on GitHub
                </Button>
              </a>
            </Reveal>

            {/* Live-looking mini preview */}
            {preview && (
              <Reveal delay={0.28} className="mx-auto mt-16 max-w-4xl">
                <HeroPreview analysis={preview} />
              </Reveal>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <Badge variant="beacon" className="mb-4">
              What Beacon sees
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Every signal that matters, in one place.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Six lenses on repository health, computed deterministically from a single snapshot of
              the repository.
            </p>
          </Reveal>
          <FeatureGrid />
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <Reveal>
            <div className="glass relative overflow-hidden rounded-2xl p-10 text-center sm:p-16">
              <div className="aurora" aria-hidden />
              <div className="relative">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Point Beacon at your next dependency.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                  Before you adopt a library, know how healthy it really is. Analyze any public
                  repository in seconds.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/dashboard">
                    <Button size="lg">
                      Explore the dashboard
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="lg">
                      <Github className="size-4" />
                      View source
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/** A composed, non-interactive preview of the analysis surface. */
function HeroPreview({
  analysis,
}: {
  analysis: ReturnType<typeof getDemoAnalyses>[number];
}): React.JSX.Element {
  const { snapshot, score } = analysis;
  const m = snapshot.metadata;
  const colors = gradeColor(score.grade);

  return (
    <div className="glass overflow-hidden rounded-2xl shadow-card">
      <div className="flex items-center gap-2 border-b border-border/60 bg-surface-2/50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-danger/60" />
        <span className="size-2.5 rounded-full bg-warning/60" />
        <span className="size-2.5 rounded-full bg-success/60" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">beacon · {m.fullName}</span>
      </div>
      <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center md:p-8">
        <div className="flex flex-col items-center gap-3">
          <ScoreRing value={score.total} size={140} strokeWidth={11} color={colors.hsl} />
          <Badge variant="outline" className={`${colors.text} ${colors.border}`}>
            {score.grade}
          </Badge>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">{m.fullName}</h3>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="size-3.5" />
              {formatCompact(m.stars)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
          <div className="mt-4 space-y-2.5">
            {score.pillars.slice(0, 3).map((pillar, i) => (
              <ProgressBar
                key={pillar.pillar}
                value={pillar.score}
                color={scoreColor(pillar.score)}
                label={pillarLabel(pillar.pillar)}
                valueLabel={String(pillar.score)}
                delay={0.3 + i * 0.1}
                height={6}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/60 px-6 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <GaugeCircle className="size-3.5 text-beacon" />
          Live demo data
        </span>
        <Link
          href={`/dashboard/${m.owner}/${m.name}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-beacon transition-opacity hover:opacity-80"
        >
          Open full analysis
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
